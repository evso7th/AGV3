/**
 * @fileOverview Master Mix Registry V5.6 — "Center 50 Realignment".
 * #ЗАЧЕМ: Реализация ПЛАНА №3120. Установка дефолтных уровней в 0.5 
 *         для обеспечения запаса хода и корректного баланса.
 */

import type { Genre, SoundMix } from '@/types/music';

const CENTER_50_MIX: SoundMix = {
    bass: 0.5,           
    melody: 0.5, 
    accompaniment: 0.5, 
    harmony: 0.5,      
    pianoAccompaniment: 0.5, 
    drums: 0.5,
    sparkles: 0.5,      
    sfx: 0.5            
};

export const GENRE_MASTER_MIX: Record<Genre, SoundMix> = {
    psybient: { ...CENTER_50_MIX },
    ambient: { ...CENTER_50_MIX },
    foundry: { ...CENTER_50_MIX },
    blues: { ...CENTER_50_MIX },
    cyber_blues: { ...CENTER_50_MIX },
    reggae: { ...CENTER_50_MIX },
    progressive: { ...CENTER_50_MIX },
    rock: { ...CENTER_50_MIX },
    house: { ...CENTER_50_MIX },
    rnb: { ...CENTER_50_MIX },
    ballad: { ...CENTER_50_MIX },
    celtic: { ...CENTER_50_MIX }
};
