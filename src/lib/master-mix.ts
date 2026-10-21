/**
 * @fileOverview Master Mix Registry V5.7 — "Piano 30-Point Alignment".
 * #ЗАЧЕМ: Реализация ПЛАНА №3150. Установка пианино на 30% для Foundry.
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
    foundry: { 
        ...CENTER_50_MIX,
        pianoAccompaniment: 0.3 // #ЗАЧЕМ: ПЛАН №3150. Целевое положение ползунка 30%.
    },
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
