/**
 * @fileOverview Foundry Presets Library V3.5 — "Imperial Heavy Standard".
 * #ЗАЧЕМ: Реализация ПЛАНА F1 + 3506. Полная нормализация громкости и тембров.
 * 
 * INERT до PATCH 3503/3507: attackTransient, vibrato, leslie,
 * calibrationTrimDb, noise, humanize.detuneCents/levelPct/brightnessPct,
 * reverbMix (не-bass), lfo (до 3506), cab/mud/drive.preGain (до 3506).
 */

export const FOUNDRY_PRESETS = {
  // ───── PADS & SYNTHS (Dynamic Group: dynamicPad) ─────
  fosynth: { 
    type: 'synth',
    name: 'Industrial Pulse Pad',
    volume: 0.68, 
    osc: [
      { type: 'sawtooth', detune: 0, octave: 0, gain: 0.8 }, 
      { type: 'sine', detune: 0, octave: -1, gain: 0.45 } 
    ],
    noise: { on: false },
    adsr: { a: 0.04, d: 0.35, s: 0.65, r: 0.45 }, 
    lpf: { cutoff: 3200, q: 1.8, keyTrack: 0.35 }, 
    hpf: 55,
    humanize: { pitchCents: 4 },
    drive: { type: 'muff', amount: 0.75 },
    calibrationTrimDb: 0,
    reverbMix: 0.08
  },

  fosynthambientpadlush: {
    type: 'synth',
    name: 'Stable Steel Pad',
    volume: 0.66, 
    osc: [
      { type: 'sawtooth', detune: 0, octave: 0, gain: 0.7 },
      { type: 'sine', detune: 0, octave: -1, gain: 0.5 }
    ],
    adsr: { a: 0.8, d: 1.2, s: 0.7, r: 0.9 }, 
    lpf: { cutoff: 2400, q: 1.2, keyTrack: 0.35 }, 
    hpf: 65,
    humanize: { pitchCents: 3 },
    drive: { type: 'muff', amount: 0.55 }, 
    calibrationTrimDb: 0,
    reverbMix: 0.12
  },

  fosynthcavepad: {
    type: 'synth',
    name: 'Industrial Abyssal Wall',
    volume: 0.62,
    osc: [
      { type: 'sawtooth', detune: -15, octave: -2, gain: 0.7 },
      { type: 'square', detune: 15, octave: -2, gain: 0.6 },
      { type: 'sine', detune: 0, octave: -1, gain: 0.55 } // #ЗАЧЕМ: Перенос с -3 на -1 для HPF
    ],
    adsr: { a: 1.4, d: 1.5, s: 0.75, r: 1.6 },
    lpf: { cutoff: 1600, q: 1.6, keyTrack: 0.3 },
    hpf: 40,
    humanize: { pitchCents: 2 },
    drive: { type: 'muff', amount: 0.85 },
    calibrationTrimDb: 0,
    reverbMix: 0.25
  },

  // ───── ORGANS (Dynamic Group: dynamicOrgan) ─────
  foorgan: {
    type: 'organ',
    name: 'Industrial B3 (Dirty)',
    volume: 0.52, 
    drawbars: [8, 8, 8, 5, 0, 0, 0, 0, 0],
    adsr: { a: 0.006, d: 0.05, s: 0.95, r: 0.10 }, 
    lpf: { cutoff: 2800, q: 0.9, keyTrack: 0 },
    hpf: 50,
    humanize: { pitchCents: 3, detuneCents: 2.5 },
    drive: { type: 'plexi', amount: 0.55, preGain: 1.6, asym: 0.18 },
    calibrationTrimDb: 0,
    reverbMix: 0.08,
    leslie: { rate: 7.5, pitchDepth: 0.0001, ampDepth: 0.12, driftPct: 0.15, driftRate: 0.3 }
  },

  foorgansoftjazz: {
    type: 'organ',
    name: 'Industrial Soft Jazz',
    volume: 0.46,
    drawbars: [8, 0, 8, 4, 2, 0, 0, 0, 0],
    lpf: { cutoff: 2200, q: 0.8, keyTrack: 0 },
    hpf: 50,
    humanize: { pitchCents: 3 },
    adsr: { a: 0.006, d: 0.05, s: 0.95, r: 0.10 }, 
    drive: { type: 'soft', amount: 0.35 },
    calibrationTrimDb: 0,
    reverbMix: 0.08
  },

  // ───── GUITARS ─────
  foguitarclean: {
    type: 'guitar',
    name: 'Industrial Clean',
    volume: 0.58, 
    osc: { width: 0.44 },
    lpf: { keyTrack: 0 },
    hpf: 85,
    humanize: { pitchCents: 5 },
    adsr: { a: 0.006, d: 0.90, s: 0.30, r: 0.50 }, 
    pluckBrightness: 0.75, // #ЗАЧЕМ: Снятие notch 400Hz
    calibrationTrimDb: 0,
    cab: {},
    reverbMix: 0.05
  },

  foguitarshineon: {
    type: 'guitar',
    name: 'Industrial Shine Lead',
    volume: 0.72, 
    osc: { width: 0.48 },
    drive: { type: 'plexi', amount: 0.70, preGain: 2.0, asym: 0.14 },
    post: { lpf: 4300 }, 
    lpf: { keyTrack: 0 },
    hpf: 85,
    humanize: { pitchCents: 6 },
    adsr: { a: 0.010, d: 0.35, s: 0.72, r: 1.00 },
    delay: { time: 0.35, fb: 0.30, mix: 0.20 },
    pluckBrightness: 0.78,
    calibrationTrimDb: 0,
    cab: {},
    mud: { freq: 420, gainDb: 0, q: 1 },
    reverbMix: 0.1
  },

  foguitar_muffLead: {
    type: 'guitar',
    name: 'Industrial Muff Lead',
    volume: 0.75, 
    osc: { width: 0.50 },
    drive: { type: 'fuzz', amount: 0.80, preGain: 2.6, asym: 0.06 },
    post: { lpf: 4200 },
    lpf: { keyTrack: 0 },
    hpf: 85,
    humanize: { pitchCents: 8 },
    adsr: { a: 0.008, d: 0.40, s: 0.70, r: 0.90 },
    delay: { time: 0.28, fb: 0.20, mix: 0.15 },
    pluckBrightness: 0.70,
    calibrationTrimDb: 0,
    cab: { bodyDb: 5 },
    mud: { freq: 420, gainDb: 0, q: 1 },
    reverbMix: 0.1
  },

  foeprhodeswarm: {
    type: 'synth',
    name: 'Industrial Rhodes',
    volume: 0.36, 
    osc: [
      { type: 'sine', octave: 0, detune: 0, gain: 0.6 },
      { type: 'triangle', octave: 1, detune: 0, gain: 0.2 }
    ],
    adsr: { a: 0.005, d: 1.4, s: 0.25, r: 0.4 }, 
    lpf: { cutoff: 3000, q: 0.8, keyTrack: 0.3 }, 
    hpf: 70,
    humanize: { pitchCents: 3 },
    drive: { type: 'soft', amount: 0.45 },
    calibrationTrimDb: 0,
    reverbMix: 0.08
  }
};
