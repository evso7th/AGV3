/**
 * @fileOverview Центральная фабрика инструментов V17.3 — "Pitch Humanisation".
 * #ЗАЧЕМ: Реализация ПЛАНА №3500. Внедрение микро-детонации для органического звучания.
 * #ЧТО:  1. Добавлен Notch/Peaking 400Hz для гитар.
 *        2. Реализован алгоритм Phase Lock для баса.
 *        3. Внедрена случайная детонация (Humanize) для каждого нового голоса.
 */

import { dbToGain } from './guitar-loudness';

// ───── GLOBAL REGISTRY & LIMITS ─────

export let globalActiveVoices = new Set<any>();
let globalVoiceLimit = 128; 

const STEAL_PRIORITY: Record<string, number> = {
    'sparkle': 0,
    'sfx': 0,
    'melody': 1,
    'drums': 1,
    'accompaniment': 2,
    'harmony': 2,
    'bass': 3,
    'pianoAccompaniment': 4 
};

const VOICE_BALANCE: Record<string, number> = {
  bass: 0.75,
  melody: 1.50,
  accompaniment: 1.50,
  drums: 0.50,
  sparkles: 0.80,
  sfx: 0.40,
  harmony: 0.60,
  pianoAccompaniment: 0.50,
};

export const setGlobalVoiceLimit = (limit: number) => {
    if (isFinite(limit) && limit > 0) {
        globalVoiceLimit = limit;
    }
};

export const globalAllNotesOff = () => {
    const allVoices = Array.from(globalActiveVoices);
    allVoices.forEach(v => deepCleanup(v));
    globalActiveVoices.clear();
};

export const deepCleanup = (voiceRecord: any) => {
    if (!voiceRecord || voiceRecord.disposed) return;
    voiceRecord.disposed = true;
    
    if (voiceRecord.nodes) {
        voiceRecord.nodes.forEach((n: any) => {
            try {
                if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) {
                    n.onended = null; 
                    n.stop();
                }
                n.disconnect();
            } catch (e) {}
        });
    }
    
    voiceRecord.nodes = null;
    voiceRecord.voiceState = null;
    voiceRecord.instrumentId = null;
    globalActiveVoices.delete(voiceRecord);
};

export const collectExpiredVoices = (audioCtxTime: number) => {
    if (globalActiveVoices.size === 0) return;
    const now = audioCtxTime;
    for (const voice of globalActiveVoices) {
        if (voice.expirationTime < now || voice.disposed) {
            deepCleanup(voice);
        }
    }
};

export const enforceVoiceLimit = () => {
    if (globalActiveVoices.size <= globalVoiceLimit) return;
    const toKillCount = globalActiveVoices.size - globalVoiceLimit;
    const allVoices = Array.from(globalActiveVoices).filter(v => !v.disposed);
    allVoices.sort((a, b) => {
        const prioA = STEAL_PRIORITY[a.type] ?? 1;
        const prioB = STEAL_PRIORITY[b.type] ?? 1;
        if (prioA !== prioB) return prioA - prioB;
        return a.voiceState.startTime - b.voiceState.startTime;
    });
    const targets = allVoices.slice(0, toKillCount);
    targets.forEach(v => deepCleanup(v));
};

// ───── HELPERS ─────

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const getADSR = (p: any, params?: any, type?: string) => {
    const a = p.adsr || p;
    let rawA = isFinite(params?.attack) ? params.attack : (isFinite(a.a) ? a.a : (isFinite(a.attack) ? a.attack : 0.01));
    let rawD = isFinite(params?.decay) ? params.decay : (isFinite(a.d) ? a.d : (isFinite(a.decay) ? a.decay : 0.1));
    let rawS = isFinite(params?.sustain) ? params.sustain : (isFinite(a.s) ? a.s : (isFinite(a.sustain) ? a.sustain : 0.7));
    let rawR = isFinite(params?.release) ? params.release : (isFinite(a.r) ? a.r : (isFinite(a.release) ? a.release : 0.3));
    
    if (type === 'bass') rawA = Math.max(rawA, 0.07);
    
    return { a: rawA, d: rawD, s: rawS, r: rawR };
};

const waveCache = new WeakMap<AudioContext, Map<string, PeriodicWave>>();
const getCachedWave = (ctx: AudioContext, key: string, build: () => PeriodicWave): PeriodicWave => {
    let perCtx = waveCache.get(ctx);
    if (!perCtx) { perCtx = new Map(); waveCache.set(ctx, perCtx); }
    let wave = perCtx.get(key);
    if (!wave) { wave = build(); perCtx.set(key, wave); }
    return wave;
};

const getGuitarWave = (ctx: AudioContext, width: number): PeriodicWave =>
    getCachedWave(ctx, `g:${Math.round(width * 1e4) / 1e4}:v2`, () => {
        const real = new Float32Array(65), imag = new Float32Array(65);
        for (let n = 1; n < 65; n++) {
            let amplitude = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * width);
            if (n % 2 !== 0) amplitude *= 1.5;
            real[n] = amplitude;
        }
        return ctx.createPeriodicWave(real, imag);
    });

const getOrganWave = (ctx: AudioContext, drawbars: number[]): PeriodicWave =>
    getCachedWave(ctx, `o:${drawbars.join(',')}`, () => {
        const real = new Float32Array(17), imag = new Float32Array(17);
        const indices = [1, 3, 2, 4, 6, 8, 10, 12, 16];
        drawbars.forEach((v: number, i: number) => { if (v > 0) real[indices[i]] = v / 8; });
        return ctx.createPeriodicWave(real, imag);
    });

const curveCache = new Map<string, Float32Array>();
const getDriveCurve = (type: string, amount: number): Float32Array => {
    const q = Math.round(amount * 100) / 100;
    const key = `${type}:${q}`;
    if (curveCache.has(key)) return curveCache.get(key)!;
    const n = 4096, c = new Float32Array(n);
    if (type === 'muff') {
        const k = 1 + q * 6;
        for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k); }
    } else {
        const k = q * 4;
        for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = x / (1 + k * Math.abs(x)); }
    }
    curveCache.set(key, c);
    return c;
};

const noiseCache = new WeakMap<AudioContext, AudioBuffer>();
const getNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    const cached = noiseCache.get(ctx); if (cached) return cached;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf); return buf;
};

const irCache = new WeakMap<AudioContext, AudioBuffer>();
const getReverbIR = (ctx: AudioContext): AudioBuffer => {
    const cached = irCache.get(ctx); if (cached) return cached;
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            const t = i / len;
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
        }
    }
    irCache.set(ctx, buf); return buf;
};

const BASS_PURITY_CHAIN = true;
const SUB_MIN_HZ = 35;

const createIndependentVoice = (
    ctx: AudioContext,
    type: string,
    preset: any,
    output: AudioNode,
    midi: number,
    when: number,
    velocity: number,
    duration: number,
    instrumentId: string,
    sharedDelayNode: AudioNode | null = null,
    eventParams: any = null,
    tempo: number = 72
) => {
    const f0 = midiToHz(midi);
    const adsr = getADSR(preset, eventParams, type);
    const now = Math.max(when, ctx.currentTime);

    const isEcho = eventParams?.isEcho === true;
    const isDub = eventParams?.isDub === true;

    // #ЗАЧЕМ: Алгоритм PHASE LOCK.
    const isPhaseLocked = (type === 'bass' && preset.phaseLock !== false);
    const attackTime = isPhaseLocked ? 0.002 : adsr.a;
    
    // #ЗАЧЕМ: Алгоритм PITCH HUMANIZE.
    const humanizeCents = preset.humanize?.pitchCents || 0;
    const randomDetune = (Math.random() * 2 - 1) * humanizeCents;
    
    const releaseTime = adsr.r;
    let peak = velocity * (isEcho ? 0.65 : 0.45); 

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    const nodes: AudioNode[] = [voiceGain];

    const noteOffTime = now + duration;
    const releaseTimeConstant = Math.max(releaseTime / 3, 0.08); 
    const expirationTime = now + duration + (releaseTimeConstant * 5) + 0.5;

    if (type === 'guitar') {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getGuitarWave(ctx, preset.osc?.width || 0.45));
        osc.frequency.setValueAtTime(f0, now);
        osc.detune.setValueAtTime(randomDetune, now);
        osc.connect(voiceGain);
        osc.start(now);
        osc.stop(expirationTime);
        nodes.push(osc);
    } else if (type === 'organ') {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getOrganWave(ctx, preset.drawbars || [8,0,8,0,0,0,0,0,0]));
        osc.frequency.setValueAtTime(f0, now);
        osc.detune.setValueAtTime(randomDetune, now);
        osc.connect(voiceGain);
        osc.start(now);
        osc.stop(expirationTime);
        nodes.push(osc);
    } else {
        const oscConfigs = preset.osc || [{ type: 'sawtooth', gain: 0.5 }];
        let oscGainSum = 0;
        oscConfigs.forEach((o: any) => {
            oscGainSum += (o.gain ?? 0.5);
            const osc = ctx.createOscillator();
            osc.type = o.type;
            osc.frequency.setValueAtTime(f0 * Math.pow(2, o.octave || 0), now);
            const totalDetune = (o.detune || 0) + randomDetune;
            osc.detune.setValueAtTime(totalDetune, now);
            const g = ctx.createGain();
            g.gain.value = o.gain ?? 0.5;
            osc.connect(g).connect(voiceGain);
            osc.start(now);
            osc.stop(expirationTime);
            nodes.push(osc, g);
        });

        let subApplied = 0;
        if (type === 'bass' && preset.sub?.on) {
            const subHz = f0 * Math.pow(2, preset.sub.octave ?? -1);
            if (subHz >= SUB_MIN_HZ) {
                const subOsc = ctx.createOscillator();
                subOsc.type = preset.sub.type || 'sine';
                subOsc.frequency.setValueAtTime(subHz, now);
                subOsc.detune.setValueAtTime(randomDetune, now);
                const sg = ctx.createGain();
                sg.gain.value = preset.sub.gain ?? 0.5;
                subOsc.connect(sg).connect(voiceGain);
                subOsc.start(now);
                subOsc.stop(expirationTime);
                nodes.push(subOsc, sg);
                subApplied = preset.sub.gain ?? 0.5;
            }
        }
        if (type === 'bass' && subApplied > 0) {
            peak *= oscGainSum / (oscGainSum + subApplied);
        }
    }

    let chainHead: AudioNode = voiceGain;
    const driveAmount = type === 'bass' ? 0 : (eventParams?.drive ?? preset.drive?.amount ?? 0);
    const driveType = preset.drive?.type || 'soft';

    if (driveAmount > 0.01) {
        const shaper = ctx.createWaveShaper();
        shaper.curve = getDriveCurve(driveType, driveAmount);
        shaper.oversample = '2x';
        chainHead.connect(shaper);
        chainHead = shaper;
        nodes.push(shaper);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    const isBass = type === 'bass';
    const baseCutoff = isBass
        ? (preset.post?.lpf ?? preset.lpf?.cutoff ?? preset.filter?.cutoff ?? 2000)
        : (preset.post?.lpf || preset.lpf?.cutoff || 2000);

    let finalCutoff = baseCutoff;
    if (isBass && preset.filter?.keyTrack) {
        finalCutoff *= Math.pow(2, (midi - 36) * preset.filter.keyTrack / 12);
    } else if (midi > 60) {
        finalCutoff = baseCutoff * Math.pow(0.92, midi - 60);
    }

    filter.frequency.value = finalCutoff * (isBass ? 1 : tempo / 72);

    if (isBass) {
        filter.Q.value = preset.lpf?.q ?? preset.filter?.q ?? 0.7; 
        // #ЗАЧЕМ: BASS PURITY. Динамическое закрытие фильтра на длинных нотах.
        filter.frequency.setValueAtTime(filter.frequency.value, now);
        filter.frequency.setTargetAtTime(filter.frequency.value * 0.6, now + 0.3, 1.0);
    } else {
        filter.Q.value = type === 'guitar' ? 0.7 : (preset.lpf?.q || 0.7);
    }

    chainHead.connect(filter);
    chainHead = filter;
    nodes.push(filter);

    if (preset.stringNoise?.on && (preset.stringNoise.amount ?? 0) > 0.01) {
        const nz = ctx.createBufferSource();
        nz.buffer = getNoiseBuffer(ctx);
        const nf = ctx.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.value = Math.min(4000, Math.max(600, finalCutoff * 2));
        nf.Q.value = 0.8;
        const ng = ctx.createGain();
        const nPeak = (preset.stringNoise.amount ?? 0) * velocity * 0.08;
        ng.gain.setValueAtTime(0, now);
        ng.gain.linearRampToValueAtTime(nPeak, now + 0.004);
        ng.gain.setTargetAtTime(0, now + 0.004, 0.03);
        nz.connect(nf).connect(ng).connect(chainHead);
        nz.start(now); nz.stop(now + 0.25);
        nodes.push(nz, nf, ng);
    }

    if (sharedDelayNode && (preset.delay?.mix > 0.01 || isDub)) chainHead.connect(sharedDelayNode);
    chainHead.connect(output);

    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(peak * (VOICE_BALANCE[type] || 1.0), now + attackTime);
    voiceGain.gain.setTargetAtTime(peak * adsr.s * (VOICE_BALANCE[type] || 1.0), now + attackTime, Math.max(adsr.d / 3, 0.001));
    voiceGain.gain.setTargetAtTime(0.0001, noteOffTime, releaseTimeConstant);

    const record = { nodes, voiceState: { node: voiceGain, startTime: now }, disposed: false, type, instrumentId, expirationTime };
    globalActiveVoices.add(record);
    return record; 
};

export interface InstrumentAPI {
    connect: (dest?: AudioNode) => void;
    disconnect: () => void;
    noteOn: (midi: number, when?: number, velocity?: number, duration?: number, params?: any) => void;
    allNotesOff: () => void;
    setPreset: (p: any) => void;
    setVolume: (level: number) => void;
    dispose: () => void;
    preset: any;
}

export async function buildMultiInstrument(ctx: AudioContext, {
    type = 'synth',
    preset = {} as any,
    output = ctx.destination
}: { type?: string, preset?: any, output?: AudioNode } = {}): Promise<InstrumentAPI> {
    
    const instrumentId = `inst_${Math.random().toString(36).substr(2, 9)}`;
    let currentPreset = { ...preset };
    const instrumentGain = ctx.createGain();
    instrumentGain.gain.setValueAtTime(isFinite(currentPreset.volume) ? currentPreset.volume : 0.7, ctx.currentTime);

    const panner = ctx.createStereoPanner();
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    // #ЗАЧЕМ: BASS PURITY. Физическая отсечка инфразвука на 42Гц.
    hpf.frequency.value = type === 'bass' ? 42 : 150;

    const mudCut = ctx.createBiquadFilter();
    const isAcoustic = (type === 'guitar' && (currentPreset.name?.includes('Black') || currentPreset.pluckBrightness > 0.8));
    
    mudCut.type = isAcoustic ? 'notch' : 'peaking';
    mudCut.frequency.value = 400; 
    mudCut.Q.value = isAcoustic ? 2.0 : 1.0;
    mudCut.gain.value = isAcoustic ? -6.0 : ((type === 'bass') ? 0 : -3.5); 

    const pure = (BASS_PURITY_CHAIN && type === 'bass') ? currentPreset : null;

    const comp = pure?.comp ? ctx.createDynamicsCompressor() : null;
    const makeup = (comp && isFinite(pure?.comp?.makeup)) ? ctx.createGain() : null;
    const applyComp = (p: any) => {
        if (!comp || !p?.comp) return;
        comp.threshold.value = p.comp.threshold ?? -22;
        comp.ratio.value = p.comp.ratio ?? 2;
        comp.attack.value = p.comp.attack ?? 0.01;
        comp.release.value = p.comp.release ?? 0.2;
        comp.knee.value = 6;
        if (makeup) makeup.gain.value = dbToGain(p.comp.makeup ?? 0);
    };
    applyComp(pure);

    const eqNodes: BiquadFilterNode[] = [];
    if (pure?.eq) {
        const low = ctx.createBiquadFilter();
        const mid = ctx.createBiquadFilter();
        const high = ctx.createBiquadFilter();
        low.type = 'lowshelf'; mid.type = 'peaking'; high.type = 'highshelf';
        eqNodes.push(low, mid, high);
    }
    const applyEq = (p: any) => {
        if (eqNodes.length !== 3 || !p?.eq) return;
        const [low, mid, high] = eqNodes;
        low.frequency.value = p.eq.lowShelf?.freq ?? 80;
        low.gain.value = p.eq.lowShelf?.gain ?? 0;
        mid.frequency.value = p.eq.mid?.freq ?? 800;
        mid.Q.value = p.eq.mid?.q ?? 1.2;
        mid.gain.value = p.eq.mid?.gain ?? 0;
        high.frequency.value = p.eq.highShelf?.freq ?? 2500;
        high.gain.value = p.eq.highShelf?.gain ?? 0;
    };
    applyEq(pure);

    const reverbMix = pure?.reverbMix ?? 0;
    const convolver = reverbMix > 0.001 ? ctx.createConvolver() : null;
    if (convolver) convolver.buffer = getReverbIR(ctx);
    const reverbWet = convolver ? ctx.createGain() : null;
    if (reverbWet) reverbWet.gain.value = reverbMix;

    let head: AudioNode = instrumentGain;
    if (comp) { head.connect(comp); head = comp; }
    if (makeup) { head.connect(makeup); head = makeup; }
    head.connect(hpf);
    head.connect(mudCut);

    let tail: AudioNode = mudCut;
    eqNodes.forEach(n => { tail.connect(n); tail = n; });
    tail.connect(panner);

    if (convolver && reverbWet) {
        panner.connect(output); 
        panner.connect(convolver);
        convolver.connect(reverbWet);
        reverbWet.connect(output);
    } else {
        panner.connect(output);
    }

    const sharedDelay = ctx.createDelay(2.0);
    const feedback = ctx.createGain();
    const delayMix = ctx.createGain();
    sharedDelay.connect(feedback); feedback.connect(sharedDelay);
    sharedDelay.connect(delayMix); delayMix.connect(panner);
    
    const updateFX = () => {
        const now = ctx.currentTime;
        sharedDelay.delayTime.setTargetAtTime(currentPreset.delay?.time || 0.4, now, 0.1);
        feedback.gain.setTargetAtTime(currentPreset.delay?.fb || 0.3, now, 0.1);
        delayMix.gain.setTargetAtTime(currentPreset.delay?.mix || 0, now, 0.1);
    };
    updateFX();

    return {
        preset: currentPreset,
        noteOn: (midi, when = ctx.currentTime, velocity = 1.0, duration = 1.0, params = null) => {
            if (!isFinite(midi) || midi < 0 || midi > 127) return;
            createIndependentVoice(ctx, type, currentPreset, instrumentGain, midi, when, velocity, duration, instrumentId, sharedDelay, params, params?.tempo || 72);
        },
        allNotesOff: () => {
            const voicesToKill = Array.from(globalActiveVoices).filter(v => v.instrumentId === instrumentId);
            voicesToKill.forEach(v => deepCleanup(v));
        },
        setPreset: (p) => {
            currentPreset = { ...p };
            instrumentGain.gain.setTargetAtTime(p.volume || 0.7, ctx.currentTime, 0.05);
            updateFX();
            applyComp(p);
            applyEq(p);
            if (reverbWet) reverbWet.gain.setTargetAtTime(p.reverbMix ?? 0, ctx.currentTime, 0.05);
        },
        setVolume: (v) => { instrumentGain.gain.setTargetAtTime(clamp(v, 0, 1), ctx.currentTime, 0.02); },
        dispose: () => {
            const voicesToKill = Array.from(globalActiveVoices).filter(v => v.instrumentId === instrumentId);
            voicesToKill.forEach(v => deepCleanup(v));
            [instrumentGain, hpf, mudCut, panner, sharedDelay, feedback, delayMix,
             comp, makeup, convolver, reverbWet, ...eqNodes].forEach(n => n?.disconnect());
        },
        disconnect: () => { [instrumentGain, hpf, mudCut, panner, sharedDelay, feedback, delayMix,
             comp, makeup, convolver, reverbWet, ...eqNodes].forEach(n => n?.disconnect()); },
        connect: (dest) => panner.connect(dest || output)
    };
}
