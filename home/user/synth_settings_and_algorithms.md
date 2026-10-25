# Параметры синтеза для баса, лид-гитар и эффектов (v2.8)

## 1. Синтезаторный бас: Сводная таблица параметров

| Жанр / Тип баса | Форма волны (Waveform) | ADSR (Амплитуда / Фильтр) | Фильтр (Filter Low-Pass) | Дисторшн / Насыщение (Distortion) |
| :--- | :--- | :--- | :--- | :--- |
| **Джаз (Jazz / Warm)** | Sine + **Triangle Sub** (Gain 0.3) | **A:** 100ms (вдох) <br>**D:** 2s <br>**S:** 70% <br>**R:** 1.2s | 24dB LP. **Dynamic Cutoff**: открытие до 600Hz, закрытие до 120Hz. | **Tape Saturation**: 5%. Добавлен **Drift** (детюн 2-4 цента, LFO 0.1Hz). |
| **Блюз (Blues)** | Triangle + Sub-Sine | **A:** 5-10ms <br>**D:** 200-400ms <br>**S:** 60-80% <br>**R:** 150ms | 12dB или 24dB LP. Cutoff ~300Hz. Мягкий спад. | **Tube Overdrive**: 10%. Насыщение нижней середины. |
| **Fretless (Безладовый)** | Saw + Triangle (сглаженные) | **A:** 20-50ms <br>**D:** 300-500ms <br>**S:** 70-80% <br>**R:** 250ms | 12dB LP. Модуляция «mwah» через LFO. Cutoff ~500Hz. | **Tape Saturation**: 12%. Акцент на певучую середину. |
| **808 Bass** | Чистый Sine + Triangle | **A:** 0-2ms (click) <br>**D:** 2.5s <br>**S:** 0% <br>**R:** 100ms | 24dB LP. Cutoff 100Hz. Почти закрыт. | **Wavefolder**: 40%. Обеспечивает слышимость на мобильных спикерах. |
| **Ambient Drone** | Sub-Sine + Rich Saw | **A:** 3.0s <br>**D:** 0ms <br>**S:** 100% <br>**R:** 4.0s | 24dB LP. Медленная модуляция Cutoff (LFO 0.05Hz). | **Lo-Fi Saturation**: 10%. Текстурный шум. |

---

## 2. Гитары: Акустические и Лид-электрогитары

| Тип гитары | Спектральная коррекция | ADSR / Phrasing | Артикуляция и Транзиенты | Эффекты |
| :--- | :--- | :--- | :--- | :--- |
| **Acoustic (Black)** | **Notch -6dB @ 400Hz** (Q:2.0) | **Release: 2.5s** (Exp). Создает гармоническое облако. | **pluckBrightness: 0.9** (при vel > 0.7). Стеклянный звон. | **Body Resonance**: Peaking 220Hz (+3dB). |
| **Lead (Shine On)** | High Shelf +1dB > 10kHz | **A:** 20ms <br>**R:** 1.8s | **PWM Modulation**: Имитация хоруса внутри осциллятора. | **Darkening Delay**: LPF на фидбэке снижается с каждым эхо. |
| **Lead (Muff)** | Mid Boost +3.5dB @ 1kHz | **A:** 18ms <br>**R:** 2.8s | **The Long Howl**: 2.5x сустейн на золотых нотах. | **Fuzz/Muff**: Amount 0.85. Агрессивный гаражный тон. |

---

## 3. Настройка пространственных эффектов для лидов

### Базовая схема подключения
`Синтезатор (Сухой тон) ➡️ Distortion/Amp ➡️ Chorus ➡️ Delay ➡️ Reverb`

### Примеры пресетов по жанрам
1. **Джаз-лид:**
   * **Chorus:** Mix 10%, Rate 0.5–0.8 Hz.
   * **Reverb (Spring):** Mix 20%, Hi-Cut 3.5 kHz.
2. **Блюз-лид:**
   * **Delay (Tape):** Slapback (100 ms), Feedback 20%.
   * **Reverb (Plate):** Mix 20%, Decay 1.8s.
3. **Liquid Trance Lead:**
   * **PWM LFO:** 0.3 Hz, Depth 20%.
   * **Ping-Pong Delay:** 1/8d, **Feedback LPF: 2000Hz (darkening)**.

---

## 4. Специфические алгоритмы жанров

### One-Drop Sync (Reggae)
*   **Phase Lock**: Фаза басового осциллятора принудительно сбрасывается в 0 при каждом ударе бочки на 3-й доле. Это устраняет фазовые вычитания и делает One-Drop максимально весомым.

### Mincer Arp (Foundry)
*   **Density Guard**: При достижении порога в 4 ноты на такт, алгоритм отфильтровывает все ноты, не попадающие в «Золотую Сетку» (0, 3, 6, 9 тики).

---

## 5. Алгоритм динамического Glide (Legacy)
$$T_{glide} = T_{base} \cdot f(\Delta Pitch) \cdot g(Velocity)$$
* Множитель расстояния: $f(\Delta Pitch) = 1 + 0.5 \cdot \ln(1 + |\Delta Pitch|)$
* Множитель силы удара: $g(Velocity) = 1 - 0.6 \cdot \left(\frac{Velocity}{127}\right)$
