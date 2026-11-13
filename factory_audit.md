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
