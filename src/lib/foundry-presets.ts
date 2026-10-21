/**
 * @fileOverview Foundry Presets Library V2.6 — "The Mincer Edition".
 * #ЗАЧЕМ: Устранение конфликтов имен и радикальный подъем яркости фильтров.
 */

export const FOUNDRY_PRESETS = {
  fosynth: { 
    type: 'synth',
    name: 'Industrial Pulse Pad',
    volume: 0.95, 
    osc: [
      { type: 'sawtooth', detune: 0, octave: 0, gain: 0.8 }, 
      { type: 'sine', detune: 0, octave: -1, gain: 0.45 } 
    ],
    noise: { on: false },
    adsr: { a: 0.05, d: 0.3, s: 0.6, r: 0.3 }, 
    lpf: { cutoff: 3200, q: 2.5 }, 
    lfo: { rate: 0.4, amount: 800, target: 'filter' },
    drive: { type: 'fuzz', amount: 0.65 },
    reverbMix: 0.08
  },

  fosynthambientpadlush: {
    type: 'synth',
    name: 'Stable Steel Pad',
    volume: 0.9, 
    osc: [
      { type: 'sawtooth', detune: 0, octave: 0, gain: 0.7 },
      { type: 'sine', detune: 0, octave: -1, gain: 0.5 }
    ],
    adsr: { a: 0.8, d: 1.2, s: 0.7, r: 0.8 }, 
    lpf: { cutoff: 1800, q: 1.5 }, 
    lfo: { rate: 0.1, amount: 400, target: 'filter' },
    drive: { type: 'fuzz', amount: 0.45 },
    reverbMix: 0.12
  },

  foorgan: {
    type: 'organ',
    name: 'Industrial B3 (Dirty)',
    volume: 0.85, 
    drawbars: [8, 8, 8, 5, 0, 0, 0, 0, 0],
    adsr: { a: 0.01, d: 0.1, s: 0.9, r: 0.4 }, 
    lpf: 4200,
    reverbMix: 0.08,
    drive: { type: 'soft', amount: 0.85 },
    leslie: { rate: 6.2, pitchDepth: 0.0001, ampDepth: 0.1, driftPct: 0.12, driftRate: 0.2 }
  },

  foorgansoftjazz: {
    type: 'organ',
    name: 'Gritty Jazz B3',
    volume: 0.8,
    drawbars: [8, 0, 8, 4, 2, 0, 0, 0, 0],
    lpf: 2800,
    adsr: { a: 0.01, d: 0.1, s: 0.8, r: 0.4 }, 
    reverbMix: 0.08,
    drive: { type: 'soft', amount: 0.65 }
  },

  foguitarclean: {
    type: 'guitar',
    name: 'Industrial Clean',
    volume: 0.85, 
    osc: { width: 0.42 },
    adsr: { a: 0.005, d: 0.25, s: 0.6, r: 0.6 }, 
    lpf: 6000, 
    pluckBrightness: 0.9,
    reverbMix: 0.05
  },

  foguitarshineon: {
    type: 'guitar',
    name: 'Industrial Shine Lead',
    volume: 0.75, 
    osc: { width: 0.46 },
    drive: { type: 'muff', amount: 0.75 },
    post: { lpf: 5500 }, 
    adsr: { a: 0.02, d: 0.35, s: 0.75, r: 1.5 }, 
    delay: { time: 0.35, fb: 0.3, mix: 0.2 },
    reverbMix: 0.1,
    attackTransient: 0.15,
    pluckBrightness: 1.0,
    calibrationTrimDb: 8.5
  },

  foguitarmufflead: {
    type: 'guitar',
    name: 'Industrial Muff Lead',
    volume: 0.82, 
    osc: { width: 0.5 },
    drive: { type: 'muff', amount: 0.95 },
    post: { lpf: 4800 },
    adsr: { a: 0.02, d: 0.4, s: 0.7, r: 1.0 }, 
    delay: { time: 0.28, fb: 0.2, mix: 0.15 },
    reverbMix: 0.1,
    attackTransient: 0.12,
    pluckBrightness: 0.7,
    calibrationTrimDb: 4.5
  },

  fosynthcavepad: {
    type: 'synth',
    name: 'Industrial Abyssal Wall',
    volume: 0.95,
    osc: [
      { type: 'sawtooth', detune: -15, octave: -2, gain: 0.7 },
      { type: 'square', detune: 15, octave: -2, gain: 0.6 },
      { type: 'sine', detune: 0, octave: -3, gain: 0.9 }
    ],
    adsr: { a: 1.0, d: 2.0, s: 0.8, r: 1.5 },
    lpf: { cutoff: 1200, q: 3.5 },
    drive: { type: 'fuzz', amount: 0.85 },
    reverbMix: 0.25
  },

  foeprhodeswarm: {
    type: 'synth',
    name: 'Industrial Rhodes',
    volume: 0.88,
    osc: [
      { type: 'sine', octave: 0, detune: 0, gain: 0.6 },
      { type: 'triangle', octave: 1, detune: 0, gain: 0.2 }
    ],
    adsr: { a: 0.01, d: 0.2, s: 0.6, r: 0.5 }, 
    lpf: { cutoff: 3500, q: 1.0 }, 
    drive: { type: 'soft', amount: 0.4 },
    reverbMix: 0.08
  }
};
