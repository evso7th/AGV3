/**
 * @fileOverview Единый пульт управления громкостью AuraGroove.
 * #ЗАЧЕМ: ПЛАН №4000. Single Source of Truth для всей цепочки усиления.
 */

import type { Genre, SoundMix, InstrumentPart } from '@/types/music';

export const MIXER_SETTINGS = {
  /**
   * 1. Уровень калибровки "железа" (Preamp).
   * Эти значения компенсируют разницу в записи сэмплов.
   */
  samplerDefaults: {
    master: 0.85,
    acoustic: 0.15, 
    electric: 0.15, 
    piano: 0.75,
    orchestral: 0.5, 
    chords: 1.2,
    bass: 1.0,
    cs80: 0.4
  },

  /**
   * 2. Баланс ролей (Per-Voice Multiplier).
   * Применяется фабрикой на уровне каждой ноты для создания иерархии в миксе.
   */
  roleBalance: {
    bass: 0.75,
    melody: 1.50,
    accompaniment: 1.50,
    drums: 0.50,
    sparkles: 0.80,
    sfx: 0.40,
    harmony: 0.60,
    pianoAccompaniment: 0.50,
  } as Record<string, number>,

  /**
   * 3. Жанровый баланс (Default Slider Positions).
   * Эти значения устанавливают положение фейдеров в микшере.
   */
  genreBalance: {
    default: {
      bass: 0.5,
      melody: 0.5,
      accompaniment: 0.5,
      drums: 0.5,
      sparkles: 0.5,
      sfx: 0.5,
      harmony: 0.5,
      pianoAccompaniment: 0.5,
    },
    foundry: {
      bass: 0.5,
      melody: 0.5,
      accompaniment: 0.5,
      drums: 0.5,
      sparkles: 0.5,
      sfx: 0.5,
      harmony: 0.5,
      pianoAccompaniment: 0.3,
    },
    ambient: {
      bass: 0.5,
      melody: 0.5,
      accompaniment: 0.5,
      drums: 0.5,
      sparkles: 0.5,
      sfx: 0.5,
      harmony: 0.5,
      pianoAccompaniment: 0.5,
    },
    blues: {
      bass: 0.5,
      melody: 0.5,
      accompaniment: 0.5,
      drums: 0.5,
      sparkles: 0.5,
      sfx: 0.5,
      harmony: 0.5,
      pianoAccompaniment: 0.5,
    },
    cyber_blues: {
      bass: 0.5,
      melody: 0.5,
      accompaniment: 0.5,
      drums: 0.5,
      sparkles: 0.5,
      sfx: 0.5,
      harmony: 0.5,
      pianoAccompaniment: 0.5,
    },
    reggae: {
      bass: 0.5,
      melody: 0.5,
      accompaniment: 0.5,
      drums: 0.5,
      sparkles: 0.5,
      sfx: 0.5,
      harmony: 0.5,
      pianoAccompaniment: 0.5,
    },
    psybient: {
      bass: 0.5,
      melody: 0.5,
      accompaniment: 0.5,
      drums: 0.5,
      sparkles: 0.5,
      sfx: 0.5,
      harmony: 0.5,
      pianoAccompaniment: 0.5,
    }
  } as Record<string, SoundMix>
};
