# Параметры синтеза для баса, лид-гитар и эффектов

## 1. Синтезаторный бас: Сводная таблица параметров

| Жанр / Тип баса | Форма волны (Waveform) | ADSR (Амплитуда / Фильтр) | Фильтр (Filter Low-Pass) | Дисторшн / Насыщение (Distortion) |
| :--- | :--- | :--- | :--- | :--- |
| **Джаз (Jazz)** | Triangle + Sine (или приглушенная Saw) | **A:** 2-5ms <br>**D:** 150-300ms <br>**S:** 50-70% <br>**R:** 50-100ms | 24dB LP. Cutoff низкий (200-400Hz). Resonance минимальный. | **Tape/Tube Saturation**: минимальный (1-5%) для легкой аналоговой теплоты. |
| **Блюз (Blues)** | Triangle + Sub-Sine (или Square с узким пульсом) | **A:** 5-10ms <br>**D:** 200-400ms <br>**S:** 60-80% <br>**R:** 80-150ms | 12dB или 24dB LP. Cutoff ~300Hz. Мягкий спад. | **Tube Overdrive**: легкий (5-10%), чтобы добавить гармоник в нижней середине. |
| **Fretless (Безладовый)** | Saw + Triangle (сглаженные) | **A:** 20-50ms (дает «въезд») <br>**D:** 300-500ms <br>**S:** 70-80% <br>**R:** 150-250ms (певучий хвост) | 12dB LP. Модуляция фильтра через LFO/Env для эффекта «уау» (mwah). Cutoff ~500Hz. | **Tape Saturation**: средний (5-12%), акцент на певучую середину. |
| **808 Bass** | Чистый Sine + Triangle (опционально) | **A:** 0-2ms (щелчок) или 10-20ms (плавный) <br>**D:** 1.5-3.0s (длинный) <br>**S:** 0% (как ударный) <br>**R:** 50-100ms | 24dB LP. Cutoff очень низкий (80-120Hz). Фильтр почти закрыт. | **Clip / Wavefolder / Overdrive**: от 15% до 60%. Искажение делает 808 слышимым на телефонах. |
| **Ambient Drone** | Sub-Sine + Rich Saw / Square | **A:** 1.5-4.0s (очень медленный) <br>**D:** 0ms <br>**S:** 100% <br>**R:** 2.0-5.0s (бесконечный хвост) | 24dB LP. Медленная модуляция Cutoff (LFO). Resonance средний (20-40%) для гула. | **Bitcrusher / Rate Reducer** или **Lo-Fi Saturation**: 5-15% для текстуры и шума. |
| **Pop Bass** | Square + Saw (четкий, пробивной) | **A:** 0-2ms <br>**D:** 100-250ms <br>**S:** 30-50% <br>**R:** 20-50ms | 24dB LP. Короткая огибающая на Cutoff (Env -> Cutoff ~40-60%). Звук должен «стрелять». | **Soft Clipper**: 5-15% для плотности и контроля пиков в миксе. |
| **Rock Bass** | Две Saw волны (расстроенные/Detuned) | **A:** 1-3ms <br>**D:** 200-400ms <br>**S:** 80-90% <br>**R:** 50-100ms | 12dB LP (более открытый верх). Cutoff высокий (800-1500Hz), чтобы пробивать гитары. | **Hard Distortion / Guitar Amp Sim**: 20-40%. Сильный перегруз, эмуляция бас-комбика. |

---

## 2. Лид-электрогитары: Сводная таблица параметров

| Жанр / Стиль гитары | Форма волны (Waveform) | ADSR (Амплитуда / Фильтр) | Фильтр (Filter Configuration) | Дисторшн & Усиление (Distortion / Amp) | Эффекты & Модуляция (FX / Mod) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Джаз-гитара (Jazz Clean)** | Sine + Triangle (или мягкий Pulse) | **A:** 5-10ms <br>**D:** 400-600ms <br>**S:** 40-50% <br>**R:** 100-150ms | 24dB LP. Cutoff низкий (~500-800Hz). Без резонанса. | **Tape/Tube Saturation**: минимальный (2-5%). | **Spring Reverb**: Mix 20%. Легкий **Chorus** (Mix 10%, Rate медленный) для объема. |
| **Блюз-лид (Blues Overdrive)** | Saw + Triangle (или узкий Square) | **A:** 2-5ms <br>**D:** 300-500ms <br>**S:** 70-80% <br>**R:** 150-200ms | 12dB LP. Cutoff ~2-3kHz. Фильтр слегка привязан к Velocity. | **Tube Overdrive / Crunch**: средний (15-25%). | **Mod Wheel -> Pitch LFO**: глубина 20-30%, частота 5-6Hz (эмуляция вибрато пальцем). |
| **Поп-гитара (Pop Clean/Muted)** | 2 расстроенные Saw или Square + Saw | **A:** 0-2ms <br>**D:** 150-250ms <br>**S:** 20-40% <br>**R:** 50-80ms | 24dB LP. Короткий Decay на фильтре. Cutoff открывается до 4-5kHz при сильном нажатии. | **Soft Clipper / Treble Booster**: 5-10%. Яркий и пробивной звук. | **Ping-Pong Delay** (1/8 или 1/4). **Stereo Dimension/Hyper** для ширины. |
| **Рок / Метал (High-Gain)** | 2-3 Saw волны (Detuned + Sub-Osc) | **A:** 1-3ms <br>**D:** инфинити <br>**S:** 90-100% | 12dB LP или Band-Pass. Cutoff открыт полностью (8-12kHz). Резонанс 10-15%. | **Hard Distortion / Guitar Amp Sim**: высокий (40-70%). Эмуляция стека Marshall/Mesa. | **Legato/Portamento**: время скольжения 40-70ms. **Stereo Delay** + **Large Room Reverb**. |

---

## 3. Настройка пространственных эффектов для лидов

### Базовая схема подключения
`Синтезатор (Сухой тон) ➡️ Distortion/Amp ➡️ Chorus ➡️ Delay ➡️ Reverb`

### Примеры пресетов по жанрам
1. **Джаз-лид:**
   * **Chorus:** Mix 10%, Rate 0.5–0.8 Hz, Depth 15–20%.
   * **Delay:** Выключен.
   * **Reverb (Spring/Room):** Mix 20–25%, Decay 1.0–1.4s, Hi-Cut 3.5 kHz (тёплый хвост).
2. **Блюз-лид:**
   * **Chorus:** Mix 15%, Rate 1.0–1.2 Hz, Depth 30%.
   * **Delay (Tape):** Time 1/8 или Slapback (80–120 ms), Feedback 15–20% (1-2 повтора), Mix 20%.
   * **Reverb (Plate/Hall):** Mix 15–20%, Decay 1.5–1.8s.
3. **Поп-лид:**
   * **Chorus (Hyper/Dimension):** Mix 30–40%, Rate 1.5 Hz, Depth 40% (максимальная ширина).
   * **Delay (Ping-Pong):** Time 1/8d или 1/4, Feedback 35–45%, Mix 25–35%.
   * **Reverb (Hall):** Mix 25%, Decay 2.0–2.5s, Low-Cut 200 Hz (срез грязи).
4. **Рок / Метал лид:**
   * **Chorus:** Mix 20%, Rate 0.9 Hz, Depth 25%.
   * **Delay (Dual/Stereo):** Left 1/4, Right 1/8, Feedback 40–50%, Mix 30%.
   * **Reverb (Large Hall):** Mix 30%, Decay 3.0–4.0s, Pre-Delay 30–40 ms (для сохранения атаки).

---

## 4. Алгоритм динамического Glide для самописного синта

### Математическая модель
$$T_{glide} = T_{base} \cdot f(\Delta Pitch) \cdot g(Velocity)$$

* Множитель расстояния: $f(\Delta Pitch) = 1 + k_1 \cdot \ln(1 + |\Delta Pitch|)$
* Множитель силы удара: $g(Velocity) = 1 - k_2 \cdot \left(\frac{Velocity}{127}\right)$

### Псевдокод (C++)
```cpp
const float K1_DIST_INFLUENCE = 0.5f;  
const float K2_VEL_INFLUENCE  = 0.6f;  
const float MIN_GLIDE_TIME    = 5.0f;  

float calculate_dynamic_glide(int target_pitch, int current_pitch, int velocity, float base_glide_time) 
{
    int delta_pitch = abs(target_pitch - current_pitch);
    if (delta_pitch == 0) return 0.0f;

    float distance_multiplier = 1.0f + K1_DIST_INFLUENCE * log1pf((float)delta_pitch);
    float normalized_vel = (float)velocity / 127.0f;
    float velocity_multiplier = 1.0f - (K2_VEL_INFLUENCE * normalized_vel);

    float final_glide_time = base_glide_time * distance_multiplier * velocity_multiplier;

    if (final_glide_time < MIN_GLIDE_TIME) {
        final_glide_time = MIN_GLIDE_TIME;
    }

    return final_glide_time;
}
```
