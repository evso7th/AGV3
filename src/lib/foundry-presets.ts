/**
 * @fileOverview Foundry Presets Library V2.5 — "Unique Registry Fix".
 * #ЗАЧЕМ: Устранение затенения (shadowing) через префиксы 'fo_'.
 */

export const FOUNDRY_PRESETS = {
  fo_synth: { 
    type: 'synth',
    name: 'Industrial Pulse Pad',
    volume: 0.75, 
    osc: [
      { type: 'sawtooth', detune: 0, octave: 0, gain: 0.8 }, 
      { type: 'sine', detune: 0, octave: -1, gain: 0.45 } 
    ],
    noise: { on: false },
    adsr: { a: 0.15, d: 0.4, s: 0.5, r: 0.32 }, 
    lpf: { cutoff: 2200, q: 1.5 }, 
    lfo: { rate: 0.4, amount: 600, target: 'filter' },
    drive: { type: 'fuzz', amount: 0.55 },
    reverbMix: 0.08
  },

  fo_synth_ambient_pad_lush: {
    type: 'synth',
    name: 'Stable Steel Pad',
    volume: 0.72, 
    osc: [
      { type: 'sawtooth', detune: 0, octave: 0, gain: 0.7 },
      { type: 'sine', detune: 0, octave: -1, gain: 0.5 }
    ],
    adsr: { a: 0.8, d: 1.2, s: 0.6, r: 0.6 }, 
    lpf: { cutoff: 950, q: 1.2 }, 
    lfo: { rate: 0.1, amount: 200, target: 'filter' },
    drive: { type: 'fuzz', amount: 0.35 },
    reverbMix: 0.12
  },

  fo_organ: {
    type: 'organ',
    name: 'Industrial B3 (Dirty)',
    volume: 0.65, 
    drawbars: [8, 8, 8, 5, 0, 0, 0, 0, 0],
    adsr: { a: 0.05, d: 0.1, s: 0.85, r: 0.45 }, 
    lpf: 3200,
    reverbMix: 0.08,
    drive: { type: 'soft', amount: 0.75 },
    leslie: { rate: 5.8, pitchDepth: 0.00005, ampDepth: 0.06, driftPct: 0.12, driftRate: 0.2 },
    humanize: { detuneCents: 2.0, levelPct: 0.05, brightnessPct: 0.08 }
  },

  fo_organ_soft_jazz: {
    type: 'organ',
    name: 'Gritty Jazz B3',
    volume: 0.62,
    drawbars: [8, 0, 8, 4, 2, 0, 0, 0, 0],
    lpf: 2400,
    adsr: { a: 0.03, d: 0.1, s: 0.7, r: 0.4 }, 
    reverbMix: 0.08,
    drive: { type: 'soft', amount: 0.45 },
    leslie: { rate: 5.2, pitchDepth: 0.00005, ampDepth: 0.04, driftPct: 0.15, driftRate: 0.15 },
    humanize: { detuneCents: 2.0, levelPct: 0.05, brightnessPct: 0.06 }
  },

  fo_guitar_clean: {
    type: 'guitar',
    name: 'Clean Guitar',
    volume: 0.75, 
    osc: { width: 0.42 },
    adsr: { a: 0.005, d: 0.25, s: 0.6, r: 0.6 }, 
    lpf: 5000, 
    pluckBrightness: 0.8,
    reverbMix: 0
  },

  fo_guitar_shineOn: {
    type: 'guitar',
    name: 'Shine On Lead',
    volume: 0.60, 
    osc: { width: 0.46 },
    drive: { type: 'muff', amount: 0.55 },
    post: { lpf: 5000 }, 
    adsr: { a: 0.020, d: 0.35, s: 0.65, r: 1.5 }, 
    delay: { time: 0.42, fb: 0.28, mix: 0.18 },
    reverbMix: 0.08,
    attackTransient: 0.12,
    pluckBrightness: 0.9,
    vibrato: { rate: 5.0, depthCents: 8, delay: 0.40 },
    calibrationTrimDb: 7.54
  },

  fo_guitar_muffLead: {
    type: 'guitar',
    name: 'Muff Lead (Warm Grit)',
    volume: 0.55, 
    osc: { width: 0.45 },
    drive: { type: 'muff', amount: 0.65 },
    post: { lpf: 4200 },
    adsr: { a: 0.020, d: 0.4, s: 0.55, r: 1.0 }, 
    delay: { time: 0.30, fb: 0.18, mix: 0.10 },
    reverbMix: 0.08,
    attackTransient: 0.10,
    pluckBrightness: 0.5,
    vibrato: { rate: 5.5, depthCents: 10, delay: 0.30 },
    calibrationTrimDb: 3.13
  },

  fo_synth_cave_pad: {
    type: 'synth',
    name: 'Industrial Abyssal Wall',
    volume: 0.78,
    osc: [
      { type: 'sawtooth', detune: -15, octave: -2, gain: 0.7 },
      { type: 'square', detune: 15, octave: -2, gain: 0.6 },
      { type: 'sine', detune: 0, octave: -3, gain: 0.9 }
    ],
    adsr: { a: 1.5, d: 2.5, s: 0.9, r: 1.75 },
    lpf: { cutoff: 600, q: 3.0 },
    drive: { type: 'fuzz', amount: 0.75 },
    reverbMix: 0.25
  },

  fo_ep_rhodes_warm: {
    type: 'synth',
    name: 'Warm Rhodes',
    volume: 0.72,
    osc: [
      { type: 'sine', octave: 0, detune: 0, gain: 0.6 },
      { type: 'triangle', octave: 1, detune: 0, gain: 0.15 }
    ],
    adsr: { a: 0.01, d: 0.25, s: 0.5, r: 0.5 }, 
    lpf: { cutoff: 2800, q: 0.7 }, 
    reverbMix: 0.08
  }
};
