/**
 * @fileOverview Master Mix Registry V4.8 — "Double Attenuation".
 * #ЗАЧЕМ: Снижение системной громкости мелодии еще в 2 раза (всего в 4 раза).
 * #ЧТО: ПЛАН №2960 — Финальная корректировка для обеспечения идеального баланса.
 */

import type { Genre, SoundMix } from '@/types/music';

const UNIVERSAL_IMPERIAL_MIX: SoundMix = {
    bass: 0.70,           
    melody: 0.00875, // Снижено в 2 раза с 0.0175
    accompaniment: 0.10, 
    harmony: 0.0225,      
    pianoAccompaniment: 0.1075, 
    drums: 0.1875,
    sparkles: 0.65,      
    sfx: 0.65            
};

export const GENRE_MASTER_MIX: Record<Genre, SoundMix> = {
    psybient: { 
        ...UNIVERSAL_IMPERIAL_MIX,
        melody: 0.1875, // Снижено в 2 раза с 0.375
        accompaniment: 0.80,
        pianoAccompaniment: 0.035,
        drums: 0.12
    },
    ambient: { ...UNIVERSAL_IMPERIAL_MIX },
    foundry: {
        bass: 0.75,               
        melody: 0.125, // Снижено в 2 раза с 0.25             
        accompaniment: 0.75,      
        harmony: 0.035,           
        pianoAccompaniment: 0.035, 
        drums: 0.047, // Из предыдущей правки
        sparkles: 0.50,
        sfx: 0.20
    },
    blues: {
        bass: 0.78,
        melody: 0.07, // Снижено в 2 раза с 0.14
        accompaniment: 0.54,
        harmony: 0.53,        
        pianoAccompaniment: 0.56, 
        drums: 0.53,
        sparkles: 0.56, 
        sfx: 0.53       
    },
    cyber_blues: {
        bass: 0.78,
        melody: 0.07, // Снижено в 2 раза с 0.14
        accompaniment: 0.54,
        harmony: 0.53,        
        pianoAccompaniment: 0.56, 
        drums: 0.53,
        sparkles: 0.56, 
        sfx: 0.53       
    },
    reggae: { 
        ...UNIVERSAL_IMPERIAL_MIX,
        melody: 0.1625, // Снижено в 2 раза
        drums: 0.055,
        harmony: 0.0047         
    },
    progressive: { ...UNIVERSAL_IMPERIAL_MIX },
    rock: { ...UNIVERSAL_IMPERIAL_MIX },
    house: { ...UNIVERSAL_IMPERIAL_MIX },
    rnb: { ...UNIVERSAL_IMPERIAL_MIX },
    ballad: { ...UNIVERSAL_IMPERIAL_MIX },
    celtic: { ...UNIVERSAL_IMPERIAL_MIX }
};
