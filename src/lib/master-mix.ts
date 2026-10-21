/**
 * @fileOverview Master Mix Registry V5.5 — "Visual Balance Alignment".
 * #ЗАЧЕМ: ПЛАН №3110 — Приведение системных дефолтов в соответствие с эталонным скриншотом пользователя.
 */

import type { Genre, SoundMix } from '@/types/music';

const UNIVERSAL_IMPERIAL_MIX: SoundMix = {
    bass: 0.70,           
    melody: 0.00875, 
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
        melody: 0.1875, 
        accompaniment: 0.40,
        pianoAccompaniment: 0.035,
        drums: 0.12
    },
    ambient: { ...UNIVERSAL_IMPERIAL_MIX },
    foundry: {
        bass: 0.37,               
        melody: 0.90, 
        accompaniment: 1.00, 
        harmony: 0.30,           
        pianoAccompaniment: 0.05,
        drums: 0.34, 
        sparkles: 0.50,
        sfx: 0.20
    },
    blues: {
        bass: 0.78,
        melody: 0.07, 
        accompaniment: 0.54,
        harmony: 0.53,        
        pianoAccompaniment: 0.56, 
        drums: 0.53,
        sparkles: 0.56, 
        sfx: 0.53       
    },
    cyber_blues: {
        bass: 0.78,
        melody: 0.07, 
        accompaniment: 0.27, 
        harmony: 0.53,        
        pianoAccompaniment: 0.56, 
        drums: 0.53,
        sparkles: 0.56, 
        sfx: 0.53       
    },
    reggae: { 
        ...UNIVERSAL_IMPERIAL_MIX,
        melody: 0.1625, 
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
