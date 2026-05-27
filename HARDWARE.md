# Hardware Reference — Smart Pet Care

All sensor specs, wiring diagrams, sampling rates, noise characteristics, and I2C addresses.  
For context on how other subteams use their hardware, see the ecosystem overview at the bottom.

> **Datasheet sources:** `hardware/UnoQ/ABX00162-ABX00173-datasheet.pdf` and `hardware/PlugandMakeKit/AKX00069-datasheet.pdf`

---

## Our Hardware Stack

```
Arduino UNO Q  (main hub)
    │
    ├── [Qwiic daisy-chain] ─────────────────────────────────────────────────┐
    │       Modulino DISTANCE  (0x29)  ← food bowl level (ToF laser)         │
    │       Modulino THERMO    (0x44)  ← room temperature + humidity          │
    │       Modulino MOVEMENT  (0x6A)  ← cat activity detection (IMU)         │
    │       Modulino PIXELS    (0x6C)  ← status beacon (8x RGB LED)           │
    │       Modulino BUZZER    (0x3C)  ← temperature alert (audio)            │
    │                                                                         │
    ├── [WiFi] ── Phone camera app (HTTP snapshot) ──────────────────────────┘
    │
    └── [WiFi] ── HTTP Dashboard → Nat's phone/laptop
```

---

## Arduino UNO Q — Board Specs (from datasheet)

The UNO Q is **not** a simple microcontroller. It has two separate processors on one board:

```
┌─────────────────────────────────────────────────────┐
│  Arduino UNO Q                                      │
│                                                     │
│  MPU: Qualcomm QRB2210 (Dragonwing™)                │
│       4× Cortex-A53 @ 2.0 GHz                      │
│       Runs Debian Linux                             │
│       1.8V I/O, 1–4 GB LPDDR4X, 16–32 GB eMMC      │
│                                                     │
│  MCU: STM32U585 (Cortex-M33 @ up to 160 MHz)        │
│       Runs Arduino sketches or Zephyr OS            │
│       3.3V I/O                                      │
│       Controls all the Qwiic/I2C pins               │
│                                                     │
│  Wireless: WCBN3536A module                         │
│       Wi-Fi 5 (802.11 a/b/g/n/ac, dual-band 2.4/5GHz)│
│       Bluetooth 5.1                                 │
└─────────────────────────────────────────────────────┘
```

**Think of it this way:** The MPU is like a tiny laptop running Linux. The MCU is like a normal Arduino. They talk to each other internally. When you upload a sketch via Arduino IDE, it goes to the MCU.

### Power specs (from datasheet)

| Parameter | Min | Typical | Max |
|-----------|-----|---------|-----|
| USB-C input | 4.5V | 5V | 5.5V |
| DC IN (barrel) | 7V | — | 24V |
| 3.3V rail output | 3.1V | 3.3V | 3.5V |
| Operating temperature | −10°C | — | 60°C |

### Key I2C note for Qwiic

| Property | Value |
|----------|-------|
| Qwiic connector | QWIIC1 — maps to I²C4 (IC4) |
| Arduino variable | `Wire1` (NOT `Wire`) |
| Voltage | 3.3V only — never connect 5V devices |
| Max cable per segment | 1.2 m |

```cpp
// Required in every sketch that uses Modulino:
#include "Arduino_Modulino.h"
Modulino.begin();   // initializes Qwiic/I2C on Wire1
```

---

## Qwiic Wiring

All Modulino modules connect to UNO Q via **daisy-chain**:

```
UNO Q [Qwiic] ──cable──> DISTANCE [Qwiic out] ──cable──> THERMO [Qwiic out] ──cable──> MOVEMENT ...
                                                                                              └──> PIXELS ──> BUZZER
```

**Rules:**
- Order in chain doesn't matter — all share one I2C bus
- Each module has a unique I2C address — no conflict in our set
- Polarized connector — cannot plug in backwards
- Max 1.2 m per cable segment; use shorter cables when possible

**Cable color code:**

| Color | Signal | Purpose |
|-------|--------|---------|
| Yellow | SCL | I2C clock |
| Blue | SDA | I2C data |
| Red | 3.3V | Power from UNO Q |
| Black | GND | Ground |

---

## I2C Address Reference

There are **two** address types per module. Always use the **Modulino library address** in code:

| Module | Chip / Actuator | Modulino Library Addr | Hardware Addr (I2C scan) | Used by us |
|--------|----------------|----------------------|--------------------------|-----------|
| DISTANCE | VL53L4CDV0DH/1 | **0x29** | 0x29 | Yes — food bowl |
| THERMO | HS3003 | **0x44** | 0x44 | Yes — room climate |
| MOVEMENT | LSM6DSOXTR | **0x6A** | 0x6A (alt 0x7E via jumper) | Yes — cat activity |
| PIXELS | 8× LC8822-2020 | **0x6C** | 0x36 | Yes — status beacon |
| BUZZER | PKLCS1212E4001 | **0x3C** | 0x1E | Yes — heat alert |
| KNOB | PEC11J-9215F-S0015 | **0x76** | 0x3A | In kit, not used |
| BUTTONS | 3× SPST | **0x7C** | 0x3E | In kit, not used |

**Why two addresses?** The Modulino board has its own microcontroller (STM32C011F4) that bridges between I2C and the sensor chip. The library talks to the STM32, which talks to the sensor. So you always use the Modulino address in your code, not the chip's native address.

**Note on MOVEMENT address:** If you ever need two MOVEMENT modules on the same bus (not our case), cut the 0x6A hardware jumper and short 0x6B on the second one. Never short both simultaneously — will damage the board.

---

## Sensor 1: Modulino DISTANCE

**Job:** Measure food bowl fill level.  
**Chip:** VL53L4CDV0DH/1 (Time-of-Flight laser ranging)  
**Modulino I2C Address:** 0x29

### How it works

Shoots an invisible laser downward, measures how long it takes to bounce back. Mounted above the bowl:

```
  [DISTANCE sensor] — mounted above bowl, pointing straight down
        │ laser
        ↓
  ══════════════  ← food surface   (near = bowl full, e.g., 3 cm)
  ~~food~~~~~~~~
  ══════════════  ← bowl bottom    (far = bowl empty, e.g., 15 cm)
```

### Key specs (from datasheet)

| Property | Value |
|----------|-------|
| Chip | VL53L4CDV0DH/1 |
| Supply voltage | 2.6V min, 3.5V max |
| Power consumption | 40 mA peak, 24 mA active ranging, 4 mA I2C standby |
| Range | 0–1200 mm (0–120 cm) |
| Accuracy | **±7 mm** (short range) to **±3%** (longer range) |
| Resolution | 1 mm |
| Communication | I2C |
| Sampling rate | ~10 Hz (`delay(100)`) |

**Accuracy note:** ±7mm = ±0.7cm at close distances. At 100cm, ±3% = ±3cm. For our bowl (3–15cm range), expect ±0.7–1cm accuracy — more than enough for fill level.

### Sensor noise & limitations

- **Surface reflectivity:** Dark or matte surfaces absorb the laser → reads slightly farther than reality. Prefer a light-colored bowl or calibrate with your actual bowl.
- **Angle:** Must point perpendicular to the food surface. Angled mount = inaccurate reading.
- **Sunlight:** Strong ambient IR (outdoor sun near a window) can saturate the sensor. Keep indoors away from direct sunlight.
- **Line-of-sight only:** Cannot measure through the bowl wall.

### Bowl fill calculation

```cpp
// Calibrate these with your actual bowl:
const int BOWL_EMPTY_CM = 15;  // sensor reading when bowl is empty
const int BOWL_FULL_CM  = 3;   // sensor reading when bowl is full

int fill_pct = (BOWL_EMPTY_CM - measured_cm) * 100
               / (BOWL_EMPTY_CM - BOWL_FULL_CM);
fill_pct = constrain(fill_pct, 0, 100);
// 0% = empty, 100% = full
```

### Functions

```cpp
ModulinoDistance distance;
distance.begin();

if (distance.available()) {   // true when new reading ready
    int cm = distance.get();  // returns cm as int
}
```

---

## Sensor 2: Modulino THERMO

**Job:** Monitor room temperature and humidity for cat comfort.  
**Chip:** HS3003 (capacitive humidity + resistive temperature)  
**Modulino I2C Address:** 0x44

### Key specs (from datasheet)

| Property | Value |
|----------|-------|
| Chip | HS3003 |
| Supply voltage | 2.3V min, 5.5V max |
| Power consumption | 24.4 µA (at 14-bit resolution, 3.3V supply) |
| Temperature range | −40°C to +125°C |
| Humidity range | 0% to 100% RH |
| Temperature accuracy | **±0.25°C** |
| Humidity accuracy | **±2.8% RH** |
| Resolution | 14-bit for both temperature and humidity |
| Communication | I2C |
| Sampling rate | max ~2 Hz; use `delay(1000)` = 1 Hz in our sketch |

### Sensor noise & limitations

- **Slow thermal mass:** If you carry the sensor from a cold room to a hot room, it takes 1–2 minutes to stabilize. Normal behavior. Not suitable for detecting sudden heat bursts (stove turning on).
- **Self-heating:** Electronics near the sensor (including the UNO Q board itself) radiate heat and can read +1–2°C too high if the sensor is enclosed. Place it in open air, away from the board.
- **Humidity stabilization:** After being in a new environment, humidity reading takes 5–10 min to stabilize.
- **Best placement:** Open air at cat height (~30 cm off floor), away from electronics and walls.

### Cat comfort thresholds

| State | Temperature |
|-------|------------|
| Too cold | < 15°C |
| Comfortable | 18–26°C |
| Warm — watch | 26–30°C |
| Too hot — alert | > 30°C |

### Functions

```cpp
ModulinoThermo thermo;
thermo.begin();

float temp = thermo.getTemperature();  // °C
float hum  = thermo.getHumidity();    // %
```

---

## Sensor 3: Modulino MOVEMENT

**Job:** Detect cat activity — is Mango moving around, or has she been still for too long?  
**Chip:** LSM6DSOXTR (6-axis IMU: 3-axis accelerometer + 3-axis gyroscope)  
**Modulino I2C Address:** 0x6A

### Key specs (from datasheet)

| Property | Value |
|----------|-------|
| Chip | LSM6DSOXTR |
| Supply voltage | 1.71V min, 3.6V max |
| Power consumption | Accel only: **170 µA** / Gyro: **0.55 mA** |
| Accelerometer range | ±2g / ±4g / ±8g / ±16g (selectable) |
| Accelerometer resolution | 0.061 mg/LSB (±2g) to 0.488 mg/LSB (±16g) |
| Accelerometer accuracy | **±20 mg** (zero-g offset) |
| Gyroscope range | ±125 / ±250 / ±500 / ±1000 / ±2000 dps (selectable) |
| Gyroscope resolution | 4.375 mdps/LSB (±125dps) to 70 mdps/LSB (±2000dps) |
| Gyroscope accuracy | **±1 dps** (zero-rate offset) |
| Output | Accel in **g**, Gyro in **dps** (degrees/second) |
| Hardware max sample rate | 6664 Hz |
| Practical sampling rate | ~5 Hz at `delay(200)`, ~20 Hz at `delay(50)` |

**What ±20 mg accuracy means:** At rest, the accelerometer may read up to 0.02g away from the true value. This is why calibration is mandatory — you measure the resting baseline and subtract it.

### Sensor noise & calibration — CRITICAL

At rest, the sensor does **not** read exactly zero:

```
Raw at rest:    X = 0.12,  Y = -0.08,  Z = 9.65
Expected:       X = 0,     Y = 0,      Z = 9.81  (gravity)
```

Sources of offset: factory bias (up to ±20 mg), temperature, tiny physical tilt, ambient vibration.

**Without calibration:** the system will falsely report constant motion even when nothing moves, and Roll/Pitch/Yaw will slowly drift.

**Calibration routine** (run once in `setup()`, takes ~1 second):

```cpp
float baseX, baseY, baseZ;  // global baselines

void calibrateSensor() {
    float sumX = 0, sumY = 0, sumZ = 0;
    const int samples = 50;
    for (int i = 0; i < samples; i++) {
        movement.update();
        sumX += movement.getX();
        sumY += movement.getY();
        sumZ += movement.getZ();
        delay(20);
    }
    baseX = sumX / samples;
    baseY = sumY / samples;
    baseZ = sumZ / samples;
}
```

**Motion detection after calibration:**

```cpp
movement.update();
float dx = abs(movement.getX() - baseX);
float dy = abs(movement.getY() - baseY);
bool catMoved = (dx > 0.15 || dy > 0.15);   // 0.15g threshold
```

### Placement strategy for pet tracking

Mount on a surface the cat interacts with (feeding mat, shelf edge, door frame nearby). Vibration from cat footsteps or the cat brushing past will exceed the threshold.

```
Cat walks past sensor zone → vibration → deltaX or deltaY > 0.15g → activity logged
Cat inactive for 60+ minutes → INACTIVE_WARNING state
```

### Limitations

- **Detects vibration/movement near the sensor, not the cat's location.** Cannot track where the cat is — only whether there was motion in the sensor's vicinity.
- **Gyro drift:** Roll/Pitch/Yaw values drift over time even when still. For pet activity, use only accelerometer (getX/Y/Z) — avoid gyro readings.
- **Building vibration:** AC units, footsteps in the building, or doors closing can trigger false positives. Tune threshold based on your environment.
- **No magnetometer** on this module — no absolute orientation.

### Functions

```cpp
ModulinoMovement movement;
movement.begin();

movement.update();          // MUST call before reading
movement.getX();            // accel X in g
movement.getY();            // accel Y in g
movement.getZ();            // accel Z in g (≈1.0 at rest, flat)
movement.getRoll();         // gyro roll in dps  — avoid for pet tracking
movement.getPitch();        // gyro pitch in dps — avoid for pet tracking
movement.getYaw();          // gyro yaw in dps   — avoid for pet tracking
```

---

## Output 1: Modulino PIXELS

**Job:** Status beacon — visible color indicator of Mango's current state.  
**Chip:** STM32C011F4 + 8× LC8822-2020 RGB LEDs  
**Modulino I2C Address:** 0x6C

### Key specs (from datasheet)

| Property | Value |
|----------|-------|
| LEDs | 8 individually addressable RGB (LC8822-2020) |
| Microcontroller | STM32C011F4 |
| Supply voltage | 2.0V min, 3.6V max |
| Power consumption | **33 mA per LED @ 3.3V** (×8 LEDs) + 3.4 mA MCU = up to **267 mA max** (all LEDs full white) |
| LED index | 0–7 |
| Colors (library) | RED, GREEN, BLUE, VIOLET, WHITE |
| Brightness | 0 (off) to 255 (max), 8-bit per channel |
| Communication | I2C |

**Power note:** All 8 LEDs at full brightness can draw up to ~267 mA. Keep brightness ≤ 80 (out of 255) unless you need it very bright — this keeps power draw comfortable.

### State → color mapping (our scheme)

| State | Color | Meaning |
|-------|-------|---------|
| ALL_OK | GREEN | Mango is fine |
| HUNGRY | VIOLET | Bowl below 30% |
| TOO_HOT | RED | Room above 30°C |
| INACTIVE_WARNING | BLUE | No movement for 60+ min |

### Functions

```cpp
ModulinoPixels leds;
leds.begin();

leds.set(0, GREEN, 50);   // index, color, brightness
leds.show();              // REQUIRED — nothing displays until show() is called
```

**Common mistake:** Calling `leds.set()` but forgetting `leds.show()`. Nothing will change on the hardware without `show()`.

### Set all 8 to one color

```cpp
void setAllColor(uint8_t color, uint8_t brightness) {
    for (int i = 0; i < 8; i++) {
        leds.set(i, color, brightness);
    }
    leds.show();
}
```

---

## Output 2: Modulino BUZZER

**Job:** Audio alert when room temperature is dangerously high.  
**Chip:** STM32C011F4 + passive buzzer (PKLCS1212E4001)  
**Modulino I2C Address:** 0x3C  
**Hardware I2C Address (for reference only):** 0x1E

### Key specs (from datasheet)

| Property | Value |
|----------|-------|
| Actuator | 1× passive buzzer |
| Microcontroller | STM32C011F4 |
| Supply voltage | 2.0V min, 3.6V max |
| Power consumption | **6.4 mA** |
| ADC resolution | 12-bit (±2 LSB typical INL) |
| Frequency range | NOTE_B0 (31 Hz) to NOTE_C8 (4186 Hz) |
| Duration control | Milliseconds |
| Stop | `tone(0, 10)` |
| Volume | Fixed (no amplitude control) |
| Polyphony | Single tone only |
| Communication | I2C |

### Alert pattern for heat warning

```cpp
ModulinoBuzzer buzzer;
buzzer.begin();

void heatAlert() {
    for (int i = 0; i < 3; i++) {
        buzzer.tone(880, 300);   // 880 Hz = high urgency
        delay(500);
    }
    buzzer.tone(0, 10);          // stop
}
```

### Useful frequencies

| Use | Frequency |
|-----|-----------|
| Calm notice | 440 Hz |
| Moderate alert | 660 Hz |
| Urgent alert | 880–1000 Hz |

### Limitations

- One tone at a time — no chord
- Volume is fixed — may be inaudible in noisy spaces
- Avoid running `buzzer.tone()` too frequently — let it finish before calling again

---

## Architecture Diagram — Smart Pet Care

```
┌────────────────────────────────────────────────────────────────┐
│  SMART PET CARE — HARDWARE ARCHITECTURE                        │
│                                                                │
│  Arduino UNO Q                                                 │
│  │                                                             │
│  ├── [Qwiic I2C4 / Wire1]                                      │
│  │       │                                                     │
│  │       ├── DISTANCE (0x29)  ←  above food bowl, down-facing  │
│  │       │       └── int cm = distance.get()                   │
│  │       │           → fill_pct calculation                    │
│  │       │                                                     │
│  │       ├── THERMO (0x44)    ←  open air at cat height        │
│  │       │       └── float temp = thermo.getTemperature()      │
│  │       │           float hum  = thermo.getHumidity()         │
│  │       │                                                     │
│  │       ├── MOVEMENT (0x6A)  ←  near cat activity zone        │
│  │       │       └── movement.update(); getX(), getY()         │
│  │       │           → delta vs calibrated baseline            │
│  │       │                                                     │
│  │       ├── PIXELS (0x6C)    →  visible status beacon         │
│  │       │       └── leds.set(i, color, brightness); show()    │
│  │       │                                                     │
│  │       └── BUZZER (0x3C)    →  heat alert tone               │
│  │               └── buzzer.tone(880, 300)                     │
│  │                                                             │
│  ├── [WiFi Client] ←── Smartphone IP camera app               │
│  │       └── HTTP GET http://<phone_ip>/shot.jpg               │
│  │           → snapshot on dashboard                           │
│  │                                                             │
│  └── [WiFi AP/Server] ──→ HTTP Dashboard                       │
│          └── Nat's phone/laptop browser                        │
│              shows: bowl%, temp°C, activity, state, snapshot   │
└────────────────────────────────────────────────────────────────┘
```

### Signal flow

```
DISTANCE (bowl cm)
THERMO   (temp °C, humidity %)       →  UNO Q processes  →  State
MOVEMENT (deltaX, deltaY vs baseline)                          │
                                                               ↓
                                                    ALL_OK / HUNGRY / TOO_HOT / INACTIVE
                                                               │
                                              ┌────────────────┴──────────────────┐
                                              ↓                                   ↓
                                    PIXELS + BUZZER                         Dashboard
                                    (on-device feedback)               (remote, Nat's phone)
```

### State logic

| State | Condition | PIXELS | BUZZER |
|-------|-----------|--------|--------|
| ALL_OK | temp 15–30°C AND bowl ≥ 30% AND active | GREEN | silent |
| HUNGRY | bowl < 30% | VIOLET | silent |
| TOO_HOT | temp > 30°C | RED | 3x 880Hz beep |
| INACTIVE | no movement > 60 min | BLUE | silent |

Priority: TOO_HOT > HUNGRY > INACTIVE > ALL_OK

---

## Camera via WiFi

No direct USB camera connection is allowed. Use a smartphone IP camera app:

```
Smartphone
  → install "IP Webcam" (Android) or "EpocCam" (iOS)
  → connect to same WiFi as UNO Q
  → app exposes: http://<phone_ip>:8080/shot.jpg

UNO Q
  → HTTP GET http://<phone_ip>:8080/shot.jpg
  → embed image URL in dashboard HTML
  → browser auto-refreshes the <img> tag
```

This gives a periodic snapshot (not live stream) — sufficient for welfare checks.

---

## Critical Limitations for Our Subteam

| Constraint | What it means for us | Workaround |
|------------|---------------------|------------|
| MOVEMENT needs calibration | Without it: constant false activity alerts | Always run `calibrateSensor()` in `setup()` |
| MOVEMENT accel offset ±20 mg | Raw readings always slightly wrong | Baseline subtraction after calibration |
| THERMO slow response (30–60s) | Can't detect sudden heat spikes | Use for ambient monitoring; alert only on sustained heat |
| THERMO accuracy ±0.25°C | Small but real error | Fine for our 30°C threshold |
| DISTANCE line-of-sight only | Can't read through bowl walls | Mount directly above bowl, pointing down |
| DISTANCE affected by dark surfaces | Dark bowl may read slightly farther | Calibrate `BOWL_EMPTY_CM` and `BOWL_FULL_CM` with your actual bowl |
| DISTANCE max range 120 cm | Beyond that = no valid reading | Not a problem; bowl is within 20 cm |
| Qwiic 3.3V only | 5V sensors will damage modules | Only use Modulino modules on Qwiic |
| Qwiic max 1.2m cable | Limited reach from UNO Q | Place UNO Q centrally; daisy-chain extends total reach |
| PIXELS up to 267 mA (all LEDs full) | Can stress USB power if combined with other loads | Keep brightness ≤ 80 during normal operation |
| PIXELS needs `show()` | LEDs will not update without it | Always call `leds.show()` after every `leds.set()` |
| No USB camera | Can't use TinyML camera kit via cable | Use smartphone IP camera app over WiFi |
| Gyro drift on MOVEMENT | Yaw/Pitch/Roll wander over time | Use only accelerometer axes (getX/Y/Z) for activity detection |

---

## All Modulino Modules — Quick Reference (full kit)

Modules not used by Smart Pet Care are listed for reference (other subteams may use them).

| Module | Chip | Supply | Power | Accuracy | Resolution | Used by us |
|--------|------|--------|-------|----------|------------|-----------|
| DISTANCE | VL53L4CDV0DH/1 | 2.6–3.5V | 40mA peak / 24mA ranging | ±7mm to ±3% | 1mm | **Yes** |
| THERMO | HS3003 | 2.3–5.5V | 24.4 µA | Temp ±0.25°C / RH ±2.8% | 14-bit | **Yes** |
| MOVEMENT | LSM6DSOXTR | 1.71–3.6V | 170µA (accel) / 0.55mA (gyro) | ±20 mg / ±1 dps | 0.061mg/LSB / 4.375mdps/LSB | **Yes** |
| PIXELS | 8× LC8822-2020 | 2.0–3.6V | 33mA×8 + 3.4mA | — | 8-bit per channel | **Yes** |
| BUZZER | PKLCS1212E4001 | 2.0–3.6V | 6.4 mA | ADC ±2 LSB INL | 12-bit ADC | **Yes** |
| KNOB | Quadrature encoder | 2.0–3.6V | 3.4 mA | Oscillator ±1% | 12-bit ADC | No |
| BUTTONS | 3× SPST | 2.0–3.6V | 2.5mA×3 + 3.4mA | ADC ±2 LSB INL | 12-bit ADC | No |

---

## Other Subteams — Brief Context

These teams share the same hardware kit. Understanding their setup helps during integration or shared dashboard work.

**Smart Pillbox** — UNO Q + Qwiic chain (DISTANCE for lid detection, THERMO for storage temp, BUTTONS for confirm/snooze, PIXELS + BUZZER for reminder feedback) + Nano 33 BLE Sense over BLE (detects box being handled). States: TAKEN / SNOOZED / MISSED / HESITATED.

**Smart Gait Aid** — Nano 33 BLE Sense mounted on the walker (IMU + TinyML gait classifier) sends state over BLE to UNO Q. UNO Q drives PIXELS (green/amber/red handle ring) + BUZZER (cadence cue). States: NORMAL_GAIT / ASYMMETRIC / FALL_RISK. This team uses the Nano 33 BLE Sense heavily; we do not.
