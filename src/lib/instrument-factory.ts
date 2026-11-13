/**
 * @fileOverview Центральная фабрика инструментов V17.4 — "Signal Path Integrity".
 * #ЗАЧЕМ: Аудит-патч #3501. Исправление шести критических дефектов в сигнальном тракте и логике.
 * #ЧТО:  1. HPF теперь в цепи, а не параллельно.
 *        2. `setPreset` пересчитывает тон (notch/peaking) и реверб.
 *        3. Key-track исправлен (не инвертирован), зависимость от темпа убрана.
 *        4. Drive-кривая нормализована по громкости.
 *        5. Voice stealing использует fade-out 15мс, а не hard-stop.
 *        6. Баланс громкости и приоритеты ARP теперь зависят от РОЛИ, а не типа инструмента.
 */

import { dbToGain } from './guitar-loudness';

// ───── AUDIT PATCH 3501 FLAGS ─────
const ENABLE_ROLE_BALANCE = true;
const ENABLE_NON_BASS_REVERB = false; // ⚠️ CPU: конволвер на инструмент. Включать после замеров.

// ───── GLOBAL REGISTRY & LIMITS ─────

export let globalActiveVoices = new Set<any>();
let globalVoiceLimit = 128;

// PATCH B3 HELPERS
const ROLE_ALIASES: Record<string, string> = {
  sparkle: 'sparkles', rhodes: 'pianoAccompaniment', piano: 'pianoAccompaniment'
};
const normalizeRole = (r?: string | null) => (r ? (ROLE_ALIASES[r] ?? r) : null);

// PATCH B4 HELPERS
const STEAL_FADE_SEC = 0.015;
const fadingVoices = new Set<any>();

const hardKill = (v: any) => {
  if (!v) return;
  if (v.nodes) {
    v.nodes.forEach((n: any) => {
      try {
        if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) { n.onended = null; n.stop(); }
        n.disconnect();
      } catch (e) {}
    });
  }
  v.nodes = null; v.voiceState = null; v.instrumentId = null;
  fadingVoices.delete(v); globalActiveVoices.delete(v);
};


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
  bass: 0.75, // Было 0.375, но без sub-компенсации это слишком тихо.
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
    Array.from(globalActiveVoices).forEach(v => deepCleanup(v, true));
    Array.from(fadingVoices).forEach(v => hardKill(v));
};

// PATCH B4: Fade-out logic for voice stealing
export const deepCleanup = (voiceRecord: any, immediate = false) => {
  if (!voiceRecord || voiceRecord.disposed) return;
  voiceRecord.disposed = true;
  globalActiveVoices.delete(voiceRecord); // Квота освобождается СРАЗУ
  const gain: GainNode | null = voiceRecord.voiceState?.node ?? null;
  const ctx: AudioContext | null = voiceRecord.ctx ?? null;
  if (immediate || !gain || !ctx) { hardKill(voiceRecord); return; }
  const t = ctx.currentTime;
  const stopAt = t + STEAL_FADE_SEC;
  try {
    const g = gain.gain, cur = g.value;
    g.cancelScheduledValues(t);
    g.setValueAtTime(cur, t);
    g.linearRampToValueAtTime(0, stopAt);
  } catch (e) { hardKill(voiceRecord); return; }
  voiceRecord.nodes?.forEach((n: any) => {
    try {
      if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) { n.onended = null; n.stop(stopAt + 0.005); }
    } catch (e) {}
  });
  voiceRecord.hardStopTime = stopAt + 0.02;
  fadingVoices.add(voiceRecord);
};

// PATCH B4: Garbage collection for fading voices
export const collectExpiredVoices = (audioCtxTime: number) => {
  for (const v of fadingVoices) if (v.hardStopTime <= audioCtxTime) hardKill(v);
  for (const voice of globalActiveVoices) {
    if (voice.expirationTime < audioCtxTime || voice.disposed) deepCleanup(voice, true);
  }
};

// PATCH B3: Use role for priority
export const enforceVoiceLimit = () => {
    if (globalActiveVoices.size <= globalVoiceLimit) return;
    const toKillCount = globalActiveVoices.size - globalVoiceLimit;
    const allVoices = Array.from(globalActiveVoices).filter(v => !v.disposed);
    allVoices.sort((a, b) => {
        const prioA = STEAL_PRIORITY[a.role ?? a.type] ?? 1;
        const prioB = STEAL_PRIORITY[b.role ?? b.type] ?? 1;
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

// PATCH B6: Normalized drive curve
const curveCache = new Map<string, Float32Array>();
const DRIVE_REF_LEVEL = 0.45;
const shapeAt = (type: string, x: number, k: number) =>
  type === 'muff' ? Math.tanh(x * k) : x / (1 + k * Math.abs(x));

const getDriveCurve = (type: string, amount: number): Float32Array => {
  const q = Math.round(amount * 100) / 100;
  const key = `${type}:${q}:norm2`;
  const hit = curveCache.get(key); if (hit) return hit;
  const n = 4096, c = new Float32Array(n);
  const k = type === 'muff' ? 1 + q * 6 : q * 4;
  const refOut = shapeAt(type, DRIVE_REF_LEVEL, k);
  const norm = refOut > 1e-6 ? DRIVE_REF_LEVEL / refOut : 1;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = clamp(shapeAt(type, x, k) * norm, -1.5, 1.5);
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
    tempo: number = 72, // #PATCH_B2: Сохранён для совместимости, на тембр не влияет.
    role: string | null = null // PATCH B3: Role from instrument manager
) => {
    const f0 = midiToHz(midi);
    const adsr = getADSR(preset, eventParams, type);
    const now = Math.max(when, ctx.currentTime);

    const isEcho = eventParams?.isEcho === true;
    const isDub = eventParams?.isDub === true;

    const isPhaseLocked = (type === 'bass' && preset.phaseLock !== false);
    const attackTime = isPhaseLocked ? 0.002 : adsr.a;
    
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

        // Sub-oscillator logic (unchanged by patches)
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
        shaper.curve = getDriveCurve(driveType, driveAmount); // Uses PATCH B6
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

    // This block is from the successfully applied PATCH B2
    const NYQUIST_SAFE = Math.min(16000, ctx.sampleRate * 0.45);
    let finalCutoff = baseCutoff;
    if (isBass) {
        const kt = preset.filter?.keyTrack;
        if (kt) finalCutoff *= Math.pow(2, (midi - 36) * kt / 12);
    } else {
        const kt = preset.lpf?.keyTrack ?? preset.filter?.keyTrack ?? 0.5;
        finalCutoff = baseCutoff * Math.pow(2, (midi - 60) * kt / 12);
    }
    finalCutoff = clamp(finalCutoff, 60, NYQUIST_SAFE);

    if (isBass) {
        filter.frequency.setValueAtTime(finalCutoff, now);
        filter.frequency.setTargetAtTime(finalCutoff * 0.6, now + 0.3, 1.2);
    } else {
        filter.frequency.value = finalCutoff; // Tempo multiplier removed by PATCH B2
    }

    if (isBass) {
        filter.Q.value = preset.lpf?.q ?? preset.filter?.q ?? 0.7; 
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

    // PATCH B3: Use role-based balance
    const balanceKey = (ENABLE_ROLE_BALANCE ? (normalizeRole(role) ?? type) : type);
    const balance = VOICE_BALANCE[balanceKey] ?? 1.0;
    const level = clamp(peak * balance, 0, 1.5);

    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(level, now + attackTime);
    voiceGain.gain.setTargetAtTime(level * adsr.s, now + attackTime, Math.max(adsr.d / 3, 0.001));
    voiceGain.gain.setTargetAtTime(0.0001, noteOffTime, releaseTimeConstant);

    // PATCH B3 & B4: Add role and ctx to the record
    const record = { nodes, voiceState: { node: voiceGain, startTime: now }, disposed: false,
                     type, role: balanceKey, instrumentId, expirationTime, ctx };
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
    readonly preset: any;
}

const HPF_BY_TYPE: Record<string, number> = { bass: 42, guitar: 80, organ: 60, synth: 120 };

export async function buildMultiInstrument(ctx: AudioContext, {
    type = 'synth',
    preset = {} as any,
    output = ctx.destination,
    role = null // PATCH B3: Role from config
}: { type?: string, preset?: any, output?: AudioNode, role?: string | null } = {}): Promise<InstrumentAPI> {
    
    const instrumentId = `inst_${Math.random().toString(36).substr(2, 9)}`;
    let currentPreset = { ...preset };
    const instrumentGain = ctx.createGain();
    instrumentGain.gain.setValueAtTime(isFinite(currentPreset.volume) ? currentPreset.volume : 0.7, ctx.currentTime);

    const panner = ctx.createStereoPanner();
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    
    const mudCut = ctx.createBiquadFilter();
    
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

    const resolveHpf = (p: any) => {
        const v = Number(p?.hpf);
        return isFinite(v) && v > 0 ? clamp(v, 20, 400) : (HPF_BY_TYPE[type] ?? 150);
    };

    const applyTone = (p: any) => {
        const now = ctx.currentTime;
        const acoustic = type === 'guitar' && (
            p?.body === 'acoustic' || p?.name?.includes('Black') || (p?.pluckBrightness ?? 0) > 0.8
        );
        mudCut.type = acoustic ? 'notch' : 'peaking';
        mudCut.frequency.setTargetAtTime(400, now, 0.03);
        mudCut.Q.setTargetAtTime(acoustic ? 2.0 : 1.0, now, 0.03);
        mudCut.gain.setTargetAtTime(acoustic ? -6.0 : (type === 'bass' ? 0 : -3.5), now, 0.03);
        hpf.frequency.setTargetAtTime(resolveHpf(p), now, 0.03);
    };
    applyTone(currentPreset);

    const convolver = ctx.createConvolver();
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0;
    panner.connect(convolver);
    convolver.connect(reverbWet);
    let reverbActive = false;

    const applyReverb = (p: any) => {
        const allowed = ENABLE_NON_BASS_REVERB || type === 'bass';
        const mix = allowed ? (p?.reverbMix ?? 0) : 0;
        const want = isFinite(mix) && mix > 0.001;
        if (want && !convolver.buffer) convolver.buffer = getReverbIR(ctx);
        reverbWet.gain.setTargetAtTime(want ? mix : 0, ctx.currentTime, 0.05);
        if (want && !reverbActive) { reverbWet.connect(output); reverbActive = true; }
        else if (!want && reverbActive) { try { reverbWet.disconnect(output); } catch {} reverbActive = false; }
    };
    applyReverb(currentPreset);

    let head: AudioNode = instrumentGain;
    if (comp) { head.connect(comp); head = comp; }
    if (makeup) { head.connect(makeup); head = makeup; }
    
    // This is from PATCH B1
    head.connect(hpf);
    hpf.connect(mudCut);

    let tail: AudioNode = mudCut;
    eqNodes.forEach(n => { tail.connect(n); tail = n; });
    tail.connect(panner);
    panner.connect(output);

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

    // PATCH B4: Helper for cleanup
    const killOwn = (immediate: boolean) => {
      Array.from(globalActiveVoices).filter(v => v.instrumentId === instrumentId).forEach(v => deepCleanup(v, immediate));
      Array.from(fadingVoices).filter(v => v.instrumentId === instrumentId).forEach(v => hardKill(v));
    };

    return {
        get preset() { return currentPreset; }, // From PATCH B8
        noteOn: (midi, when = ctx.currentTime, velocity = 1.0, duration = 1.0, params = null) => {
            if (!isFinite(midi) || midi < 0 || midi > 127) return;
            // PATCH B3: pass role down to voice
            createIndependentVoice(ctx, type, currentPreset, instrumentGain, midi, when, velocity, duration,
              instrumentId, sharedDelay, params, params?.tempo || 72,
              normalizeRole(params?.role ?? role ?? null));
        },
        allNotesOff: () => killOwn(false), // From PATCH B4
        setPreset: (p) => { // From PATCH B8
            const prevVolume = currentPreset?.volume;
            currentPreset = { ...p };
            const vol = isFinite(p?.volume) ? p.volume : (isFinite(prevVolume) ? prevVolume : 0.7);
            instrumentGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
            applyTone(currentPreset);
            applyReverb(currentPreset);
            updateFX();
            applyComp(p);
            applyEq(p);
        },
        setVolume: (v) => { instrumentGain.gain.setTargetAtTime(clamp(v, 0, 1), ctx.currentTime, 0.02); },
        dispose: () => { // From PATCH B4
            killOwn(true);
            [instrumentGain, hpf, mudCut, panner, sharedDelay, feedback, delayMix,
             comp, makeup, convolver, reverbWet, ...eqNodes].forEach(n => n?.disconnect());
        },
        disconnect: () => { 
            [instrumentGain, hpf, mudCut, panner, sharedDelay, feedback, delayMix,
             comp, makeup, convolver, reverbWet, ...eqNodes].forEach(n => n?.disconnect()); 
        },
        connect: (dest) => panner.connect(dest || output)
    };
}
