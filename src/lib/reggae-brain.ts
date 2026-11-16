/**
 * @fileOverview Reggae Brain V28.0 — "Constant Groove Protocol".
 * #ЗАЧЕМ: Реформа ударных по технологии блюза. Постоянный бит вместо редких ударов.
 */

import type {
    FractalEvent,
    GhostChord,
    Mood,
    SuiteDNA,
    NavigationInfo,
    InstrumentHints,
    InstrumentPart,
    Genre,
    CommonMood,
    Technique,
    Dynamics,
    Phrasing
} from '@/types/music';
import {
    calculateMusiNum,
    DEGREE_TO_SEMITONE,
    decompressCompactPhrase,
    resolveSemanticTimbre,
    mergeIdenticalNotes,
    keyToMidiRoot,
    normalizeStr,
    TICKS_PER_BAR,
    TICK_TO_BEAT,
    invertPhrase,
    retrogradePhrase,
    applyRhythmicJitter
} from './music-theory';
import { DRUM_KITS } from './assets/drum-kits';

const MOOD_TO_COMMON: Record<Mood, CommonMood> = {
  epic: 'light', joyful: 'light', enthusiastic: 'light',
  dreamy: 'neutral', contemplative: 'neutral', calm: 'neutral',
  melancholic: 'dark', dark: 'dark', anxious: 'dark', gloomy: 'dark'
};

export class ReggaeBrain {
    private seed: number;
    private mood: Mood;
    private genre: Genre;
    private random: any;
    private useHeritage: boolean;
    private isImprovising: boolean = false;

    private cloudAxioms: any[] = [];
    private activeAnchorId: string | null = null;
    
    private sessionAnchorId: string | null = null; 
    private currentTrackName: string = 'Algorithmic';
    private currentNativeRoot: number | null = null;
    private currentPreferredInstrument: string | null = null;
    
    private currentTheme: { phrase: any[], startBar: number, endBar: number, id: string } | null = null;
    private currentAxiomMaxTick: number = 0;
    private currentTimeScale: number = 1;
    private currentBassTheme: { phrase: any[], startBar: number, endBar: number, id: string } | null = null;
    private currentAccompAxioms: { phrase: any[], role: string, id: string, preferredInstrument?: string }[] = [];
    private currentDrumAxioms: { phrase: any[], role: string, id: string }[] = [];

    private soloistBusyUntilBar: number = -1;
    private soloistRestingUntilBar: number = -1;
    private currentMutationType: string = 'none';
    private microTransposition: number = 0;
    private currentTransposition: number = 0; 
    private lickHistory: string[] = [];
    private sessionAxiomHistory: string[] = [];

    // #ЗАЧЕМ: Вельветовый Стандарт. Ограничение 4-й октавой.
    private readonly MELODY_CEILING = 71;

    constructor(seed: number, mood: Mood, genre: Genre, useHeritage: boolean = true) {
        this.seed = seed;
        this.mood = mood;
        this.genre = genre;
        this.useHeritage = useHeritage;
        this.random = this.createSeededRandom(seed);
    }

    private createSeededRandom(seed: number) {
        let state = seed;
        const next = () => {
            state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
            return state / Math.pow(2, 32);
        };
        const nextInt = (max: number) => {
            if (max <= 0) return 0;
            return Math.floor(next() * max);
        };
        return { next, nextInt };
    }

    private wrapMelody(midi: number): number {
        let v = midi;
        while (v > this.MELODY_CEILING) v -= 12;
        return v;
    }

    public updateCloudAxioms(axioms: any[], activeAnchorId?: string | null, useHeritage?: boolean, isImprovising?: boolean, axiomHistory?: string[]) {
        this.cloudAxioms = axioms || [];
        if (activeAnchorId !== undefined) this.activeAnchorId = activeAnchorId;
        if (useHeritage !== undefined) this.useHeritage = useHeritage;
        if (this.isImprovising !== undefined) this.isImprovising = isImprovising;
        if (axiomHistory !== undefined) this.sessionAxiomHistory = axiomHistory;
        if (this.cloudAxioms.length > 0 && this.useHeritage) this.soloistBusyUntilBar = -1;
    }

    private getMosaicIndex(epoch: number, startEpoch: number, totalBars: number, tension: number = 0.5): number {
        if (totalBars <= 0) return 0;
        const startOffset = calculateMusiNum(this.seed, 13, 0, totalBars);
        if (this.isImprovising) {
            return calculateMusiNum(epoch + startOffset, 11, this.seed, totalBars);
        }
        const barsElapsed = epoch - startEpoch;
        return (barsElapsed + startOffset) % totalBars;
    }

    private selectNextAxiom(navInfo: NavigationInfo, dna: SuiteDNA, epoch: number): number | undefined {
        this.currentAccompAxioms = [];
        this.currentBassTheme = null;
        this.currentTheme = null;
        this.currentDrumAxioms = [];

        if (!this.useHeritage || this.cloudAxioms.length === 0) return undefined;

        const poolToUse = this.cloudAxioms.filter(ax => ax.ignored !== true);
        let effectiveAnchor = this.activeAnchorId ? normalizeStr(this.activeAnchorId) : this.sessionAnchorId;
        
        let filteredPool = effectiveAnchor 
            ? poolToUse.filter(ax => normalizeStr(ax.compositionId) === effectiveAnchor)
            : poolToUse.filter(ax => {
                const axGenres = Array.isArray(ax.genre) ? ax.genre : [ax.genre];
                const axMoods = (Array.isArray(ax.mood) ? ax.mood : [ax.mood]).filter((m: any) => m != null && m !== '');
                return axGenres.includes(this.genre) && (axMoods.length === 0 || axMoods.includes(this.mood));
            });

        if (filteredPool.length > 0) {
            let basePool = filteredPool.filter(ax => ax.role === 'melody');
            if (basePool.length === 0) basePool = filteredPool.filter(ax => ax.role.toLowerCase().includes('accomp'));

            if (basePool.length > 0) {
                if (!effectiveAnchor) {
                    const first = basePool[calculateMusiNum(this.seed, 13, 0, basePool.length)];
                    if (first) {
                        this.sessionAnchorId = normalizeStr(first.compositionId);
                        effectiveAnchor = this.sessionAnchorId;
                        filteredPool = poolToUse.filter(ax => normalizeStr(ax.compositionId) === effectiveAnchor);
                        basePool = filteredPool.filter(ax => ax.role === 'melody' || ax.role.toLowerCase().includes('accomp'));
                    }
                }

                if (basePool.length > 0) {
                    const maxDonorBars = Math.max(4, ...basePool.map(ax => (ax.barOffset || 0) + (ax.bars || 4)));
                    const tension = dna.tensionMap?.[epoch] ?? 0.5;
                    const targetOffset = this.getMosaicIndex(epoch, 0, maxDonorBars, tension);
                    
                    const sameOffsetPool = basePool.filter(ax => (ax.barOffset || 0) === targetOffset);
                    const freshLicks = sameOffsetPool.filter(ax => !this.sessionAxiomHistory.includes(ax.id));

                    let selected = null;
                    if (freshLicks.length > 0) {
                        selected = freshLicks[this.random.nextInt(freshLicks.length)];
                    } else if (sameOffsetPool.length > 0) {
                        selected = sameOffsetPool[this.random.nextInt(sameOffsetPool.length)];
                    } else {
                        const anyFresh = basePool.filter(ax => !this.sessionAxiomHistory.includes(ax.id));
                        selected = anyFresh.length > 0 ? anyFresh[this.random.nextInt(anyFresh.length)] : basePool[0];
                    }

                    if (selected) {
                        this.lickHistory.push(selected.id);
                        if (this.lickHistory.length > 50) this.lickHistory.shift();

                        this.currentTrackName = selected.compositionId;
                        this.currentLickId = selected.id || 'DNA-Lick';
                        this.currentNativeRoot = keyToMidiRoot(selected.nativeKey);
                        this.currentPreferredInstrument = selected.preferredInstrument || null;
                        const cid = normalizeStr(selected.compositionId);
                        
                        const bass = poolToUse.find(ax => ax.role === 'bass' && normalizeStr(ax.compositionId) === cid && ax.barOffset === selected.barOffset);
                        if (bass) this.currentBassTheme = { phrase: decompressCompactPhrase(bass.phrase), startBar: epoch, endBar: epoch + (selected.bars || 4), id: bass.id };

                        const accs = poolToUse.filter(ax => (ax.role.toLowerCase().includes('accomp') || ax.role.toLowerCase().includes('piano') || ax.role.toLowerCase().includes('harmony')) && normalizeStr(ax.compositionId) === cid && ax.barOffset === selected.barOffset);
                        this.currentAccompAxioms = accs.map(ax => ({ phrase: decompressCompactPhrase(ax.phrase), role: ax.role, id: ax.id, preferredInstrument: ax.preferredInstrument }));

                        const drumSiblings = poolToUse.filter(ax => ax.role.toLowerCase().includes('drum') && normalizeStr(ax.compositionId) === cid && ax.barOffset === selected.barOffset);
                        this.currentDrumAxioms = drumSiblings.map(ax => ({ phrase: decompressCompactPhrase(ax.phrase), role: ax.role, id: ax.id }));

                        const axiomBars = selected.bars || 4;
                        this.currentAxiomMaxTick = axiomBars * TICKS_PER_BAR;
                        this.currentTheme = { phrase: mergeIdenticalNotes(decompressCompactPhrase(selected.phrase)), startBar: epoch, endBar: epoch + axiomBars, id: selected.id };
                        this.soloistBusyUntilBar = epoch + axiomBars;
                        return selected.nativeBpm || undefined;
                    }
                }
            }
        }
        this.currentTrackName = 'Algorithmic';
        this.soloistBusyUntilBar = epoch + 4;
        return undefined;
    }

    private getActiveBassTicks(epoch: number, tension: number = 0.5, mosaicBar: number = 0): Set<number> {
        const ticks = new Set<number>();
        if (this.currentBassTheme) {
            const localBar = mosaicBar % this.phraseBarCount(this.currentBassTheme.phrase);
            const barOffset = localBar * TICKS_PER_BAR;
            this.currentBassTheme.phrase.forEach(n => {
                if (n.t >= barOffset && n.t < barOffset + TICKS_PER_BAR) {
                    ticks.add(n.t - barOffset);
                }
            });
        } else {
            ticks.add(1.5);
            ticks.add(6.0);
            ticks.add(10.5);
        }
        return ticks;
    }

    private phraseBarCount(phrase: any[]): number {
        if (!phrase || phrase.length === 0) return 1;
        let maxT = 0;
        for (const n of phrase) if (n.t > maxT) maxT = n.t;
        return Math.max(1, Math.floor(maxT / TICKS_PER_BAR) + 1);
    }

    private applyMutationLogic(phrase: any[], tension: number, seed: number): any[] {
        let notes = [...phrase];
        if (this.currentMutationType === 'inversion') notes = invertPhrase(notes);
        else if (this.currentMutationType === 'retrograde') notes = retrogradePhrase(notes);
        else if (this.currentMutationType === 'jitter') notes = applyRhythmicJitter(notes, seed);
        return notes;
    }

    public generateBar(epoch: number, currentChord: GhostChord, navInfo: NavigationInfo, dna: SuiteDNA, hints: InstrumentHints): any {
        const tension = dna.tensionMap?.[epoch] ?? 0.5;
        this.currentTimeScale = navInfo.currentPart.instrumentRules?.melody?.timeScale || 1;
        const events: FractalEvent[] = [];
        
        if (epoch % 4 === 0) {
            const roll = calculateMusiNum(epoch, 23, this.seed, 100);
            if (roll < 40) this.currentMutationType = 'none';
            else if (roll < 55) { this.currentMutationType = 'transpose'; this.microTransposition = [-2, 2, 5, -5][this.random.nextInt(4)]; }
            else if (roll < 70) this.currentMutationType = 'inversion';
            else if (roll < 85) this.currentMutationType = 'retrograde';
            else this.currentMutationType = 'jitter';
        }

        if (epoch >= this.soloistBusyUntilBar) this.selectNextAxiom(navInfo, dna, epoch);

        const resRoot = (this.currentNativeRoot !== null) ? this.currentNativeRoot : currentChord.rootNote;
        const resChord = { ...currentChord, rootNote: resRoot };
        const kit = DRUM_KITS.reggae.standard;
        const instrumentOverrides: Partial<InstrumentHints> = {};

        const ensembleTotalBars = Math.max(1, Math.ceil(this.currentAxiomMaxTick / TICKS_PER_BAR));
        const ensembleAnchor = this.currentTheme ? this.currentTheme.startBar
            : (this.currentBassTheme ? this.currentBassTheme.startBar : epoch);
        const mosaicBar = this.getMosaicIndex(epoch, ensembleAnchor, ensembleTotalBars, tension);

        const bassTicks = this.getActiveBassTicks(epoch, tension, mosaicBar);

        // 1. DRUMS (MIRRORING BLUES TECH: Constant Groove)
        if (hints.drums) {
            // #ЗАЧЕМ: Sibling Sovereignty — приоритет барабанов из Наследия.
            if (this.currentDrumAxioms.length > 0) {
                const axiomEvents = this.currentDrumAxioms.flatMap(ax => {
                    const localBar = Math.abs(mosaicBar) % this.phraseBarCount(ax.phrase);
                    const barOffset = localBar * TICKS_PER_BAR;
                    return ax.phrase.filter(n => n.t >= barOffset && n.t < barOffset + TICKS_PER_BAR)
                        .map(n => ({
                            type: n.role.includes('kick') ? kit.kick[0] : (n.role.includes('snare') ? kit.snare[0] : kit.hihat[0]), 
                            note: 36, time: (n.t - barOffset) * TICK_TO_BEAT,
                            duration: 0.1, weight: 0.8, technique: 'hit'
                        }));
                });
                events.push(...axiomEvents as FractalEvent[]);
            } else {
                events.push(...this.renderReggaeGroove(epoch, tension, kit, bassTicks));
            }

            if (this.random.next() < 0.05) {
                events.push({ type: 'drum_ride_wetter', note: 51, time: 0, duration: 4.0, weight: 0.35, technique: 'hit', dynamics: 'p', phrasing: 'legato' });
            }
            if (epoch % 4 === 3) events.push(...this.renderReggaeFills(epoch, tension));
        }

        // 2. BASS
        if (hints.bass) {
            const b = (this.currentBassTheme && epoch < this.currentBassTheme.endBar)
                ? this.renderHeritageBass(epoch, resChord, tension, mosaicBar)
                : this.renderGenerativeBass(epoch, resChord, tension);
            events.push(...b);
        }

        // 3. HARMONY & PIANO
        const usedTargetLayers = new Set<string>();
        this.currentAccompAxioms.forEach(ax => {
            const role = ax.role.toLowerCase();
            let target: InstrumentPart | null = role.includes('piano') ? 'pianoAccompaniment' : (role.includes('accomp') ? 'accompaniment' : (role.includes('harmony') ? 'harmony' : null));
            if (target && hints[target] && !usedTargetLayers.has(target)) {
                events.push(...this.renderHeritageLayer(resChord, epoch, ax.phrase, target, tension, mosaicBar));
                usedTargetLayers.add(target);
                if (ax.preferredInstrument) instrumentOverrides[target] = resolveSemanticTimbre(ax.preferredInstrument, tension, target, 'reggae');
            }
        });

        if (hints.harmony && !usedTargetLayers.has('harmony')) {
            events.push(...this.renderGenerativeHarmony(resChord, epoch, tension));
            usedTargetLayers.add('harmony');
        }

        if (hints.pianoAccompaniment && !usedTargetLayers.has('pianoAccompaniment')) {
            const p = this.renderVirtuosoPiano(epoch, resChord, tension);
            events.push(...p.events);
        }

        // 4. MELODY
        let melodyLabel = 'none';
        if (hints.melody) {
            let m: FractalEvent[] = [];
            if (this.currentTheme && epoch < this.currentTheme.endBar) {
                m = this.renderHeritageMelody(epoch, resChord, tension, this.currentTimeScale, mosaicBar, navInfo.currentPart.instrumentRules?.melody?.density);
            }
            
            if (m.length === 0) {
                m = this.renderGapFiller(epoch, resChord, tension);
                melodyLabel = 'Gap-Filler';
            } else {
                melodyLabel = this.currentTheme?.id || 'DNA';
            }

            events.push(...m);
            if (this.currentPreferredInstrument) instrumentOverrides.melody = resolveSemanticTimbre(this.currentPreferredInstrument, tension, 'melody', 'reggae');
        }

        return {
            events, tension, beautyScore: 0.98,
            trackName: this.currentTrackName,
            mutationType: this.currentMutationType,
            instrumentOverrides,
            activeAxioms: { 
                melody: melodyLabel, 
                drums: this.currentDrumAxioms.length > 0 ? 'Sibling DNA' : 'Constant Riddim',
                bass: this.currentBassTheme ? 'Sibling DNA' : 'One-Drop Dub'
            },
            narrative: `Reggae Evolution: ${this.currentTrackName} [Drums: Constant]`
        };
    }

    private renderReggaeGroove(epoch: number, tension: number, kit: any, bassTicks: Set<number>): FractalEvent[] {
        const events: FractalEvent[] = [];
        
        // #ЗАЧЕМ: One Drop - Kick + Snare на 3-й доле (тик 6).
        events.push({ 
            type: kit.kick[0] as any, note: 36, time: 6 * TICK_TO_BEAT, 
            duration: 0.1, weight: 1.2, technique: 'hit', dynamics: 'f', phrasing: 'staccato' 
        });
        events.push({ 
            type: kit.snare[0] as any, note: 38, time: 6 * TICK_TO_BEAT, 
            duration: 0.1, weight: 1.1, technique: 'hit', dynamics: 'mf', phrasing: 'staccato' 
        });

        // Подбивка на 1-ю долю (тихо) для поддержания пульса, как в блюзе.
        if (epoch % 2 === 0) {
            events.push({ 
                type: kit.kick[0] as any, note: 36, time: 0, 
                duration: 0.1, weight: 0.4, technique: 'hit', dynamics: 'p', phrasing: 'staccato' 
            });
        }

        // #ЗАЧЕМ: Постоянные хэты (The Constant Pulse).
        // В регги акцент идет на "и", но фон должен быть постоянным.
        [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5].forEach((t, i) => {
            const isOffbeat = i % 2 !== 0;
            events.push({ 
                type: kit.hihat[0] as any, note: 42, 
                time: t * TICK_TO_BEAT, duration: 0.05, 
                weight: isOffbeat ? 0.70 : 0.30, 
                technique: isOffbeat ? 'hit' : 'ghost', 
                dynamics: 'p', phrasing: 'staccato' 
            });
        });

        // #ЗАЧЕМ: Ghost Snares (Blues-like syncopation).
        [1.5, 4.5, 7.5, 10.5].forEach(t => {
            if (this.random.next() < (0.2 + tension * 0.4)) {
                events.push({ 
                    type: 'drum_snare_ghost_note', note: 38, 
                    time: t * TICK_TO_BEAT, duration: 0.1, 
                    weight: 0.12 + (this.random.next() * 0.1), 
                    technique: 'ghost' 
                });
            }
        });

        return events;
    }

    private renderReggaeFills(epoch: number, tension: number): FractalEvent[] {
        const events: FractalEvent[] = [];
        const tomSequence = ['drum_Sonor_Classix_High_Tom', 'drum_Sonor_Classix_Mid_Tom', 'drum_Sonor_Classix_Low_Tom'];
        [9.5, 10.5, 11.5].forEach((t, i) => {
            events.push({ 
                type: tomSequence[i] as any, note: 48, time: t * TICK_TO_BEAT, 
                duration: 0.2, weight: 0.85 + (tension * 0.15), technique: 'hit', 
                dynamics: 'mf', phrasing: 'staccato', pan: -0.6 + (i * 0.6) 
            });
        });
        return events;
    }

    private renderHeritageBass(epoch: number, chord: GhostChord, tension: number, mosaicBar: number): FractalEvent[] {
        if (!this.currentBassTheme) return [];
        let phrase = this.currentBassTheme.phrase;
        phrase = this.applyMutationLogic(phrase, tension, this.seed + epoch);
        const localBar = mosaicBar % this.phraseBarCount(phrase);
        const barOffset = localBar * TICKS_PER_BAR;
        return phrase.filter(n => n.t >= barOffset && n.t < barOffset + TICKS_PER_BAR)
            .map(n => ({
                type: 'bass', note: this.constrainBassOctave(chord.rootNote - 12 + (DEGREE_TO_SEMITONE[n.deg] || 0) + this.microTransposition),
                time: (n.t - barOffset) * TICK_TO_BEAT, duration: n.d * TICK_TO_BEAT, weight: 0.9, technique: 'pulse', dynamics: 'mf', phrasing: 'detached'
            }));
    }

    private renderGenerativeBass(epoch: number, chord: GhostChord, tension: number): FractalEvent[] {
        const root = this.constrainBassOctave(chord.rootNote - 12 + this.microTransposition);
        // One Drop Bass: тишина на 1, удар на 3.
        return [{
            type: 'bass', note: root, time: 6 * TICK_TO_BEAT, duration: 2.0 * TICK_TO_BEAT, 
            weight: 1.1, technique: 'pulse', dynamics: 'f', phrasing: 'legato'
        }];
    }

    private renderHeritageMelody(epoch: number, chord: GhostChord, tension: number, timeScale: number, mosaicBar: number, density?: { min: number; max: number }): FractalEvent[] {
        if (!this.currentTheme) return [];
        let phrase = this.currentTheme.phrase;
        phrase = this.applyMutationLogic(phrase, tension, this.seed + epoch);
        const localBar = mosaicBar % this.phraseBarCount(phrase);
        const offset = localBar * TICKS_PER_BAR;
        const barNotes = phrase.filter(n => n.t >= offset && n.t < offset + (TICKS_PER_BAR / timeScale));

        return barNotes.map(n => ({
            type: 'melody',
            note: this.wrapMelody(chord.rootNote + 12 + (DEGREE_TO_SEMITONE[n.deg] || 0) + this.microTransposition),
            time: (n.t - offset) * TICK_TO_BEAT * timeScale,
            duration: n.d * TICK_TO_BEAT * timeScale,
            weight: 0.85, technique: 'pick', dynamics: 'mf', phrasing: 'legato'
        })) as FractalEvent[];
    }

    private renderHeritageLayer(chord: GhostChord, epoch: number, phrase: any[], type: InstrumentPart, tension: number, mosaicBar: number): FractalEvent[] {
        let mutated = this.applyMutationLogic(phrase, tension, this.seed + epoch + 1);
        const localBar = Math.abs(mosaicBar) % this.phraseBarCount(mutated);
        const offset = localBar * TICKS_PER_BAR;
        return mutated.filter(n => n.t >= offset && n.t < offset + TICKS_PER_BAR).map(n => ({
            type, note: this.wrapMelody(chord.rootNote + 12 + (DEGREE_TO_SEMITONE[n.deg] || 0) + this.microTransposition),
            time: (n.t - offset) * TICK_TO_BEAT, duration: n.d * TICK_TO_BEAT, weight: 0.45, technique: 'swell', dynamics: 'p', phrasing: 'legato'
        }));
    }

    private renderGenerativeHarmony(chord: GhostChord, epoch: number, tension: number): FractalEvent[] {
        if (this.random.next() > (0.1 + tension * 0.4)) return [];
        const t = calculateMusiNum(epoch, 7, this.seed, 2) === 0 ? 3 : 9;
        const root = chord.rootNote + 12 + this.currentTransposition + this.microTransposition;
        return (chord.chordType === 'minor' ? [0, 3, 7] : [0, 4, 7]).map(interval => ({
            type: 'harmony', note: this.constrainAccompanimentOctave(root + interval),
            time: t * TICK_TO_BEAT, duration: 0.4 * TICK_TO_BEAT, weight: 0.35,
            technique: 'hit', dynamics: 'p', phrasing: 'staccato', chordName: chord.chordType === 'minor' ? 'Am' : 'A'
        }));
    }

    private renderVirtuosoPiano(epoch: number, chord: GhostChord, tension: number): { events: FractalEvent[], style: string } {
        if (this.random.next() > 0.3) return { events: [], style: 'none' };
        const root = chord.rootNote + 12 + this.currentTransposition + this.microTransposition;
        const rawNote = root + (chord.chordType === 'minor' ? 3 : 4);
        return {
            style: 'Dub Echoes',
            events: [{
                type: 'pianoAccompaniment', note: this.wrapMelody(rawNote),
                time: 10.5 * TICK_TO_BEAT, duration: 0.5 * TICK_TO_BEAT, weight: 0.5,
                technique: 'hit', dynamics: 'p', phrasing: 'staccato'
            }]
        };
    }

    private renderGapFiller(epoch: number, chord: GhostChord, tension: number): FractalEvent[] {
        const events: FractalEvent[] = [];
        const root = chord.rootNote + 12 + this.currentTransposition + this.microTransposition;
        const isMinor = chord.chordType === 'minor';
        const scale = isMinor ? [0, 3, 5, 7, 10] : [0, 4, 7, 9]; 
        const count = calculateMusiNum(epoch, 7, this.seed, 3) + 1; 
        const offbeats = [1.5, 3.0, 4.5, 7.5, 9.0, 10.5];
        for (let i = 0; i < count; i++) {
            const tIdx = calculateMusiNum(epoch + i, 11, this.seed, offbeats.length);
            events.push({
                type: 'melody', note: this.wrapMelody(root + scale[calculateMusiNum(epoch + i, 13, this.seed, scale.length)]),
                time: offbeats[tIdx] * TICK_TO_BEAT, duration: 0.5 * TICK_TO_BEAT, 
                weight: 0.6 + (tension * 0.2), technique: 'pick', dynamics: 'p', phrasing: 'staccato'
            });
        }
        return events;
    }

    private constrainBassOctave(n: number): number { let v = n; while (v > 47) v -= 12; while (v < 31) v += 12; return v; }
    private constrainAccompanimentOctave(n: number): number { let v = n; while (v > 71) v -= 12; while (v < 48) v += 12; return v; }
}
