/**
 * @fileOverview Центральная фабрика инструментов V17.5 — "Determinism & Timing Integrity".
 * #ЗАЧЕМ: Аудит-патчи #3502. Исправление техдолга по таймингам, предсказуемости и маршрутизации.
 * #ЧТО:  1. Корректное чтение LPF/Q из пресетов (D1).
 *        2. Исправлена логика ADSR для сверхкоротких нот (D8).
 *        3. Введен ARP-aware лимит на время релиза для экономии голосов (D7).
 *        4. Устранен дублирующийся выход при вызове .connect() (D6).
 *        5. Math.random() заменен на seeded PRNG для полной предсказуемости (D5).
 *        6. Удален мертвый код (D9).
 */

import { dbToGain } from './guitar-loudness';

// ───── AUDIT PATCH 3501/3502 FLAGS ─────
const ENABLE_ROLE_BALANCE = true;
const ENABLE_NON_BASS_REVERB = false;
const ENABLE_RELEASE_CAP = true;


// ───── PATCH D5 (DETERMINISM) HELPERS ─────
const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash32 = (...nums: number[]) => {
  let h = 0x811c9dc5;
  for (const n of nums) { h ^= (n | 0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
const TEXTURE_SEED = 0x9E3779B9;
let instrumentCounter = 0;

// ───── GLOBAL REGISTRY & LIMITS ─────

export let globalActiveVoices = new Set<any>();
let globalVoiceLimit = 128;

const ROLE_ALIASES: Record<string, string> = {
  sparkle: 'sparkles', rhodes: 'pianoAccompaniment', piano: 'pianoAccompaniment'
};
const normalizeRole = (r?: string | null) => (r ? (ROLE_ALIASES[r] ?? r) : null);

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
    Array.from(globalActiveVoices).forEach(v => deepCleanup(v, true));
    Array.from(fadingVoices).forEach(v => hardKill(v));
};

export const deepCleanup = (voiceRecord: any, immediate = false) => {
  if (!voiceRecord || voiceRecord.disposed) return;
  voiceRecord.disposed = true;
  globalActiveVoices.delete(voiceRecord);
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

export const collectExpiredVoices = (audioCtxTime: number) => {
  for (const v of fadingVoices) if (v.hardStopTime <= audioCtxTime) hardKill(v);
  for (const voice of globalActiveVoices) {
    if (voice.expirationTime < audioCtxTime || voice.disposed) deepCleanup(voice, true);
  }
};

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

// D9: Removed dead code `if (type === 'bass')`
const getADSR = (p: any, params?: any, type?: string) => {
    const a = p.adsr || p;
    let rawA = isFinite(params?.attack) ? params.attack : (isFinite(a.a) ? a.a : (isFinite(a.attack) ? a.attack : 0.01));
    let rawD = isFinite(params?.decay) ? params.decay : (isFinite(a.d) ? a.d : (isFinite(a.decay) ? a.decay : 0.1));
    let rawS = isFinite(params?.sustain) ? params.sustain : (isFinite(a.s) ? a.s : (isFinite(a.sustain) ? a.sustain : 0.7));
    let rawR = isFinite(params?.release) ? params.release : (isFinite(a.r) ? a.r : (isFinite(a.release) ? a.release : 0.3));
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
    const rand = mulberry32(TEXTURE_SEED); // D5: Use seeded PRNG
    for (let i = 0; i < len; i++) d[i] = rand() * 2 - 1;
    noiseCache.set(ctx, buf); return buf;
};

const irCache = new WeakMap<AudioContext, AudioBuffer>();
const getReverbIR = (ctx: AudioContext): AudioBuffer => {
    const cached = irCache.get(ctx); if (cached) return cached;
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        const rand = mulberry32(TEXTURE_SEED + ch); // D5: Use seeded PRNG
        for (let i = 0; i < len; i++) {
            const t = i / len;
            d[i] = (rand() * 2 - 1) * Math.pow(1 - t, 2.6);
        }
    }
    irCache.set(ctx, buf); return buf;
};

const BASS_PURITY_CHAIN = true;
const SUB_MIN_HZ = 35;

// D1: Honest filter readers
const readCutoff = (v: any): number | null => {
  if (typeof v === 'number' && isFinite(v) && v > 0) return v;
  if (v && typeof v === 'object' && isFinite(v.cutoff) && v.cutoff > 0) return v.cutoff;
  return null;
};
const resolveBaseCutoff = (p: any): number =>
  readCutoff(p?.post?.lpf) ?? readCutoff(p?.lpf) ?? readCutoff(p?.filter) ?? 2000;

const resolveQ = (p: any): number => {
  const q = (typeof p?.lpf === 'object' ? p.lpf.q : undefined) ?? p?.filter?.q ?? p?.post?.q;
  return isFinite(q) ? clamp(q, 0.0001, 12) : 0.7;
};

// D7: Release cap tables
const RELEASE_CAP_DESKTOP: Record<string, number> = { guitar: 1.6, organ: 0.35, synth: 2.6, bass: 1.2 };
const RELEASE_CAP_MOBILE:  Record<string, number> = { guitar: 0.9, organ: 0.25, synth: 1.6, bass: 0.8 };

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
    tempo: number = 72,
    role: string | null = null,
    extras?: { rand?: () => number } // D5: Pass PRNG
) => {
    const f0 = midiToHz(midi);
    const adsr = getADSR(preset, eventParams, type);
    const now = Math.max(when, ctx.currentTime);
    const rand = extras?.rand ?? Math.random; // D5: Use passed PRNG or fallback

    const isEcho = eventParams?.isEcho === true;
    const isDub = eventParams?.isDub === true;

    // D9: FAST-ATTACK BASS / PHASE-COHERENT START
    // Фазовая когерентность достигается только у нот с одинаковым `when`:
    // осцилляторы стартуют в один и тот же сэмпл с нулевой фазой.
    // Непрерывность фазы между последовательными нотами недостижима без
    // персистентного осциллятора (моно-режим) — вне скоупа.
    const isPhaseLocked = (type === 'bass' && preset.phaseLock !== false);
    
    const humanizeCents = preset.humanize?.pitchCents || 0;
    const randomDetune = (rand() * 2 - 1) * humanizeCents;
    
    let peak = velocity * (isEcho ? 0.65 : 0.45);

    const voiceGain = ctx.createGain();
    const nodes: AudioNode[] = [voiceGain];

    // D8: Robust envelope timing for short notes
    const MIN_EVENT = 0.002;
    const dur = Math.max(duration, 0.02);
    const rawAttack = isPhaseLocked ? 0.002 : adsr.a;
    const attackTime = clamp(Math.min(rawAttack, dur * 0.4), type === 'bass' ? 0.005 : 0.001, 8);
    const decayTau = Math.max(adsr.d / 3, 0.001);
    const noteOffTime = now + Math.max(dur, attackTime + MIN_EVENT);
    const releaseStart = Math.max(noteOffTime, now + attackTime + MIN_EVENT);

    // D7: ARP-aware release cap
    const capTable = globalVoiceLimit <= 60 ? RELEASE_CAP_MOBILE : RELEASE_CAP_DESKTOP;
    const releaseTime = ENABLE_RELEASE_CAP ? Math.min(adsr.r, capTable[type] ?? 2.0) : adsr.r;
    const releaseTau = Math.max(releaseTime / 3, 0.02);
    const expirationTime = releaseStart + releaseTau * 5 + 0.03;


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

    // D1: Use new filter helpers
    const baseCutoff = resolveBaseCutoff(preset);
    filter.Q.value = resolveQ(preset);

    const NYQUIST_SAFE = Math.min(16000, ctx.sampleRate * 0.45);
    let finalCutoff = baseCutoff;
    const isBass = type === 'bass';
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
        filter.frequency.value = finalCutoff;
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

    const balanceKey = (ENABLE_ROLE_BALANCE ? (normalizeRole(role) ?? type) : type);
    const balance = VOICE_BALANCE[balanceKey] ?? 1.0;
    const level = clamp(peak * balance, 0, 1.5);

    // D8: Use new timing for envelope
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(level, now + attackTime);
    voiceGain.gain.setTargetAtTime(level * adsr.s, now + attackTime, decayTau);
    voiceGain.gain.setTargetAtTime(0.0001, releaseStart, releaseTau);

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
    role = null,
    seed // D5: Instrument seed
}: { type?: string, preset?: any, output?: AudioNode, role?: string | null, seed?: number } = {}): Promise<InstrumentAPI> {
    
    // D5: Seeded instrument ID
    const instSeed = isFinite(seed as number)
      ? hash32(seed as number, instrumentCounter++)
      : (Math.random() * 4294967296) >>> 0;
    const instrumentId = `inst_${instSeed.toString(36)}`;
    let noteCounter = 0;

    let currentPreset = { ...preset };
    const instrumentGain = ctx.createGain();
    instrumentGain.gain.setValueAtTime(isFinite(currentPreset.volume) ? currentPreset.volume : 0.7, ctx.currentTime);

    // D6: Routing state
    let currentOut: AudioNode = output;
    let destroyed = false;

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
        // D6: Connect to currentOut, not hardcoded output
        if (want && !reverbActive) { reverbWet.connect(currentOut); reverbActive = true; }
        else if (!want && reverbActive) { try { reverbWet.disconnect(currentOut); } catch {} reverbActive = false; }
    };
    applyReverb(currentPreset);

    let head: AudioNode = instrumentGain;
    if (comp) { head.connect(comp); head = comp; }
    if (makeup) { head.connect(makeup); head = makeup; }
    
    head.connect(hpf);
    hpf.connect(mudCut);

    let tail: AudioNode = mudCut;
    eqNodes.forEach(n => { tail.connect(n); tail = n; });
    tail.connect(panner);
    panner.connect(currentOut); // D6: Connect to currentOut

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

    const killOwn = (immediate: boolean) => {
      Array.from(globalActiveVoices).filter(v => v.instrumentId === instrumentId).forEach(v => deepCleanup(v, immediate));
      Array.from(fadingVoices).filter(v => v.instrumentId === instrumentId).forEach(v => hardKill(v));
    };
    
    // D6: Routing logic
    const routeTo = (dest: AudioNode) => {
      if (destroyed || dest === currentOut) return;
      try { panner.disconnect(currentOut); } catch {}
      if (reverbActive) { try { reverbWet.disconnect(currentOut); } catch {} }
      currentOut = dest;
      panner.connect(currentOut);
      if (reverbActive) reverbWet.connect(currentOut);
    };

    return {
        get preset() { return currentPreset; },
        noteOn: (midi, when = ctx.currentTime, velocity = 1.0, duration = 1.0, params = null) => {
            if (destroyed) return; // D6
            // D5: Create seeded random function for this note
            const noteSeed = hash32(instSeed, noteCounter++, midi, params?.tick ?? 0);
            const rand = mulberry32(noteSeed);

            createIndependentVoice(ctx, type, currentPreset, instrumentGain, midi, when, velocity, duration,
              instrumentId, sharedDelay, params, params?.tempo || 72,
              normalizeRole(params?.role ?? role ?? null), { rand });
        },
        allNotesOff: () => killOwn(false),
        setPreset: (p) => {
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
        dispose: () => {
            destroyed = true; // D6
            killOwn(true);
            [instrumentGain, hpf, mudCut, panner, sharedDelay, feedback, delayMix,
             comp, makeup, convolver, reverbWet, ...eqNodes].forEach(n => n?.disconnect());
            currentOut = null as any; // D6
        },
        disconnect: () => { 
            [instrumentGain, hpf, mudCut, panner, sharedDelay, feedback, delayMix,
             comp, makeup, convolver, reverbWet, ...eqNodes].forEach(n => n?.disconnect()); 
        },
        connect: (dest) => routeTo(dest || output) // D6
    };
}
