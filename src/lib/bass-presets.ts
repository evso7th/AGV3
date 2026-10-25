/**
 * @fileOverview Bass Presets V5.3 — "Pitch Humanisation".
 * #ЗАЧЕМ: Реализация ПЛАНА №3500. Внедрение микро-детонации для баса.
 */

export interface BassPreset {
    type: 'bass';
    name: string;
    volume: number;
    osc: { type: 'sine' | 'triangle'; octave?: number; detune?: number; gain?: number }[];
    sub?: { on: boolean; type?: 'sine' | 'triangle'; octave?: number; gain?: number };
    adsr: { a: number; d: number; s: number; r: number };
    filter?: { type: 'lowpass'; cutoff: number; q: number; keyTrack?: number };
    filterEnv?: { on: boolean; attack: number; decay: number; sustain: number; release: number; depth: number; velocity: number };
    drive?: { on: boolean; type: 'tube' | 'soft' | 'muff' | 'fuzz'; amount: number; tone?: number };
    comp?: { threshold: number; ratio: number; attack: number; release: number; makeup: number };
    eq?: {
      lowShelf?: { freq: number; gain: number };
      mid?: { freq: number; q: number; gain: number };
      highShelf?: { freq: number; gain: number };
    };
    stringNoise?: { on: boolean; type?: 'finger'; amount: number };
    chorus?: { on: boolean; rate: number; depth: number; mix: number };
    delay?: { on: boolean; time: number; fb: number; mix: number; hc?: number };
    reverbMix?: number;
    humanize?: { pitchCents: number }; // #ЗАЧЕМ: Новый параметр гуманизации
  }
  
  const NO_DRIVE: BassPreset['drive'] = { on: false, type: 'tube', amount: 0, tone: 1500 };
  const NO_NOISE: BassPreset['stringNoise'] = { on: false, type: 'finger', amount: 0 };
  const NO_FILTER_ENV: BassPreset['filterEnv'] = { on: false, attack: 0.1, decay: 0.5, sustain: 0.6, release: 0.4, depth: 0, velocity: 0 };
  const NO_CHORUS: BassPreset['chorus'] = { on: false, rate: 0.2, depth: 0.003, mix: 0 };
  const NO_DELAY: BassPreset['delay'] = { on: false, time: 0.3, fb: 0.2, mix: 0, hc: 1400 };

  const SOFT_COMP: BassPreset['comp'] = { threshold: -22, ratio: 1.4, attack: 0.08, release: 0.35, makeup: 0 };

  const ROUND_EQ: BassPreset['eq'] = {
    lowShelf: { freq: 70, gain: 1 },
    mid: { freq: 700, q: 1.1, gain: -3 },
    highShelf: { freq: 2200, gain: -10 },
  };
  
  export const BASS_PRESET_INFO: Record<string, { description: string; color: string } | null> = {
    bass_jazz_warm: { description: 'Warm, round, breathing upright bass.', color: '#A0522D' },
    bass_jazz_fretless: { description: 'Expressive "mwah" fretless, soft attack.', color: '#4682B4' },
    bass_blues: { description: 'Classic blues bass, round and even.', color: '#000080' },
    bass_ambient: { description: 'Deep, slow, atmospheric sub-bass.', color: '#2F4F4F' },
    bass_ambient_dark: { description: 'Very low, rumbling drone.', color: '#191970' },
    bass_trance_acid: { description: 'Deep rolling sub bass.', color: '#FFD700' },
    bass_reggae: { description: 'Deep, round, dubby reggae bass.', color: '#228B22' },
    bass_dub: { description: 'Heavy dub bass with gentle delay.', color: '#556B2F' },
    bass_house: { description: 'Tight, modern sub bass.', color: '#FF69B4' },
    bass_808: { description: 'Classic 808 sub-bass, long decay.', color: '#DC143C' },
    bass_deep_house: { description: 'Warm and groovy deep-house bass.', color: '#9932CC' },
    bass_rock_pick: { description: 'Soft rock bass, edge rolled off.', color: '#B22222' },
    bass_slap: { description: 'Soft jazz bass. Legacy id — no slap.', color: '#A0522D' },
    bass_cs80: { description: 'CS80 pitched down for deep synthetic bass.', color: '#00ced1' },
    classicBass: { description: 'Classic soft bass.', color: '#8B4513' },
    glideBass: { description: 'Ambient sub with slow glide.', color: '#2F4F4F' },
    ambientDrone: { description: 'Deep, evolving drone.', color: '#1A0033' },
    resonantGliss: { description: 'Singing sub bass.', color: '#8B008B' },
    hypnoticDrone: { description: 'Pulsating, wide drone.', color: '#483D8B' },
    livingRiff: { description: 'Soft riffing bass.', color: '#FF4500' },
  };
  
  export const BASS_PRESETS: Record<string, BassPreset> = {
    bass_jazz_warm: {
      type: 'bass', name: 'Jazz Upright', volume: 0.55,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.8 }],
      sub: { on: true, type: 'triangle', octave: -1, gain: 0.3 }, 
      adsr: { a: 0.10, d: 2.0, s: 0.70, r: 1.2 }, 
      filter: { type: 'lowpass', cutoff: 420, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.05,
      humanize: { pitchCents: 3 } // #ЗАЧЕМ: Микро-неточность интонации контрабаса
    },
    bass_slap: {
      type: 'bass', name: 'Soft Jazz (legacy)', volume: 0.52,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.8 }],
      sub: { on: true, type: 'sine', octave: -1, gain: 0.4 },
      adsr: { a: 0.18, d: 2.0, s: 0.65, r: 1.6 },
      filter: { type: 'lowpass', cutoff: 420, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.05,
      humanize: { pitchCents: 3 }
    },
    glideBass: {
      type: 'bass', name: 'Ambient Sub', volume: 0.5,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.7 }, { type: 'sine', octave: -1, detune: 0, gain: 0.5 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.35, d: 2.5, s: 0.8, r: 2.0 },
      filter: { type: 'lowpass', cutoff: 320, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.18,
      humanize: { pitchCents: 2 }
    },
    bass_cs80: {
      type: 'bass', name: 'CS80 Hybrid Bass', volume: 0.5,
      osc: [],
      adsr: { a: 0.2, d: 1.6, s: 0.7, r: 1.5 },
      filter: { type: 'lowpass', cutoff: 450, q: 0.6, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.08,
      humanize: { pitchCents: 4 }
    },
    bass_jazz_fretless: {
      type: 'bass', name: 'Fretless Jaco', volume: 0.52,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.75 }, { type: 'sine', octave: 1, detune: 5, gain: 0.05 }],
      sub: { on: true, type: 'sine', octave: -1, gain: 0.35 },
      adsr: { a: 0.2, d: 1.8, s: 0.7, r: 1.0 },
      filter: { type: 'lowpass', cutoff: 450, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.1,
      humanize: { pitchCents: 5 }
    },
    bass_blues: {
      type: 'bass', name: 'Blues Bass', volume: 0.52,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.8 }, { type: 'triangle', octave: 0, detune: 2, gain: 0.15 }],
      sub: { on: true, type: 'sine', octave: -1, gain: 0.35 },
      adsr: { a: 0.18, d: 1.8, s: 0.65, r: 1.0 },
      filter: { type: 'lowpass', cutoff: 430, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.07,
      humanize: { pitchCents: 4 }
    },
    bass_ambient_dark: {
      type: 'bass', name: 'Dark Ambient', volume: 0.48,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.65 }, { type: 'sine', octave: -1, detune: 0, gain: 0.55 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.6, d: 2.5, s: 0.85, r: 1.5 },
      filter: { type: 'lowpass', cutoff: 300, q: 0.4, keyTrack: 0.05 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP,
      eq: { lowShelf: { freq: 60, gain: 1 }, mid: { freq: 300, q: 0.8, gain: -3 }, highShelf: { freq: 1200, gain: -12 } },
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.25,
      humanize: { pitchCents: 2 }
    },
    bass_trance_acid: {
      type: 'bass', name: 'Rolling Sub', volume: 0.52,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.85 }, { type: 'sine', octave: -1, detune: 0, gain: 0.4 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.16, d: 1.4, s: 0.6, r: 1.2 },
      filter: { type: 'lowpass', cutoff: 400, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.05,
      humanize: { pitchCents: 3 }
    },
    bass_reggae: {
      type: 'bass', name: 'Reggae Bass', volume: 0.55,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.8 }, { type: 'sine', octave: -1, detune: 0, gain: 0.5 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.18, d: 1.6, s: 0.7, r: 1.3 },
      filter: { type: 'lowpass', cutoff: 350, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS,
      delay: { on: true, time: 0.375, fb: 0.25, mix: 0.06, hc: 1200 },
      reverbMix: 0.06,
      humanize: { pitchCents: 3 }
    },
    bass_dub: {
      type: 'bass', name: 'Dub Bass', volume: 0.52,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.75 }, { type: 'sine', octave: -1, detune: 0, gain: 0.55 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.22, d: 2.0, s: 0.75, r: 1.8 },
      filter: { type: 'lowpass', cutoff: 340, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS,
      delay: { on: true, time: 0.5, fb: 0.3, mix: 0.08, hc: 1100 },
      reverbMix: 0.18,
      humanize: { pitchCents: 4 }
    },
    bass_house: {
      type: 'bass', name: 'House Bass', volume: 0.55,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.85 }, { type: 'sine', octave: -1, detune: 0, gain: 0.45 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.16, d: 1.4, s: 0.6, r: 1.2 },
      filter: { type: 'lowpass', cutoff: 380, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.04,
      humanize: { pitchCents: 3 }
    },
    bass_808: {
      type: 'bass', name: '808 Sub', volume: 0.55,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 1.0 }, { type: 'sine', octave: -1, detune: 0, gain: 0.45 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.15, d: 2.5, s: 0.55, r: 1.0 },
      filter: { type: 'lowpass', cutoff: 320, q: 0.4, keyTrack: 0.05 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP,
      eq: { lowShelf: { freq: 55, gain: 1 }, mid: { freq: 300, q: 0.9, gain: -3 }, highShelf: { freq: 1200, gain: -12 } },
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.03,
      humanize: { pitchCents: 2 }
    },
    bass_deep_house: {
      type: 'bass', name: 'Deep House', volume: 0.52,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.8 }, { type: 'sine', octave: -1, detune: 0, gain: 0.45 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.18, d: 1.6, s: 0.65, r: 1.3 },
      filter: { type: 'lowpass', cutoff: 400, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.05,
      humanize: { pitchCents: 3 }
    },
    bass_rock_pick: {
      type: 'bass', name: 'Soft Rock Bass', volume: 0.52,
      osc: [{ type: 'sine', octave: 0, detune: 0, gain: 0.85 }, { type: 'sine', octave: -1, detune: 0, gain: 0.4 }],
      sub: { on: false, type: 'sine', octave: -1, gain: 0 },
      adsr: { a: 0.16, d: 1.4, s: 0.65, r: 1.2 },
      filter: { type: 'lowpass', cutoff: 450, q: 0.5, keyTrack: 0.1 },
      filterEnv: NO_FILTER_ENV, drive: NO_DRIVE, comp: SOFT_COMP, eq: ROUND_EQ,
      stringNoise: NO_NOISE, chorus: NO_CHORUS, delay: NO_DELAY, reverbMix: 0.05,
      humanize: { pitchCents: 5 }
    },
  };
