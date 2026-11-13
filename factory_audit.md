# PATCH 3501 — Instrument Factory: Signal Path Integrity

**Версия:** V17.3 → V17.4 «Signal Path Integrity»
**Дата:** 13-11-2026
**Статус:** APPROVED FOR EXECUTION
**Скоуп:** один файл — `instrument-factory.ts`
**Связанные кодексы:** `DNA_RULES.md` (Interface Sanctity), `TECHNICAL_DEEP_DIVE_v3.md` (§5.2 Voice Stealing, §6 Velvet Standard), `GENETIC_SYSTEM.md` (детерминизм)

---

## 0. Контекст

Аудит показал, что часть заявленного в `TECHNICAL_DEEP_DIVE_v3` поведения физически не реализована в коде:

- HPF подключён параллельно и не влияет на сигнал → фильтра НЧ-грязи нет.
- Key-track инверсный: нота C6 на пресете `synth` теряет ~22 дБ.
- Тембр зависит от темпа (`cutoff * tempo/72`) — один пресет звучит по-разному в разных сессиях.
- Voice stealing делает мгновенный `stop()` вместо обещанных 15–20 мс fade → щелчки.
- `VOICE_BALANCE` / `STEAL_PRIORITY` размечены по ролям, а получает factory тип инструмента → баланс и ARP-приоритеты мертвы.
- Drive-кривая не нормализована: `soft 0.25` = −3.2 дБ, `muff 0.85` = +6.9 дБ.
- `setPreset()` не пересчитывает тон → ломает DNA-правило *Semantic Timbre Groups*.

Данный патч чинит **шесть** дефектов. Всё остальное — в §9 «Технический долг».

---

## 1. Запреты (нарушение = откат патча)

- ❌ `src/app/hypercube-dashboard/page.tsx` — не открывать на запись (**DNA INTERFACE SANCTITY**).
- ❌ Не менять структуру `console.log`, не добавлять и не удалять логи.
- ❌ Не трогать Anchor-логику, worker, `presets-v2.ts`, brains, маршрутизацию в `AudioEngineContext`.
- ❌ Не ломать публичные сигнатуры: `buildMultiInstrument`, `noteOn`, `deepCleanup`, `enforceVoiceLimit`, `collectExpiredVoices`, `globalActiveVoices`. Новые параметры — **только опциональные, в конец списка**.
- ❌ Не удалять параметр `tempo` из `createIndependentVoice` (менеджеры передают позиционно).
- ✅ Спорные изменения — за флагом-константой в шапке файла (A/B без отката).

**Флаги и их дефолты:**

| Флаг | Дефолт | Назначение |
|---|---|---|
| `ENABLE_ROLE_BALANCE` | `true` | восстановление ролевого баланса (PATCH 4) |
| `ENABLE_NON_BASS_REVERB` | `false` | реверб для не-басов (CPU, включать после замеров) |

---

## 2. Сводка

| ID | Дефект | Область | Риск изменения звука |
|---|---|---|---|
| B1 | HPF — висячая ветка | маршрутизация | средний (уйдёт гул) |
| B8 | `setPreset` не пересчитывает тон/реверб | `buildMultiInstrument` | низкий |
| B2 | инверсный key-track + tempo-множитель | `createIndependentVoice` | **высокий (в плюс)** |
| B6 | drive не нормализован | `getDriveCurve` | средний |
| B3 | роль подменяется типом | баланс + ARP | **высокий (микс)** |
| B4 | stealing без fade | `deepCleanup` | низкий (в плюс) |

**Порядок применения:** B1 + B8 (один участок графа) → B2 → B6 → B3 → B4.

---

## 3. PATCH B1 — Последовательный HPF

**Где:** `buildMultiInstrument`, блок маршрутизации после `applyEq(pure)`.

**Было:**
```ts
head.connect(hpf);
head.connect(mudCut);
let tail: AudioNode = mudCut;
```
`hpf.output` никуда не подключён → фильтр не работает вообще.

**Стало:**
```ts
head.connect(hpf);
hpf.connect(mudCut);
let tail: AudioNode = mudCut;
```

**Обязательно вместе с этим.** Дефолт 150 Гц теперь реально заработает и срежет основную гармонику гитары (E2 = 82 Гц, −10 дБ). Ввести на уровне модуля:

```ts
const HPF_BY_TYPE: Record<string, number> = { bass: 42, guitar: 80, organ: 60, synth: 120 };
```

Внутри `buildMultiInstrument` (используется также в B8):
```ts
const resolveHpf = (p: any) => {
  const v = Number(p?.hpf);
  return isFinite(v) && v > 0 ? clamp(v, 20, 400) : (HPF_BY_TYPE[type] ?? 150);
};
hpf.frequency.value = resolveHpf(currentPreset);
```

**Проверка:** синус 60 Гц через `synth` → падение RMS ≥ 10 дБ относительно билда до патча. Пауэр-аккорд E2 на гитаре не теряет тело.

---

## 4. PATCH B8 — `setPreset` пересчитывает тон и реверб

*Делать сразу после B1 — тот же участок кода.*

### 4.1. Вынести тон в функцию
Заменяет инлайновый расчёт `isAcoustic` / `mudCut.*`:

```ts
const applyTone = (p: any) => {
  const now = ctx.currentTime;
  const acoustic = type === 'guitar' && (
    p?.body === 'acoustic' || p?.name?.includes('Black') || (p?.pluckBrightness ?? 0) > 0.8
  );
  mudCut.type = acoustic ? 'notch' : 'peaking';
  mudCut.frequency.setTargetAtTime(400, now, 0.03);
  mudCut.Q.setTargetAtTime(acoustic ? 2.0 : 1.0, now, 0.03);
  mudCut.gain.setTargetAtTime(acoustic ? -6.0 : (type === 'bass' ? 0 : -3.5), now, 0.03);
  hpf.frequency.setTargetAtTime(resolveHpf(p), now, 0.03);
};
applyTone(currentPreset);
```
Формула `acoustic` сохранена 1:1 (обратная совместимость), добавлен только явный флаг `body`.

### 4.2. Реверб — создаётся всегда, подключается лениво
```ts
const ENABLE_NON_BASS_REVERB = false; // ⚠️ CPU: конволвер на инструмент. Включать после замеров.

const convolver = ctx.createConvolver();
const reverbWet = ctx.createGain();
reverbWet.gain.value = 0;
panner.connect(convolver);
convolver.connect(reverbWet);
let reverbActive = false;

const applyReverb = (p: any) => {
  const allowed = ENABLE_NON_BASS_REVERB || type === 'bass';
  const mix = allowed ? (p?.reverbMix ?? 0) : 0;
  const want = isFinite(mix) && mix > 0.001;
  if (want && !convolver.buffer) convolver.buffer = getReverbIR(ctx);
  reverbWet.gain.setTargetAtTime(want ? mix : 0, ctx.currentTime, 0.05);
  if (want && !reverbActive) { reverbWet.connect(output); reverbActive = true; }
  else if (!want && reverbActive) { try { reverbWet.disconnect(output); } catch {} reverbActive = false; }
};
applyReverb(currentPreset);
```
Удалить старые `const reverbMix / convolver / reverbWet` и ветку `if (convolver && reverbWet)` в маршрутизации — оставить `panner.connect(output)`.

**Принцип:** граф тянется от destination, поэтому подграф, отключённый от `output`, не рендерится → нулевой CPU в простое.

### 4.3. Сам `setPreset`
```ts
setPreset: (p) => {
  const prevVolume = currentPreset?.volume;
  currentPreset = { ...p };
  const vol = isFinite(p?.volume) ? p.volume : (isFinite(prevVolume) ? prevVolume : 0.7);
  instrumentGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
  applyTone(currentPreset);
  applyReverb(currentPreset);
  updateFX();
  applyComp(p);
  applyEq(p);
},
```

### 4.4. Геттер вместо снимка
Заменить поле `preset: currentPreset` в возвращаемом объекте:
```ts
get preset() { return currentPreset; },
```
Иначе менеджер читает устаревший пресет после переключения.

**Проверка:** build с `pluckBrightness: 0.9` → `setPreset({ pluckBrightness: 0.5 })` → `mudCut.type === 'peaking'`, `gain ≈ −3.5`. Оживает DNA-правило *Semantic Timbre Groups* (Dynamic Organ / Dynamic Pad по Tension).

---

## 5. PATCH B2 — Key-track вверх, убрать tempo

**Где:** `createIndependentVoice`, расчёт `finalCutoff`.

**Было:**
```ts
} else if (midi > 60) {
  finalCutoff = baseCutoff * Math.pow(0.92, midi - 60);
}
...
filter.frequency.value = finalCutoff * (tempo / 72);
```

**Стало:**
```ts
const NYQUIST_SAFE = Math.min(16000, ctx.sampleRate * 0.45);
let finalCutoff = baseCutoff;
if (isBass) {
  const kt = preset.filter?.keyTrack;
  if (kt) finalCutoff *= Math.pow(2, (midi - 36) * kt / 12);
} else {
  const kt = preset.lpf?.keyTrack ?? preset.filter?.keyTrack ?? 0.5;
  finalCutoff = baseCutoff * Math.pow(2, (midi - 60) * kt / 12);
}
finalCutoff = clamp(finalCutoff, 60, NYQUIST_SAFE);
```
и в не-басовой ветке:
```ts
filter.frequency.value = finalCutoff; // tempo-множитель удалён
```

Параметр `tempo` оставить в сигнатуре с комментарием «сохранён для совместимости, на тембр не влияет».
Ветку Bass Purity (`setTargetAtTime(finalCutoff * 0.6, now + 0.3, 1.2)`) **не трогать**.

**Проверка (ключевая):**

| Нота | Было (synth, LPF 950) | Стало |
|---|---|---|
| C4 (60) | 950 Гц | 950 Гц |
| C5 (72) | 349 Гц | 1344 Гц |
| C6 (84) | **128 Гц (−22 дБ)** | 1900 Гц |

RMS ноты C6 в пределах −6 дБ от C4 (до патча ≈ −20 дБ). Один пресет при 60 и 140 BPM звучит одинаково по тембру.

---

## 6. PATCH B6 — Нормализация drive-кривой

**Где:** `getDriveCurve` + `curveCache`.

**Проблема:** вход шейпера ≈ 0.45, а не 1.0. `soft 0.25` → −3.2 дБ, `muff 0.85` → +6.9 дБ. Разброс ~10 дБ объясняет странные `calibrationTrimDb` в пресетах.

**Стало:**
```ts
const DRIVE_REF_LEVEL = 0.45;
const shapeAt = (type: string, x: number, k: number) =>
  type === 'muff' ? Math.tanh(x * k) : x / (1 + k * Math.abs(x));

const getDriveCurve = (type: string, amount: number): Float32Array => {
  const q = Math.round(amount * 100) / 100;
  const key = `${type}:${q}:norm2`;           // ← новый ключ, старый кэш не переиспользовать
  const hit = curveCache.get(key); if (hit) return hit;
  const n = 4096, c = new Float32Array(n);
  const k = type === 'muff' ? 1 + q * 6 : q * 4;
  const refOut = shapeAt(type, DRIVE_REF_LEVEL, k);
  const norm = refOut > 1e-6 ? DRIVE_REF_LEVEL / refOut : 1;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = clamp(shapeAt(type, x, k) * norm, -1.5, 1.5);
  }
  curveCache.set(key, c);
  return c;
};
```

Кривая становится unity-gain на опорном уровне 0.45: тихие ноты сатурируются меньше, громкие компрессируются — как реальный усилитель.
`oversample: '2x'` не менять. Новые типы драйва **не добавлять** — вне скоупа.

**Проверка:** одинаковый вход, `soft 0.25` vs `muff 0.85` → разница RMS ≤ 2 дБ (было ~10 дБ).

---

## 7. PATCH B3 — Роль отдельным аргументом

**Проблема:** `type` = `guitar | synth | organ | bass`, а таблицы размечены по ролям `melody | accompaniment | harmony | …`. Совпадает только `bass`.

### 7.1. Уровень модуля
```ts
const ENABLE_ROLE_BALANCE = true;
const ROLE_ALIASES: Record<string, string> = {
  sparkle: 'sparkles', rhodes: 'pianoAccompaniment', piano: 'pianoAccompaniment'
};
const normalizeRole = (r?: string | null) => (r ? (ROLE_ALIASES[r] ?? r) : null);
```
`rhodes` — пятая роль из `DNA_RULES.md`, мапится на `pianoAccompaniment`.

### 7.2. `createIndependentVoice`
В конец сигнатуры добавить `role: string | null = null`. Внутри:
```ts
const balanceKey = (ENABLE_ROLE_BALANCE ? (normalizeRole(role) ?? type) : type);
const balance = VOICE_BALANCE[balanceKey] ?? 1.0;
const level = clamp(peak * balance, 0, 1.5);
```
Заменить три вхождения `peak * (VOICE_BALANCE[type] || 1.0)` на `level` / `level * adsr.s`.
В `record` добавить `role: balanceKey`.

### 7.3. `enforceVoiceLimit`
```ts
const prioA = STEAL_PRIORITY[a.role ?? a.type] ?? 1;
const prioB = STEAL_PRIORITY[b.role ?? b.type] ?? 1;
```

### 7.4. Проброс
В конфиг `buildMultiInstrument` добавить опциональный `role = null` (`role?: string | null`). В `noteOn`:
```ts
createIndependentVoice(ctx, type, currentPreset, instrumentGain, midi, when, velocity, duration,
  instrumentId, sharedDelay, params, params?.tempo || 72,
  normalizeRole(params?.role ?? role ?? null));
```

> ⚠️ **Это не косметика, а восстановление задуманного микса.** melody/accompaniment получат ×1.5 (+3.5 дБ), harmony ×0.6, pianoAccompaniment ×0.5. Мастер-лимитер −6 дБ может начать пампить. Агент обязан замерить пик до/после и отдельно сообщить, если клиппинг вырос. При подтверждении — снизить `VOICE_BALANCE.melody/accompaniment` до 1.25, **не менять молча**.

**Проверка:** два одинаковых `noteOn` с `role: 'melody'` и без → пик отличается ровно в 1.5 раза. Голос `bass` не вытесняется раньше `sparkles` при переполнении квоты.

---

## 8. PATCH B4 — Fade 15 мс в `deepCleanup`

**Проблема:** `TECHNICAL_DEEP_DIVE_v3` §5.2 обещает fade-out 15–20 мс, код делает `n.stop()` мгновенно → щелчок при voice stealing.

```ts
const STEAL_FADE_SEC = 0.015;
const fadingVoices = new Set<any>();

const hardKill = (v: any) => {
  if (!v) return;
  if (v.nodes) {
    v.nodes.forEach((n: any) => {
      try {
        if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) { n.onended = null; n.stop(); }
        n.disconnect();
      } catch (e) {}
    });
  }
  v.nodes = null; v.voiceState = null; v.instrumentId = null;
  fadingVoices.delete(v); globalActiveVoices.delete(v);
};

export const deepCleanup = (voiceRecord: any, immediate = false) => {
  if (!voiceRecord || voiceRecord.disposed) return;
  voiceRecord.disposed = true;
  globalActiveVoices.delete(voiceRecord);        // квота освобождается СРАЗУ
  const gain: GainNode | null = voiceRecord.voiceState?.node ?? null;
  const ctx: AudioContext | null = voiceRecord.ctx ?? null;
  if (immediate || !gain || !ctx) { hardKill(voiceRecord); return; }
  const t = ctx.currentTime;
  const stopAt = t + STEAL_FADE_SEC;
  try {
    const g = gain.gain, cur = g.value;
    g.cancelScheduledValues(t);
    g.setValueAtTime(cur, t);
    g.linearRampToValueAtTime(0, stopAt);
  } catch (e) { hardKill(voiceRecord); return; }
  voiceRecord.nodes?.forEach((n: any) => {
    try {
      if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) { n.onended = null; n.stop(stopAt + 0.005); }
    } catch (e) {}
  });
  voiceRecord.hardStopTime = stopAt + 0.02;
  fadingVoices.add(voiceRecord);
};
```

**Сборка мусора по аудио-часам, не по таймеру** (критично для фона/iOS — §5.3 Deep Dive):
```ts
export const collectExpiredVoices = (audioCtxTime: number) => {
  for (const v of fadingVoices) if (v.hardStopTime <= audioCtxTime) hardKill(v);
  for (const voice of globalActiveVoices) {
    if (voice.expirationTime < audioCtxTime || voice.disposed) deepCleanup(voice, true);
  }
};
```
> ⚠️ Убрать прежний ранний `if (globalActiveVoices.size === 0) return;` — иначе гаснущие голоса не соберутся никогда.
> Истёкшие голоса гасятся мгновенно (`true`): они уже на 0.0001, щелчка нет.

**В `record` добавить `ctx`** (без него fade не работает):
```ts
const record = { nodes, voiceState: { node: voiceGain, startTime: now }, disposed: false,
                 type, role: balanceKey, instrumentId, expirationTime, ctx };
```

**В API — единый хелпер, чтобы не текли гаснущие голоса:**
```ts
const killOwn = (immediate: boolean) => {
  Array.from(globalActiveVoices).filter(v => v.instrumentId === instrumentId).forEach(v => deepCleanup(v, immediate));
  Array.from(fadingVoices).filter(v => v.instrumentId === instrumentId).forEach(v => hardKill(v));
};
// allNotesOff: () => killOwn(false)
// dispose:     () => { killOwn(true); ...существующий disconnect-список... }
```
`globalAllNotesOff`: сначала `deepCleanup` по активным, затем `hardKill` по уже гаснущим.
Проверить, что `convolver` и `reverbWet` (теперь всегда не-null) есть в списках `dispose`/`disconnect`.

**Проверка:** оффлайн-рендер, детектор щелчков `max|x[n] − x[n−1]|` в момент принудительного `enforceVoiceLimit` < 0.05 (было ~0.3+). После `dispose()` во время fade — `fadingVoices.size === 0`.

---

## 9. Регресс-приёмка (OfflineAudioContext, до/после)

| # | Тест | Критерий | ✔ |
|---|---|---|---|
| 1 | Бас-канал, все пресеты | RMS-дельта ≤ 1 дБ, HPF 42 Гц активен | ☐ |
| 2 | C4 / C6 на `synth` | дельта ≤ 6 дБ | ☐ |
| 3 | Один пресет @ 60 и 140 BPM | тембр идентичен | ☐ |
| 4 | `soft 0.25` vs `muff 0.85` | дельта RMS ≤ 2 дБ | ☐ |
| 5 | Voice stealing | нет сэмпловых скачков > 0.05 | ☐ |
| 6 | `setPreset` × 20 подряд | нет утечки узлов, `globalActiveVoices` возвращается к базовому уровню | ☐ |
| 7 | Общий пик микса | не выше прежнего более чем на 1 дБ (иначе — отчёт по B3) | ☐ |
| 8 | Гитара E2 пауэр-аккорд | тело не потеряно после активации HPF | ☐ |

---

## 10. Формат отчёта агента

1. Список изменённых функций.
2. Значения всех новых флагов.
3. Таблица замеров до/после по §9.
4. Любые отклонения от ТЗ с обоснованием.
5. Подтверждение: изменён только `instrument-factory.ts`.

---

## 11. Технический долг (вне скоупа, зафиксировать в отчёте)

| ID | Долг | Связь с кодексами |
|---|---|---|
| D1 | Числовой `lpf` у органов не читается (`preset.lpf?.cutoff` → фолбэк 2000 Гц) | Velvet Standard §6: заявлено 1200–1800 Гц |
| D2 | `attackTransient` не реализован — инъекции `pick_strike` нет | Deep Dive §6 Transient Injection |
| D3 | `vibrato`, `leslie` не реализованы — ни одного LFO в factory | пресеты `organ`, `guitar_shineOn` |
| D4 | `calibrationTrimDb`, `noise`, `humanize.detuneCents/levelPct/brightnessPct` игнорируются | presets-v2 |
| D5 | `Math.random()` вместо seeded PRNG (humanize, instrumentId, noise, IR) | `GENETIC_SYSTEM.md`: сохранённый «шедевр» не воспроизводится идентично |
| D6 | `connect(dest)` создаёт второй маршрут мимо мастера | риск dry-утечки в обход лимитера −6 дБ |
| D7 | Хвост `r = 2.5` у гитар: `expirationTime` ≈ duration + 4.7 с → ~16 голосов на линию | ARP-квота 60 на мобильных |
| D8 | Короткие ноты: `noteOffTime < now + attackTime` → непредсказуемая огибающая | нужен клэмп `a ≤ duration * 0.4` |
| D9 | `getADSR` форсит басу `a ≥ 0.07`, `isPhaseLocked` перезаписывает на 0.002 — мёртвый код; «Phase Lock» физически не реализован | Web Audio не управляет фазой осциллятора |

Следующий патч — после получения менеджеров и `AudioEngineContext`.
# PATCH 3502 / 3503 — Factory Debt Closure

**База:** V17.4 «Signal Path Integrity» (PATCH 3501 применён)
**Дата:** 13-11-2026
**Статус:** APPROVED FOR EXECUTION
**Скоуп:** `instrument-factory.ts` (3504 — отдельный приказ, `presets-v2.ts`)
**Кодексы:** `TECHNICAL_DEEP_DIVE_v3` §5.2/§5.4/§6, `GENETIC_SYSTEM` (детерминизм), `DNA_RULES` (Interface Sanctity, Semantic Timbre Groups)

---

## 0. Предполётная проверка

Агент обязан убедиться, что в файле присутствуют артефакты 3501:
`HPF_BY_TYPE`, `resolveHpf`, `applyTone`, `applyReverb`, `ENABLE_NON_BASS_REVERB`,
`shapeAt`, `DRIVE_REF_LEVEL`, `normalizeRole`, `balanceKey`, `fadingVoices`, `hardKill`, `killOwn`.

**Если чего-то нет — остановиться и отчитаться. Не дописывать 3501 самостоятельно.**

## 1. Запреты (без изменений)

- ❌ `src/app/hypercube-dashboard/page.tsx`, структура `console.log`, Anchor-логика, worker, brains.
- ❌ Ломать публичные сигнатуры. Новые параметры — опциональные, **в конец** или в объекте `extras`.
- ❌ Удалять `tempo` из `createIndependentVoice`.
- ❌ Править `presets-v2.ts` и документы кодекса в этом патче.
- ✅ Каждое изменение звука — за флагом.

---

# ЧАСТЬ I — PATCH 3502 «Determinism & Timing Integrity»

Закрывает D1, D5, D6, D7, D8, D9. Дешёвые правки, нулевой прирост CPU.

| ID | Дефект | Риск звука |
|---|---|---|
| D1 | числовой `lpf` не читается, Q гитары захардкожен | средний (орган потемнеет — так задумано) |
| D9 | мёртвый floor атаки баса, ложный «Phase Lock» | низкий |
| D8 | `noteOff` раньше конца атаки → ломаная огибающая | **высокий (в плюс)** |
| D7 | хвост `duration + 4.7 с` раздувает полифонию | средний (в плюс) |
| D6 | `connect(dest)` дублирует маршрут мимо мастера | низкий |
| D5 | `Math.random()` ломает воспроизводимость шедевров | нулевой听觉но, критично для генофонда |

**Порядок:** D1 → D9 → D8 → D7 → D6 → D5.

---

## D1 — Честное чтение фильтра

**Где:** `createIndependentVoice`, `baseCutoff` / `filter.Q`.

```ts
const readCutoff = (v: any): number | null => {
  if (typeof v === 'number' && isFinite(v) && v > 0) return v;
  if (v && typeof v === 'object' && isFinite(v.cutoff) && v.cutoff > 0) return v.cutoff;
  return null;
};
const resolveBaseCutoff = (p: any): number =>
  readCutoff(p?.post?.lpf) ?? readCutoff(p?.lpf) ?? readCutoff(p?.filter) ?? 2000;

const resolveQ = (p: any): number => {
  const q = (typeof p?.lpf === 'object' ? p.lpf.q : undefined) ?? p?.filter?.q ?? p?.post?.q;
  return isFinite(q) ? clamp(q, 0.0001, 12) : 0.7;
};
```
Заменить оба тернарника `baseCutoff` на `resolveBaseCutoff(preset)`.
Заменить блок Q (обе ветки) на `filter.Q.value = resolveQ(preset);` — хардкод `type === 'guitar' ? 0.7` убрать.

**Эффект:** `organ` 2000 → **1800 Гц**, `organ_soft_jazz` → **1400 Гц**. Velvet Standard §6 наконец соблюдается. Гитарные пресеты не меняются (у них `lpf` — число без `q`, дефолт тот же 0.7).

**Проверка:** замерить −3 дБ точку органа; отклонение от заявленного значения ≤ 5%.

---

## D9 — Убрать мёртвый код, честный «Phase Lock»

**Где:** `getADSR` + комментарий `#ЗАЧЕМ: Алгоритм PHASE LOCK`.

1. Удалить строку `if (type === 'bass') rawA = Math.max(rawA, 0.07);` — она перезаписывается `isPhaseLocked` и не работает.
2. Взамен ввести антищелчковый пол для всех типов (в D8): `attackTime ≥ 0.001`, а для баса без phase-lock — `≥ 0.005`.
3. Переименовать комментарий в `FAST-ATTACK BASS / PHASE-COHERENT START` и добавить пояснение:

```ts
// Фазовая когерентность достигается только у нот с одинаковым `when`:
// осцилляторы стартуют в один и тот же сэмпл с нулевой фазой.
// Непрерывность фазы между последовательными нотами недостижима без
// персистентного осциллятора (моно-режим) — вне скоупа.
```

**Запрещено:** заявлять в коде или отчёте, что реализован истинный phase lock легато.

---

## D8 — Огибающая для коротких нот

**Где:** `createIndependentVoice`, расчёт времён + блок автоматизации `voiceGain`.

```ts
const MIN_EVENT = 0.002;
const dur = Math.max(duration, 0.02);
const rawAttack = isPhaseLocked ? 0.002 : adsr.a;
const attackTime = clamp(Math.min(rawAttack, dur * 0.4), type === 'bass' ? 0.005 : 0.001, 8);
const decayTau = Math.max(adsr.d / 3, 0.001);
const noteOffTime = now + Math.max(dur, attackTime + MIN_EVENT);
const releaseStart = Math.max(noteOffTime, now + attackTime + MIN_EVENT);
```

Автоматизация:
```ts
voiceGain.gain.setValueAtTime(0, now);
voiceGain.gain.linearRampToValueAtTime(level, now + attackTime);
voiceGain.gain.setTargetAtTime(level * adsr.s, now + attackTime, decayTau);
voiceGain.gain.setTargetAtTime(0.0001, releaseStart, releaseTau);
```

> ⚠️ **Не добавлять `linearRampToValueAtTime(0, …)` после `setTargetAtTime`.** Браузеры по-разному берут стартовое значение ramp после SetTarget — релиз может стать линейным вместо экспоненциального. Жёсткий ноль обеспечивается таймингом D7 + fade из B4.

**Эффект:** grace-ноты (`gr` из `TECHNIQUE_GUIDE`) и 1/16 на 140 BPM перестают «проглатываться» и «вспухать» после note-off.

**Проверка:** нота длительностью 0.06 с с пресетом `synth` (a=0.8): пик достигается на 24 мс, монотонное затухание после note-off, нет немонотонных участков огибающей.

---

## D7 — Точный хвост + ARP-aware release cap

**Где:** там же, `releaseTime` / `expirationTime`.

```ts
const ENABLE_RELEASE_CAP = true;
const RELEASE_CAP_DESKTOP: Record<string, number> = { guitar: 1.6, organ: 0.35, synth: 2.6, bass: 1.2 };
const RELEASE_CAP_MOBILE:  Record<string, number> = { guitar: 0.9, organ: 0.25, synth: 1.6, bass: 0.8 };

const capTable = globalVoiceLimit <= 60 ? RELEASE_CAP_MOBILE : RELEASE_CAP_DESKTOP;
const releaseTime = ENABLE_RELEASE_CAP ? Math.min(adsr.r, capTable[type] ?? 2.0) : adsr.r;
const releaseTau = Math.max(releaseTime / 3, 0.02);
const expirationTime = releaseStart + releaseTau * 5 + 0.03;   // вместо +0.5 padding
```

`osc.stop(expirationTime)` остаётся как есть — он использует новое значение.

**Эффект (гитара, восьмые @100 BPM):**

| | Хвост | Живых голосов на линию |
|---|---|---|
| было | 4.67 с | ~16 |
| desktop | 2.70 с | ~10 |
| mobile (квота 60) | 1.53 с | ~6 |

Орган получает хаммондовский короткий релиз без правки пресета.

**Проверка:** прогон 32 тактов при `setGlobalVoiceLimit(60)` — число вызовов `enforceVoiceLimit`-стилов должно упасть минимум вдвое.

---

## D6 — Единственный маршрут на выход

**Где:** `buildMultiInstrument`, маршрутизация + `connect` / `disconnect` / `dispose`.

```ts
let currentOut: AudioNode = output;
let destroyed = false;

const routeTo = (dest: AudioNode) => {
  if (destroyed || dest === currentOut) return;
  try { panner.disconnect(currentOut); } catch {}
  if (reverbActive) { try { reverbWet.disconnect(currentOut); } catch {} }
  currentOut = dest;
  panner.connect(currentOut);
  if (reverbActive) reverbWet.connect(currentOut);
};
```
- В `applyReverb` заменить `reverbWet.connect(output)` → `reverbWet.connect(currentOut)`.
- `connect: (dest) => routeTo(dest || output)`.
- `noteOn`: первая строка `if (destroyed) return;`.
- `dispose`: первой строкой `destroyed = true;`, в конце `currentOut = null as any`.

**Проверка:** построить инструмент с `output = busA`, вызвать `connect(busB)` → на `busA` тишина (RMS < −80 dBFS), на `busB` полный сигнал. Ранее сигнал шёл в оба.

---

## D5 — Детерминированный PRNG

**Где:** уровень модуля + `buildMultiInstrument` + `createIndependentVoice`.

```ts
const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash32 = (...nums: number[]) => {
  let h = 0x811c9dc5;
  for (const n of nums) { h ^= (n | 0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
const TEXTURE_SEED = 0x9E3779B9;   // noise / IR — фиксированы, одинаковы между сессиями
let instrumentCounter = 0;
```

1. `getNoiseBuffer` / `getReverbIR`: `const rand = mulberry32(TEXTURE_SEED + ch);` вместо `Math.random()`.
2. Конфиг `buildMultiInstrument`: добавить `seed?: number`.
```ts
const instSeed = isFinite(seed as number)
  ? hash32(seed as number, instrumentCounter++)
  : (Math.random() * 4294967296) >>> 0;      // legacy-фолбэк, если менеджер не прислал seed
const instrumentId = `inst_${instSeed.toString(36)}`;
let noteCounter = 0;
```
3. `noteOn`:
```ts
const noteSeed = hash32(instSeed, noteCounter++, midi, params?.tick ?? 0);
const rand = mulberry32(noteSeed);
```
4. `createIndependentVoice`: новый опциональный параметр в конец — `extras?: { rand?: () => number }`.
   Внутри: `const rand = extras?.rand ?? Math.random;`
   `randomDetune = (rand() * 2 - 1) * humanizeCents;`

> **Контракт с менеджером (вне этого файла):** полную детерминизацию даёт только проброс `seed` из воркера. Пока `seed` не приходит — factory работает в legacy-режиме. Агент обязан зафиксировать это в отчёте как блокер для `GENETIC_SYSTEM` (сохранённый шедевр не воспроизводится).
> **Условие воспроизводимости:** менеджер не должен ставить вызов `noteOn` в зависимость от состояния ARP — иначе счётчик нот разъезжается.

**Проверка:** два оффлайн-рендера одной партитуры с одинаковым `seed` и фиксированными `when` →_buffers побитово идентичны (`max|a−b| === 0`).

---

# ЧАСТЬ II — PATCH 3503 «Expressive Layer»

Закрывает D2, D3, D4. Прирост CPU — контролировать по бюджету §III.
**Применять только после приёмки 3502.**

| ID | Что оживает | Стоимость |
|---|---|---|
| D4 | `calibrationTrimDb`, `noise`, `humanize.levelPct/brightnessPct/detuneCents` | +3 узла/голос (noise) |
| D2 | `attackTransient` — инъекция медиатора/клика (Deep Dive §6) | +3 узла/голос |
| D3 | `vibrato` (общий LFO) + `leslie` (шина инструмента) | +1 узел/голос, +12 на орган |

**Порядок:** D4 → D2 → D3.

---

## D4 — Поля пресета, которые сейчас игнорируются

**4.1. `calibrationTrimDb`** — в `buildMultiInstrument` и `setPreset`:
```ts
const ENABLE_CALIBRATION_TRIM = false;   // ⚠️ включать ТОЛЬКО после PATCH 3504
const resolveVolume = (p: any) => {
  const base = isFinite(p?.volume) ? p.volume : 0.7;
  const trim = ENABLE_CALIBRATION_TRIM ? clamp(p?.calibrationTrimDb ?? 0, -12, 12) : 0;
  return clamp(base * dbToGain(trim), 0, 2);
};
```
> **Почему флаг выключен:** тримы в пресетах (`+7.54`, `+4.5`) компенсировали старую несбалансированную drive-кривую. После B6 они неверны. Включение до 3504 = клиппинг мастера.

**4.2. `humanize.levelPct` / `brightnessPct` / `detuneCents`** — в `createIndependentVoice`:
```ts
const h = preset.humanize ?? {};
const randomDetune = (rand() * 2 - 1) * (h.pitchCents ?? 0) + (rand() * 2 - 1) * (h.detuneCents ?? 0);
// после расчёта level:
const levelHuman = clamp(level * (1 + (rand() * 2 - 1) * (h.levelPct ?? 0)), 0, 1.5);
// после расчёта finalCutoff:
finalCutoff = clamp(finalCutoff * (1 + (rand() * 2 - 1) * (h.brightnessPct ?? 0)), 60, NYQUIST_SAFE);
```
> `detuneCents` у органа задуман как per-drawbar разброс тонвилов. Один `PeriodicWave`-осциллятор этого физически не может — реализуем как независимую добавку к детюну. Ограничение зафиксировать в отчёте.

**4.3. `noise` (synth)** — по образцу существующего `stringNoise`, под огибающей атаки:
```ts
const ENABLE_SYNTH_NOISE = true;
const overQuota = globalActiveVoices.size > 0.8 * globalVoiceLimit;
if (ENABLE_SYNTH_NOISE && !overQuota && preset.noise?.on && (preset.noise.gain ?? 0) > 0.001) {
  const nz = ctx.createBufferSource(); nz.buffer = getNoiseBuffer(ctx);
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass';
  nf.frequency.value = clamp(f0 * 3, 300, 6000); nf.Q.value = 0.7;
  const ng = ctx.createGain();
  const nPeak = preset.noise.gain * velocity;
  ng.gain.setValueAtTime(0, now);
  ng.gain.linearRampToValueAtTime(nPeak, now + 0.008);
  ng.gain.setTargetAtTime(nPeak * 0.25, now + 0.008, 0.25);
  ng.gain.setTargetAtTime(0.0001, releaseStart, 0.05);
  nz.connect(nf).connect(ng).connect(filter);
  nz.start(now); nz.stop(Math.min(expirationTime, now + 2.0));
  nodes.push(nz, nf, ng);
}
```
Не непрерывный шум: при 60 голосах постоянная полка поднялась бы на ~18 дБ.

---

## D2 — Transient Injection (медиатор / key click)

**5.1. Реестр + процедурный фолбэк** (уровень модуля):
```ts
const ENABLE_TRANSIENTS = true;
const transientCache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();

export const registerTransientBuffer = (ctx: AudioContext, name: string, buf: AudioBuffer) => {
  let m = transientCache.get(ctx); if (!m) { m = new Map(); transientCache.set(ctx, m); }
  m.set(name, buf);
};

const buildProceduralTransient = (ctx: AudioContext, name: string, variant: number): AudioBuffer => {
  const spec = name === 'key_click'
    ? { dur: 0.006, decay: 0.0012, ping: 4200, pingMix: 0.45 }
    : { dur: 0.012, decay: 0.0025, ping: 2600, pingMix: 0.30 };   // pick_strike, 12 мс по §6
  const rand = mulberry32(hash32(TEXTURE_SEED, variant, name.length));
  const len = Math.max(8, Math.floor(ctx.sampleRate * spec.dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate, env = Math.exp(-t / spec.decay);
    d[i] = ((rand() * 2 - 1) * (1 - spec.pingMix) + Math.sin(2 * Math.PI * spec.ping * t) * spec.pingMix) * env * 0.8;
  }
  return buf;
};

const getTransient = (ctx: AudioContext, name: string, variant: number): AudioBuffer => {
  let m = transientCache.get(ctx); if (!m) { m = new Map(); transientCache.set(ctx, m); }
  const key = `${name}:${variant}`;
  let b = m.get(key);
  if (!b) { b = buildProceduralTransient(ctx, name, variant); m.set(key, b); }
  return b;
};
```
Реальные сэмплы подключаются менеджером через `registerTransientBuffer` — factory их не грузит.

**5.2. Сшивка с телом (§5.4, линейный кроссфейд 5 мс):**
```ts
const trAmount = preset.attackTransient ?? 0;
const useTransient = ENABLE_TRANSIENTS && trAmount > 0.01 && !overQuota;
let chainHead: AudioNode = voiceGain;

if (useTransient) {
  const name = type === 'organ' ? 'key_click' : 'pick_strike';
  const variant = Math.floor(rand() * 3);                 // round-robin, детерминированный
  const sum = ctx.createGain(); sum.gain.value = 1;
  voiceGain.connect(sum);
  const ts = ctx.createBufferSource();
  ts.buffer = getTransient(ctx, name, variant);
  ts.playbackRate.value = 0.97 + rand() * 0.06;
  const tg = ctx.createGain();
  tg.gain.value = trAmount * (0.4 + 0.6 * velocity);
  ts.connect(tg).connect(sum);
  ts.start(now); ts.stop(now + ts.buffer.duration + 0.005);
  nodes.push(sum, ts, tg);
  chainHead = sum;
}
```
и в D8-расчёте: `if (useTransient) attackTime = Math.max(attackTime, 0.005);`
Тело нарастает за 5 мс, пока транзиент звучит → линейный кроссфейд, как заявлено в кодексе.

**Проверка:** спектрограмма атаки гитарной ноты — энергия выше 2 кГц в первые 12 мс ≥ +6 дБ относительно тела. Три соседние ноты не должны иметь идентичную атаку (round-robin).

---

## D3 — Vibrato и Leslie

**3.1. Vibrato: общий LFO на инструмент + пер-голосовой delay**

На уровне `buildMultiInstrument`:
```ts
let vibLfo: OscillatorNode | null = null;
let vibBus: GainNode | null = null;

const ensureVibrato = (p: any): GainNode | null => {
  if (!p?.vibrato || (p.vibrato.depthCents ?? 0) <= 0) return null;
  if (!vibLfo) {
    vibLfo = ctx.createOscillator(); vibLfo.type = 'sine';
    vibBus = ctx.createGain(); vibBus.gain.value = 1;
    vibLfo.connect(vibBus); vibLfo.start(0);      // start(0) — детерминированная фаза в оффлайне
  }
  vibLfo.frequency.setTargetAtTime(p.vibrato.rate ?? 5, ctx.currentTime, 0.05);
  return vibBus;
};
```
В `extras` передать `vibBus`. В голосе (после создания осцилляторов, собрать их в массив `oscs`):
```ts
if (vibBus && preset.vibrato) {
  const vg = ctx.createGain();
  vg.gain.setValueAtTime(0, now);
  vg.gain.linearRampToValueAtTime(preset.vibrato.depthCents ?? 0, now + (preset.vibrato.delay ?? 0.3));
  vibBus.connect(vg);
  oscs.forEach(o => vg.connect(o.detune));
  nodes.push(vg);
}
```
Цена: **1 gain на голос** вместо 2 узлов на голос. Фаза общая — для аккордов это «мод-вил», для соло-линии неотличимо.

**3.2. Leslie: шина инструмента, только `type === 'organ'`**

Врезка между `tail` (после EQ) и `panner`. Создаётся лениво при наличии `preset.leslie`, переключается гейнами `wet/dry` — обязательно, т.к. *Semantic Timbre Groups* меняют органные пресеты на лету.

```
tail → dryGain ─────────────────────────────→ panner
tail → leslieIn → hornHP(800) → hornDelay(0.005) → hornTrem → wetGain → panner
                → drumLP(800) → drumDelay(0.005) → drumTrem → wetGain
hornLfo → hornDop(gain = pitchDepth) → hornDelay.delayTime
hornLfo → hornAmp(gain = ampDepth/2) → hornTrem.gain   (база = 1 − ampDepth/2)
drumLfo → drumDop / drumAmp → аналогично
```

Опорные значения и математика:
```ts
// Доплер: Δcents ≈ 1731 · D · 2π · f,  D — глубина модуляции delayTime в секундах
// 10 центов @ 6.6 Гц  →  D ≈ 0.00014 с
const LESLIE = {
  chorale: { horn: 6.7, drum: 5.7 },
  tremolo: { horn: 0.7, drum: 0.6 },
  splitHz: 800, baseDelay: 0.005, ramp: 0.9
};
```
- `pitchDepth` трактуем как **секунды модуляции** (существующие 0.0002 → ≈12 центов — попадает в цель).
- `ampDepth` — доля амплитуды (0.22 ≈ 2 дБ). Текущие 0.03 = 0.26 дБ, не слышно → правится в 3504.
- Противовращение роторов: `drumLfo` через `createPeriodicWave(real=[0,0], imag=[0,-1])` (инверсия синуса).
- Переключение скорости: `setTargetAtTime(target, now, ramp/3)`.
- `driftPct` → отдельный медленный LFO на общий `driftBus`, глубина в центах `driftPct * 17.31`, подключается к `osc.detune` тем же способом, что vibrato.

**Обязательно:** `vibLfo`, `vibBus`, `driftLfo`, все узлы Leslie добавить в списки `dispose`/`disconnect`, **и вызвать `.stop()` на всех LFO в `dispose`**. Забытый LFO = неубиваемый осциллятор на весь сеанс.

**Проверка:** орган chorale — размах амплитуды ≥ 1.5 дБ, девиация высоты ≥ 8 центов; переключение chorale↔tremolo без щелчка, время перехода 0.7–1.2 с.

---

## III. Бюджет ресурсов

| Конфигурация | Узлов/голос до | После 3503 |
|---|---|---|
| Гитара с транзиентом + vibrato | 5 | 9 |
| Synth pad с noise | 8 | 11 |
| Орган (Leslie на шине) | 4 | 5 (+12 на инструмент) |

**Правила ARP-деградации (обязательны):**
- `globalActiveVoices.size > 0.8 · globalVoiceLimit` → транзиенты и noise отключаются.
- `globalVoiceLimit ≤ 60` → release cap по мобильной таблице (D7).
- Leslie и vibrato-LFO — константные затраты на инструмент, не деградируют.

**Замер:** прогон 60 с при квоте 60 и 128, зафиксировать пиковое число узлов, число стилов, `AudioContext` dropouts. Прирост CPU > 15% на мобильном профиле → откат D2 под флаг и отчёт.

---

## IV. Приёмка

| # | Тест | Критерий | ✔ |
|---|---|---|---|
| 1 | Organ LPF | 1800 / 1400 Гц ±5% | ☐ |
| 2 | Нота 0.06 с, пресет `synth` | пик на 24 мс, монотонный спад | ☐ |
| 3 | 32 такта @ квота 60 | число стилов ↓ ≥ 2× | ☐ |
| 4 | `connect(busB)` после `output=busA` | на busA < −80 dBFS | ☐ |
| 5 | Два оффлайн-рендера, один seed | `max|a−b| === 0` | ☐ |
| 6 | Атака гитары | ВЧ-энергия +6 дБ в первые 12 мс, 3 варианта | ☐ |
| 7 | Leslie chorale | tremolo ≥ 1.5 дБ, доплер ≥ 8 центов | ☐ |
| 8 | `dispose()` | все LFO остановлены, узлов не осталось | ☐ |
| 9 | CPU @ квота 60 | прирост ≤ 15% | ☐ |
| 10 | Общий пик микса | не выше прежнего более чем на 1 дБ | ☐ |

---

## V. Флаги — итоговая таблица

| Флаг | Дефолт | Когда включать |
|---|---|---|
| `ENABLE_RELEASE_CAP` | `true` | сразу |
| `ENABLE_SYNTH_NOISE` | `true` | сразу |
| `ENABLE_TRANSIENTS` | `true` | после замера CPU |
| `ENABLE_CALIBRATION_TRIM` | **`false`** | только после PATCH 3504 |

---

## VI. Вне скоупа (следующие приказы)

- **PATCH 3504 `presets-v2.ts`:** пересчёт `calibrationTrimDb` под нормализованный drive; `leslie.ampDepth` 0.03 → 0.22; `adsr` гитар (`s` 0.6 → 0.15, `r` → 0.45); Rhodes tine; рок-пресеты Page / Iommi.
- **PATCH 3505 (нужны менеджеры + `AudioEngineContext`):** проброс `seed` и `role` из воркера; загрузка реальных `pick_strike` / `key_click` через `registerTransientBuffer`.
- **Отдельно:** tempo-sync delay (`sync: '3/16'`), органные percussion и key click через реестр, cab-модель и асимметричный драйв для рока, моно-бас с персистентным осциллятором (истинный phase lock).
- **Расхождение кодекса и кода:** `TECHNICAL_DEEP_DIVE_v3` §6 заявляет реальный 12-мс сэмпл — factory использует процедурный фолбэк до 3505. Правку документа **не выполнять** без явного приказа.

## VII. Отчёт агента

1. Изменённые функции по каждому ID.
2. Значения всех флагов.
3. Таблица §IV с фактическими замерами.
4. Бюджет узлов и CPU до/после.
5. Отклонения от ТЗ с обоснованием.
6. Подтверждение: изменён только `instrument-factory.ts`.