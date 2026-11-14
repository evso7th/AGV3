# PATCH F1 + 3506 — Foundry Heavy

**База:** `instrument-factory` V17.5 (3501 + 3502 применены)
**Дата:** 14-11-2026
**Статус:** APPROVED FOR EXECUTION
**Файлы:** F1 → `foundry-presets.ts` · 3506 → `instrument-factory.ts`
**Кодексы:** `DNA_RULES` (Interface Sanctity, Semantic Timbre Groups), `GENETIC_SYSTEM` (детерминизм), `TECHNICAL_DEEP_DIVE_v3` §5.2/§5.4/§6, `TECHNIQUE_GUIDE` (power-chords, palm-mute), `AXIOM_PROTOCOL`

---

## 0. Предполётная проверка

Убедиться в наличии якорей V17.5: `shapeAt`, `getDriveCurve`, `DRIVE_REF_LEVEL`, `resolveBaseCutoff`,
`resolveQ`, `resolveHpf`, `applyTone`, `applyReverb`, `hardKill`, `fadingVoices`, `pendingOps`.
**Чего-то нет — остановиться и отчитаться.**

Проверить, как именно читается key-track:
```ts
const kt = preset.lpf?.keyTrack ?? preset.filter?.keyTrack ?? 0.5;
```
Если якорь отличается — F1-поля `keyTrack` скорректировать под фактический код, не вслепую.

## 1. Запреты и флаги

- ❌ `hypercube-dashboard/page.tsx`, структура `console.log`, Anchor, worker, brains.
- ❌ **Не трогать `VOICE_BALANCE` и `STEAL_PRIORITY`** (отдельный долг 3502.1).
- ❌ Не менять V2-пресеты. F1 касается только Foundry.
- ❌ Не удалять ключи пресетов, не перечисленные в §3 — применить к ним общие правила §3.1.
- ✅ **Обратная совместимость обязательна:** при дефолтных новых полях 3506 обязан давать побитово идентичный звук для всех V2-пресетов.

| Флаг | Дефолт |
|---|---|
| `ENABLE_CAB` | `true` (только при наличии `preset.cab`) |
| `ENABLE_FILTER_LFO` | `true` (только при наличии `preset.lfo`) |
| `ENABLE_PRESET_MUD` | `true` (только при наличии `preset.mud`) |

---

## 2. Диагноз: почему Foundry сейчас не тяжелее

1. **Типа `fuzz` не существует.** `shapeAt` знает только `muff`, всё остальное → `x/(1+k|x|)` — самая мягкая кривая. Три индастриал-пэда не имеют дисторшна вообще.
2. **Тяжесть подменена громкостью.** Пиковые уровни голоса (velocity 1, роль 1.5):

| Пресет | V2 | Foundry | Δ |
|---|---|---|---|
| synth pad | 0.334 | 0.477 | +3.1 дБ |
| organ | 0.236 | 0.387 | +4.3 дБ |
| **shine lead** | 0.321 | **0.272** | **−1.4 дБ** |
| **rhodes** | 0.091 | **0.060** | **−3.7 дБ** |

Пэды громче, лиды тише → гитары тонут. `calibrationTrimDb: 8.5` не читается.

3. **`amount 0.85 → 0.95` — холостой ход.** `tanh(0.675×6.1)=0.99947` vs `tanh(0.675×6.7)=0.99977` → 0.003 дБ на атаке. Тяжесть живёт в **pre-gain и асимметрии**, не в amount.
4. **Низ пэдов срезан.** Foundry voicing делался, когда HPF был висячей веткой (B1). Теперь `HPF.synth = 120 Гц`: `fosynthcavepad` на MIDI 60 теряет −10.5 дБ на octave −2 и −22.5 дБ на octave −3 (32.7 Гц).
5. **Физз без кабины.** `foguitarshineon` post 5500 × key-track 1.587 на E5 → **8730 Гц** после tanh k=6.1. Реальный 4×12 заваливается выше 5 кГц.
6. **Акустический нотч на электрогитарах.** `pluckBrightness > 0.8` → notch 400 Гц −6 дБ. У тяжёлого ритма 400 Гц — это «чанк», вырезать нельзя.
7. **`humanize` отсутствует у всех** → идеальная строевая стабильность, «цифра».

---

## 3. PATCH F1 — `foundry-presets.ts`

**Только правки полей. Массивы `osc` и `drawbars` сохранять как в оригинале**, кроме явно указанных изменений.

### 3.1. Общие правила (применить ко всем ключам, включая не перечисленные ниже)

| Правило | Значение |
|---|---|
| `drive.type: 'fuzz'` | → `'muff'` (до 3506), затем → `'fuzz'`/`'plexi'` по §5 |
| `calibrationTrimDb` | → `0` (мины 8.5 / 4.5 убрать) |
| `humanize.pitchCents` | synth 2–4 · organ 3 · guitar 5–8 · rhodes 3 |
| `hpf` | synth 55 · organ 50 · guitar 85 · rhodes 70 |
| guitar `pluckBrightness` | ≤ 0.80 |
| guitar `lpf.keyTrack` | `0` — кабина не зависит от высоты ноты |
| organ `lpf.keyTrack` | `0` — тонвил-генератор полосно-ограничен |

### 3.2. Таблица правок

| Пресет | volume | drive | фильтр | adsr (a/d/s/r) | прочее |
|---|---|---|---|---|---|
| `fosynth` | 0.68 | muff 0.75 | `lpf:{cutoff:3200,q:1.8,keyTrack:0.35}` | 0.04/0.35/0.65/0.45 | hpf 55, hum 4 |
| `fosynthambientpadlush` | 0.66 | muff 0.55 | `lpf:{cutoff:2400,q:1.2,keyTrack:0.35}` | 0.8/1.2/0.7/0.9 | hpf 65, hum 3 |
| `fosynthcavepad` | 0.62 | muff 0.85 | `lpf:{cutoff:1600,q:1.6,keyTrack:0.3}` | 1.4/1.5/0.75/1.6 | hpf 40, hum 2, **sine octave −3→−1, gain 0.9→0.55** |
| `foorgan` | 0.52 | soft 0.90 | `lpf:{cutoff:2800,q:0.9,keyTrack:0}` | 0.006/0.05/0.95/0.10 | hpf 50, hum `{pitchCents:3,detuneCents:2.5}` |
| `foorgansoftjazz` | 0.46 | soft 0.35 | `lpf:{cutoff:2200,q:0.8,keyTrack:0}` | 0.006/0.05/0.95/0.10 | hpf 50, hum 3 |
| `foeprhodeswarm` | 0.36 | soft 0.45 | `lpf:{cutoff:3000,q:0.8,keyTrack:0.3}` | 0.005/1.4/0.25/0.4 | hpf 70, hum 3 |

### 3.3. Гитары — полные тела

```ts
foguitarclean: {
  type: 'guitar', name: 'Industrial Clean',
  volume: 0.58,
  osc: { width: 0.44 },
  post: { lpf: 4500 },
  lpf: { keyTrack: 0 },              // кабина фиксирована по частоте
  hpf: 85,
  adsr: { a: 0.006, d: 0.90, s: 0.30, r: 0.50 },   // затухание вместо органного сустейна
  delay: { time: 0.12, fb: 0.12, mix: 0.06 },
  pluckBrightness: 0.75,             // ← снимает акустический notch 400 Гц
  humanize: { pitchCents: 5 },
  calibrationTrimDb: 0,
},
foguitarshineon: {
  type: 'guitar', name: 'Industrial Shine Lead',
  volume: 0.72,
  osc: { width: 0.48 },
  drive: { type: 'muff', amount: 0.85 },
  post: { lpf: 4300 },               // суррогат кабины до 3506
  lpf: { keyTrack: 0 },
  hpf: 85,
  adsr: { a: 0.010, d: 0.35, s: 0.72, r: 1.00 },
  delay: { time: 0.35, fb: 0.30, mix: 0.20 },
  pluckBrightness: 0.78,
  humanize: { pitchCents: 6 },
  calibrationTrimDb: 0,
},
foguitarmufflead: {
  type: 'guitar', name: 'Industrial Muff Lead',
  volume: 0.75,
  osc: { width: 0.50 },
  drive: { type: 'muff', amount: 0.92 },
  post: { lpf: 4200 },
  lpf: { keyTrack: 0 },
  hpf: 85,
  adsr: { a: 0.008, d: 0.40, s: 0.70, r: 0.90 },
  delay: { time: 0.28, fb: 0.20, mix: 0.15 },
  pluckBrightness: 0.70,
  humanize: { pitchCents: 8 },
  calibrationTrimDb: 0,
},
```

### 3.4. Целевые пиковые уровни голоса (velocity 1, роль 1.5)

| Класс | Цель | Обоснование |
|---|---|---|
| muff-лид | 0.33–0.34 | потолок кривой ≈0.455 × volume; высокий RMS за счёт компрессии |
| clean-гитара | 0.39 | выше пик, ниже RMS — не спорит с лидом |
| пэд | 0.28–0.31 | 3–4 голоса в аккорде |
| орган | 0.26 | плотный спектр, много гармоник |
| rhodes | 0.18 | +5.4 дБ к V2, чтобы пробивать тяжёлый микс |

### 3.5. Заголовок файла — список мёртвых полей

Добавить комментарием в шапку:
```
// INERT до PATCH 3503/3506/3507: attackTransient, vibrato, leslie,
// calibrationTrimDb, noise, humanize.detuneCents/levelPct/brightnessPct,
// reverbMix (не-bass), lfo (до 3506), cab/mud/drive.preGain (до 3506).
// Не тюнинговать эти поля на слух — они не влияют на звук.
```

> ⚠️ **Отклонение от Velvet Standard §6:** `foorgan` LPF 2800 Гц вместо 1200–1800.
> Обосновано: Foundry — heavy-библиотека. Для ambient-сессий использовать V2 `organ` (1800).
> V2-пресеты обязаны остаться в пределах стандарта.

---

## 4. PATCH 3506 — `instrument-factory.ts`

### 4.1. Drive: типы, pre-gain, асимметрия

```ts
const DRIVE_SPECS: Record<string, { k: (q: number) => number; hard: boolean }> = {
  soft:  { k: q => q * 4,       hard: false },
  muff:  { k: q => 1 + q * 6,   hard: true  },
  plexi: { k: q => 1 + q * 9,   hard: true  },   // ламповый, средний гейн
  fuzz:  { k: q => 1 + q * 14,  hard: true  },   // кирпичная стена
};

const shapeAt = (type: string, x: number, k: number, b: number) => {
  const spec = DRIVE_SPECS[type] ?? DRIVE_SPECS.soft;
  if (!spec.hard) return x / (1 + k * Math.abs(x));
  return Math.tanh(k * (x + b)) - Math.tanh(k * b);   // b>0 → чётные гармоники, DC снят
};

const getDriveCurve = (type: string, amount: number, preGain = 1, asym = 0): Float32Array => {
  const q  = Math.round(clamp(amount, 0, 1) * 100) / 100;
  const pg = Math.round(clamp(preGain, 1, 6) * 100) / 100;
  const b  = Math.round(clamp(asym, 0, 0.35) * 1000) / 1000;
  const key = `${type}:${q}:${pg}:${b}:norm3`;
  const hit = curveCache.get(key); if (hit) return hit;
  const k = (DRIVE_SPECS[type] ?? DRIVE_SPECS.soft).k(q);
  const refOut = shapeAt(type, DRIVE_REF_LEVEL * pg, k, b);
  const norm = Math.abs(refOut) > 1e-6 ? DRIVE_REF_LEVEL / refOut : 1;
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = clamp(shapeAt(type, x * pg, k, b) * norm, -1.5, 1.5);
  }
  curveCache.set(key, c);
  return c;
};
```
Вызов:
```ts
shaper.curve = getDriveCurve(driveType, driveAmount,
  preset.drive?.preGain ?? 1, preset.drive?.asym ?? 0);
```
`oversample`: `'2x'` для soft/muff, **`'4x'` для plexi/fuzz** (k до 15 даёт гармоники далеко за Найквист).

> **Совместимость:** при `preGain=1, asym=0` математика для soft/muff идентична текущей → V2 не меняется. Проверить тестом §7.1.

> **Следствие компрессии:** огибающая стоит **до** шейпера, поэтому при `preGain ≥ 2` ADSR почти перестаёт влиять на громкость (кирпичная стена). Это аутентично для fuzz-гитар, но **убивает динамику пэдов**. Правило: `preGain > 1.4` только для гитар и перегруженного органа; пэды — `preGain: 1`.

### 4.2. Кабина на шине инструмента

Только `type === 'guitar'`, создаётся один раз, включается по наличию `preset.cab`.
Врезка между `tail` (после EQ) и `panner`:

```
tail → dryGain ──────────────────────────────────────→ panner
tail → cabIn → HPF(85,Q0.7) → bodyPeak(105,Q1.3,+4дБ)
             → LPF(5200,Q0.9) → LPF(5200,Q0.9) → cabTrim(−2.5дБ) → cabWet → panner
```

```ts
// preset.cab?: { hpf?, bodyHz?, bodyDb?, lpf?, trimDb? }
const applyCab = (p: any) => {
  const on = ENABLE_CAB && type === 'guitar' && !!p?.cab;
  const now = ctx.currentTime;
  dryGain.gain.setTargetAtTime(on ? 0 : 1, now, 0.015);
  cabWet.gain.setTargetAtTime(on ? 1 : 0, now, 0.015);
  if (on && !cabConnected) { cabWet.connect(panner); cabConnected = true; }
  else if (!on && cabConnected) {
    scheduleOp(now + 0.25, () => { try { cabWet.disconnect(panner); } catch {} cabConnected = false; });
  }
  // частоты/гейны пересчитывать из p.cab через setTargetAtTime(…, 0.03)
};
```
Два каскадных LPF дают 24 дБ/окт — реальный спад кабины. `cabIn` висит без нагрузки, когда wet отключён → не рендерится, нулевой CPU.

**Взаимодействие с `post.lpf`:** per-voice LPF 4300 остаётся, кабина начинает резать на 5200 → суммарно чуть темнее, но с правильным скатом. Дополнительной правки пресетов не требуется.

### 4.3. Filter LFO (общий на инструмент)

```ts
let lfoOsc: OscillatorNode | null = null, lfoBus: GainNode | null = null;

const ensureLfo = (p: any): GainNode | null => {
  const l = p?.lfo;
  if (!ENABLE_FILTER_LFO || !l || !(l.amount > 0) || l.target !== 'filter') return null;
  if (!lfoOsc) {
    lfoOsc = ctx.createOscillator(); lfoOsc.type = l.shape ?? 'sine';
    lfoBus = ctx.createGain(); lfoOsc.connect(lfoBus);
    lfoOsc.start(0);                      // детерминированная фаза в оффлайне
  }
  lfoOsc.frequency.setTargetAtTime(l.rate ?? 0.4, ctx.currentTime, 0.05);
  lfoBus.gain.setTargetAtTime(l.amount, ctx.currentTime, 0.05);
  return lfoBus;
};
```
В голосе, после расчёта `finalCutoff`:
```ts
if (lfoBus) {
  lfoBus.connect(filter.frequency);
  record.paramLinks.push({ src: lfoBus, param: filter.frequency });
}
```

> ⚠️ **Утечка AudioParam.** `filter.disconnect()` рвёт выходы, но **не** вход `lfoBus → filter.frequency`. Без явного unlink мёртвые фильтры остаются в графе навсегда. В `hardKill` добавить:
> ```ts
> v.paramLinks?.forEach((l: any) => { try { l.src.disconnect(l.param); } catch {} });
> v.paramLinks = null;
> ```
> Тот же паттерн обязателен для будущего vibrato-баса (3503 D3).

Ограничение: `lfo.amount ≤ 0.5 × cutoff`, иначе срез уходит в отрицательную область и клампится.

### 4.4. `mudCut` из пресета

В `applyTone`:
```ts
const m = ENABLE_PRESET_MUD ? p?.mud : null;
const acoustic = /* существующая эвристика без изменений */;
mudCut.type = m?.type ?? (acoustic ? 'notch' : 'peaking');
mudCut.frequency.setTargetAtTime(m?.freq ?? 400, now, 0.03);
mudCut.Q.setTargetAtTime(m?.q ?? (acoustic ? 2.0 : 1.0), now, 0.03);
mudCut.gain.setTargetAtTime(m?.gainDb ?? (acoustic ? -6.0 : (type === 'bass' ? 0 : -3.5)), now, 0.03);
```

### 4.5. Обязательное для всех подпатчей

- `applyCab`, `ensureLfo`, `mud` вызывать из `setPreset` — иначе ломается **Semantic Timbre Groups** (`DNA_RULES`).
- Все новые узлы в списки `dispose`/`disconnect`; **`.stop()` на `lfoOsc` в `dispose`**.
- Никакого `Math.random()` в новом коде (`GENETIC_SYSTEM`).

---

## 5. F2 — дельта пресетов после 3506

| Пресет | Добавить |
|---|---|
| `foguitarclean` | `cab: {}` |
| `foguitarshineon` | `drive:{type:'plexi',amount:0.70,preGain:2.0,asym:0.14}`, `cab:{}`, `mud:{freq:420,gainDb:0,q:1}` |
| `foguitarmufflead` | `drive:{type:'fuzz',amount:0.80,preGain:2.6,asym:0.06}`, `cab:{bodyDb:5}`, `mud:{freq:420,gainDb:0,q:1}` |
| `foorgan` | `drive:{type:'plexi',amount:0.55,preGain:1.6,asym:0.18}` |
| пэды | `preGain` **не добавлять** (сохранить динамику огибающей) |

После F2 проверить пики по §3.4 и при необходимости подстроить `volume` на ±0.05.

---

## 6. Бюджет ресурсов

| Элемент | Цена |
|---|---|
| drive preGain/asym | 0 узлов; кэш кривых +16 КБ на комбинацию (~20 комбинаций ≈ 320 КБ) |
| `oversample '4x'` | ×2 CPU шейпера относительно '2x' — только plexi/fuzz |
| кабина | 7 узлов **на гитарный инструмент**, 0 на голос |
| filter LFO | 2 узла на инструмент, 0 на голос |
| mud | 0 |

ARP: при `globalVoiceLimit ≤ 60` принудительно `oversample: '2x'` для всех типов.

---

## 7. Приёмка

| # | Тест | Критерий | ✔ |
|---|---|---|---|
| 1 | **Регресс V2**: рендер всех V2-пресетов до/после 3506 | `max\|a−b\| === 0` (побитово) | ☐ |
| 2 | Тяжёлая гитара, спектр | энергия выше 5 кГц ↓ ≥ 8 дБ после кабины | ☐ |
| 3 | Пэд с muff, preGain 1 | пик-к-сустейну ≥ 3 дБ (динамика жива) | ☐ |
| 4 | Steal fade при fuzz preGain 2.6 | `max\|x[n]−x[n−1]\| < 0.05` | ☐ |
| 5 | LFO 0.4 Гц | срез колеблется ±800 Гц; 100 циклов noteOn/off → `paramLinks` не растут | ☐ |
| 6 | `setPreset` cab on↔off ×20 | без щелчков, кроссфейд ≤ 30 мс | ☐ |
| 7 | Пики голоса | в пределах §3.4 ±10% | ☐ |
| 8 | Аккорд 4 голоса, шина | пик ≤ 1.0 до мастера; иначе отчёт по volume | ☐ |
| 9 | CPU @ квота 60 | прирост ≤ 10% | ☐ |
| 10 | `dispose()` | все LFO остановлены, узлов не осталось | ☐ |

---

## 8. Что остаётся мёртвым (следующие приказы)

| Долг | Патч |
|---|---|
| `attackTransient`, `vibrato`, `leslie`, `noise`, `humanize.levelPct/brightnessPct`, `calibrationTrimDb` | **3503** (не начат) |
| `reverbMix` для не-bass → общая шина, **один конволвер вместо восьми** | **3507** (нужен `AudioEngineContext`) |
| Проброс `seed` / `role` / `tick` из воркера | **3505** (нужны менеджеры) |
| Voicing-фильтр: при `drive.amount > 0.45` только root+fifth+octave, ≤3 ноты (`TECHNIQUE_GUIDE`: power-chords, palm-mute) | **3507**, уровень Brain |
| Блокеры 3502.1 (`VOICE_BALANCE.bass` 0.75→0.375, `sparkles` priority, сброс `instrumentCounter`, `\|\|`→`??`) | **отдельно, до F1** |

---

## 9. Отчёт агента

1. Изменённые поля по каждому пресету (F1) и функции (3506).
2. Значения всех флагов.
3. Таблица §7 с фактическими замерами.
4. Подтверждение побитовой идентичности V2 (тест №1) — **без него патч не принимается**.
5. Бюджет узлов и CPU до/после.
6. Отклонения от ТЗ с обоснованием.
