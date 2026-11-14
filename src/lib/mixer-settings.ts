
/**
 * @fileOverview Единый пульт управления громкостью AuraGroove (V5.5).
 * #ЗАЧЕМ: Единственное место для ручной настройки системного микса.
 * 
 * ПОРЯДОК НАСТРОЙКИ:
 * 1. samplerDefaults — если инструмент ТИХИЙ сам по себе (калибровка файлов).
 * 2. roleBalance — если нужно, чтобы ЛИД всегда был громче ПЭДА (музыкальный баланс).
 * 3. genreBalance — дефолтные позиции ползунков в UI для каждого жанра.
 */

import type { Genre, SoundMix } from '@/types/music';

export const MIXER_SETTINGS = {
  /**
   * 1. Уровень калибровки "железа" (Preamp).
   * Влияет на инструмент ВО ВСЕХ жанрах.
   * Если добавили новые сэмплы и они "орут" — снижайте здесь.
   */
  samplerDefaults: {
    master: 0.85,     // Общий выход системы
    acoustic: 0.15,   // Гитара Black Acoustic
    electric: 0.15,   // Гитара Telecaster
    piano: 0.75,      // Rhodes и Piano
    orchestral: 0.5,  // Скрипка и Флейта
    chords: 1.2,      // Аккордовые сэмплы
    bass: 1.0,        // Синтезаторный и сэмплерный бас
    cs80: 0.4         // Vangelis-style синт
  },

  /**
   * 2. Баланс ролей (Per-Voice Multiplier).
   * Применяется фабрикой ДО микшера. Создает "скелет" микса.
   * Позволяет мелодии (1.5) быть в 2 раза громче баса (0.75).
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
   * Устанавливает положение фейдеров (0.0 - 1.0) в UI.
   * Эти значения применяются при смене жанра или нажатии RESET.
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
