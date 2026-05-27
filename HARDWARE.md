# Hardware Reference — Arduino Nano Runner Cheststrap

All sensor specs, wiring diagrams, sampling rates, noise characteristics, and I²C addresses.

> **Datasheet sources:** `hardware/UnoQ/ABX00162-ABX00173-datasheet.pdf` and `hardware/PlugandMakeKit/AKX00069-datasheet.pdf`

---

## Hardware Stack

```
Arduino Nano 33 BLE Sense Rev1  (primary — chest-mounted)
    │
    ├── LSM9DS1  (built-in 9-axis IMU)  ← accel + gyro + mag → motion analysis
    ├── MP34DT05 (built-in MEMS mic)    ← optional audio
    ├── APDS-9960 (built-in gesture)    ← optional proximity / light
    │
    ├── [A7 analog pin] ─────────────── OJFF14 sound sensor
    │
    └── [Tiny ML Shield] ─────────────── OV7675 camera

Arduino UNO Q  (secondary hub — optional dashboard/Qwiic expansion)
    │
    ├── [Qwiic daisy-chain / Wire1] ──────────────────────────────────┐
    │       Modulino DISTANCE  (0x29)  ← range sensing (ToF laser)   │
    │       Modulino THERMO    (0x44)  ← temperature + humidity       │
    │       Modulino MOVEMENT  (0x6A)  ← motion detection (6-axis IMU)│
    │       Modulino PIXELS    (0x6C)  ← 8× RGB status LEDs           │
    │       Modulino BUZZER    (0x3C)  ← audio feedback               │
    │       Modulino KNOB      (0x76)  ← rotary input                 │
    │       Modulino BUTTONS   (0x7C)  ← 3× tactile buttons           │
    │                                                                  │
    └── [WiFi] ── HTTP Dashboard → browser                            │
```

---

## Arduino UNO Q — Board Specs

The UNO Q has two separate processors on one board:

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

The MPU runs Linux; the MCU runs the Arduino sketch. Arduino IDE uploads to the MCU.

### Power specs

| Parameter | Min | Typical | Max |
|-----------|-----|---------|-----|
| USB-C input | 4.5V | 5V | 5.5V |
| DC IN (barrel) | 7V | — | 24V |
| 3.3V rail output | 3.1V | 3.3V | 3.5V |
| Operating temperature | −10°C | — | 60°C |

### I2C / Qwiic note

| Property | Value |
|----------|-------|
| Qwiic connector | QWIIC1 — maps to I²C4 (IC4) |
| Arduino variable | `Wire1` (NOT `Wire`) |
| Voltage | 3.3V only — never connect 5V devices |
| Max cable per segment | 1.2 m |

```cpp
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
- Each module has a unique I2C address — no conflict
- Polarized connector — cannot plug in backwards
- Max 1.2 m per cable segment

**Cable color code:**

| Color | Signal | Purpose |
|-------|--------|---------|
| Yellow | SCL | I2C clock |
| Blue | SDA | I2C data |
| Red | 3.3V | Power from UNO Q |
| Black | GND | Ground |

---

## I2C Address Reference

Always use the **Modulino library address** in code — not the hardware scan address:

| Module | Chip / Actuator | Modulino Library Addr | Hardware Addr (I2C scan) |
|--------|----------------|----------------------|--------------------------|
| DISTANCE | VL53L4CDV0DH/1 | **0x29** | 0x29 |
| THERMO | HS3003 | **0x44** | 0x44 |
| MOVEMENT | LSM6DSOXTR | **0x6A** | 0x6A (alt 0x7E via jumper) |
| PIXELS | 8× LC8822-2020 | **0x6C** | 0x36 |
| BUZZER | PKLCS1212E4001 | **0x3C** | 0x1E |
| KNOB | PEC11J-9215F-S0015 | **0x76** | 0x3A |
| BUTTONS | 3× SPST | **0x7C** | 0x3E |

**Why two addresses?** The Modulino board has its own microcontroller (STM32C011F4) that bridges between I2C and the sensor chip. The library talks to the STM32, which talks to the sensor.

**Note on MOVEMENT address:** If you need two MOVEMENT modules on the same bus, cut the 0x6A hardware jumper and short 0x6B on the second one. Never short both simultaneously.

---

## Sensor 1: Modulino DISTANCE

**Job:** Time-of-flight range measurement (0–1200 mm).  
**Chip:** VL53L4CDV0DH/1 (ToF laser ranging)  
**Modulino I2C Address:** 0x29

### How it works

Shoots an invisible laser, measures round-trip time. Returns distance in mm.

### Key specs

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

### Noise & limitations

- **Surface reflectivity:** Dark or matte surfaces absorb the laser → reads slightly farther. Calibrate with your actual target surface.
- **Angle:** Must point perpendicular to the target surface.
- **Sunlight:** Strong ambient IR can saturate the sensor. Keep away from direct sunlight.

### Range measurement

```cpp
// Calibrate EMPTY and FULL distances for your application:
const int RANGE_FAR_MM  = 1200;  // maximum / empty
const int RANGE_NEAR_MM = 30;    // minimum / full

int pct = (RANGE_FAR_MM - measured_mm) * 100
          / (RANGE_FAR_MM - RANGE_NEAR_MM);
pct = constrain(pct, 0, 100);
```

### Functions

```cpp
ModulinoDistance distance;
distance.begin();

if (distance.available()) {
    int cm = distance.get();
}
```

---

## Sensor 2: Modulino THERMO

**Job:** Measure ambient temperature and humidity.  
**Chip:** HS3003 (capacitive humidity + resistive temperature)  
**Modulino I2C Address:** 0x44

### Key specs

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
| Sampling rate | max ~2 Hz; use `delay(1000)` = 1 Hz |

### Noise & limitations

- **Slow thermal mass:** Takes 1–2 minutes to stabilize after moving between environments.
- **Self-heating:** Electronics near the sensor can read +1–2°C too high. Place in open air, away from the board.
- **Humidity stabilization:** Takes 5–10 min in a new environment.

### Functions

```cpp
ModulinoThermo thermo;
thermo.begin();

float temp = thermo.getTemperature();  // °C
float hum  = thermo.getHumidity();    // %
```

---

## Sensor 3: Modulino MOVEMENT

**Job:** Detect motion and orientation via 6-axis IMU.  
**Chip:** LSM6DSOXTR (3-axis accelerometer + 3-axis gyroscope)  
**Modulino I2C Address:** 0x6A

### Key specs

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
| Output | Accel in **g**, Gyro in **dps** |
| Hardware max sample rate | 6664 Hz |
| Practical sampling rate | ~5 Hz at `delay(200)`, ~20 Hz at `delay(50)` |

### Sensor noise & calibration — CRITICAL

At rest, the sensor does **not** read zero:

```
Raw at rest:    X = 0.12,  Y = -0.08,  Z = 9.65
Expected:       X = 0,     Y = 0,      Z = 9.81  (gravity)
```

**Without calibration:** false motion detected constantly; Roll/Pitch/Yaw drifts.

**Calibration routine:**

```cpp
float baseX, baseY, baseZ;

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
bool hasMoved = (dx > 0.15 || dy > 0.15);   // 0.15g threshold
```

### Limitations

- **Gyro drift:** Roll/Pitch/Yaw values drift over time even when still.
- **Building vibration:** AC units, doors closing can trigger false positives. Tune threshold to your environment.
- **No magnetometer** on this module — no absolute orientation.

### Functions

```cpp
ModulinoMovement movement;
movement.begin();

movement.update();          // MUST call before reading
movement.getX();            // accel X in g
movement.getY();            // accel Y in g
movement.getZ();            // accel Z in g (≈1.0 at rest, flat)
movement.getRoll();         // gyro roll in dps
movement.getPitch();        // gyro pitch in dps
movement.getYaw();          // gyro yaw in dps
```

---

## Output 1: Modulino PIXELS

**Job:** Visual status indicator (8 individually addressable RGB LEDs).  
**Chip:** STM32C011F4 + 8× LC8822-2020 RGB LEDs  
**Modulino I2C Address:** 0x6C

### Key specs

| Property | Value |
|----------|-------|
| LEDs | 8 individually addressable RGB (LC8822-2020) |
| Microcontroller | STM32C011F4 |
| Supply voltage | 2.0V min, 3.6V max |
| Power consumption | **33 mA per LED @ 3.3V** (×8) + 3.4 mA MCU = up to **267 mA max** (all LEDs full white) |
| LED index | 0–7 |
| Colors (library) | RED, GREEN, BLUE, VIOLET, WHITE |
| Brightness | 0 (off) to 255 (max), 8-bit per channel |
| Communication | I2C |

**Power note:** Keep brightness ≤ 80 out of 255 for normal operation to limit draw to ~100 mA.

### Functions

```cpp
ModulinoPixels leds;
leds.begin();

leds.set(0, GREEN, 50);   // index, color, brightness
leds.show();              // REQUIRED — nothing displays until show() is called
```

**Common mistake:** Calling `leds.set()` but forgetting `leds.show()`.

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

**Job:** Audio feedback / alerts.  
**Chip:** STM32C011F4 + passive buzzer (PKLCS1212E4001)  
**Modulino I2C Address:** 0x3C

### Key specs

| Property | Value |
|----------|-------|
| Actuator | 1× passive buzzer |
| Microcontroller | STM32C011F4 |
| Supply voltage | 2.0V min, 3.6V max |
| Power consumption | **6.4 mA** |
| Frequency range | NOTE_B0 (31 Hz) to NOTE_C8 (4186 Hz) |
| Duration control | Milliseconds |
| Volume | Fixed (no amplitude control) |
| Polyphony | Single tone only |
| Communication | I2C |

### Usage

```cpp
ModulinoBuzzer buzzer;
buzzer.begin();

buzzer.tone(880, 300);   // 880 Hz for 300 ms
delay(500);
buzzer.tone(0, 10);      // stop
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
- Avoid calling `buzzer.tone()` too rapidly

---

## Input: Modulino KNOB

**Chip:** STM32C011F4 + Quadrature Rotary Encoder  
**Modulino I2C Address:** 0x76

```cpp
ModulinoKnob knob;
knob.begin();

int pos  = knob.get();     // position (increments/decrements on rotate)
bool btn = knob.isPressed(); // true when knob is pressed
```

---

## Input: Modulino BUTTONS

**Chip:** STM32C011F4 + 3× SPST push buttons + 3× LEDs  
**Modulino I2C Address:** 0x7C

```cpp
ModulinoButtons buttons;
buttons.begin();

buttons.update();                  // MUST call before reading
bool a = buttons.isPressed(0);    // button A
bool b = buttons.isPressed(1);    // button B
bool c = buttons.isPressed(2);    // button C
```

---

## Arduino Nano 33 BLE Sense Rev1 — Built-in Sensors

### LSM9DS1 — 9-axis IMU (primary sensor for this project)

```cpp
#include <Arduino_LSM9DS1.h>

IMU.begin();

float ax, ay, az;
if (IMU.accelerationAvailable()) IMU.readAcceleration(ax, ay, az);  // g

float gx, gy, gz;
if (IMU.gyroscopeAvailable())   IMU.readGyroscope(gx, gy, gz);     // dps

float mx, my, mz;
if (IMU.magneticFieldAvailable()) IMU.readMagneticField(mx, my, mz); // µT
```

Converted to SI units for downstream integration:
- Acceleration: `value_g × 9.80665` → m/s²
- Gyroscope: `value_dps × π/180` → rad/s

| Property | Value |
|----------|-------|
| Accelerometer range | ±2 / ±4 / ±8 / ±16 g |
| Gyroscope range | ±245 / ±500 / ±2000 dps |
| Magnetometer range | ±4 / ±8 / ±12 / ±16 gauss |
| Resolution | 16-bit |
| Power | 2 mA |

### APDS-9960 — Proximity / Light / Gesture

| Property | Value |
|----------|-------|
| Functions | Proximity, ambient light, RGB color, gesture |
| Gestures | UP / DOWN / LEFT / RIGHT |
| Power | 798 µA |

### MP34DT05 — MEMS Microphone

| Property | Value |
|----------|-------|
| SNR | 64 dB |
| AOP | 122.5 dBSPL |
| Pattern | Omnidirectional |
| Power | 650 µA |

### HTS221 — Humidity + Temperature (on-board)

| Property | Value |
|----------|-------|
| Humidity range | 0–100% RH, ±3.5% (20–80%) |
| Temperature accuracy | ±0.5°C (15–40°C) |
| Power | 2 µA |

### LPS22HB — Barometer

| Property | Value |
|----------|-------|
| Pressure range | 260–1260 hPa |
| Precision | 24-bit |
| Output rate | 1–75 Hz |
| Power | 12 µA |

---

## OJFF14 Sound Sensor Wiring

| OJFF14 pin | Nano 33 BLE Sense |
|------------|-------------------|
| S | A7 |
| + | 3V3 |
| − | GND |

> Nano 33 BLE analog inputs are **not 5V tolerant**. Power OJFF14 from 3.3V directly. If using 5V supply, add a voltage divider or level shifter on the signal line.

Sampling (32 samples, ~4 ms):

```cpp
const int SOUND_PIN = A7;
analogReadResolution(12);

int minRaw = 4095, maxRaw = 0;
long sum = 0;
for (int i = 0; i < 32; i++) {
    int v = analogRead(SOUND_PIN);
    if (v < minRaw) minRaw = v;
    if (v > maxRaw) maxRaw = v;
    sum += v;
    delayMicroseconds(120);
}
int soundRaw  = sum / 32;
int soundPeak = maxRaw - minRaw;              // peak-to-peak amplitude
float soundLevel = constrain(soundPeak / 900.0f, 0.0f, 1.0f); // normalized 0–1
```

---

## OV7675 Camera Module

**Interface:** 8-bit parallel DVP + SCCB (I2C-like) config  
**Mount:** Arduino Tiny Machine Learning Shield

| Property | Value |
|----------|-------|
| Active array | 640 × 480 (VGA) |
| Max frame rate | 30 fps (VGA) / 240 fps (QQVGA 160×120) |
| Data formats | YUV4:2:2, Raw RGB, RGB565 |
| Active power | 98 mW |
| Standby power | 60 µW |

**Practical mode for Nano 33 BLE Sense:** 160×120 greyscale @ 15 fps — reduces data 48× vs RGB VGA.

Pins:

| Pin | Name | Description |
|-----|------|-------------|
| 1 | VCC | 3.3V |
| 5 | VSYNC | Frame sync |
| 6 | HREF | Line/pixel valid |
| 7 | PCLK | Pixel clock |
| 8 | XCLK | Master clock input (must be supplied) |
| 9–16 | D7–D0 | 8-bit pixel data |

---

## All Modulino Modules — Quick Reference

| Module | Chip | Supply | Power | Accuracy | Resolution |
|--------|------|--------|-------|----------|------------|
| DISTANCE | VL53L4CDV0DH/1 | 2.6–3.5V | 40mA peak / 24mA ranging | ±7mm to ±3% | 1mm |
| THERMO | HS3003 | 2.3–5.5V | 24.4 µA | Temp ±0.25°C / RH ±2.8% | 14-bit |
| MOVEMENT | LSM6DSOXTR | 1.71–3.6V | 170µA (accel) / 0.55mA (gyro) | ±20 mg / ±1 dps | 0.061mg/LSB |
| PIXELS | 8× LC8822-2020 | 2.0–3.6V | 33mA×8 + 3.4mA MCU | — | 8-bit/channel |
| BUZZER | PKLCS1212E4001 | 2.0–3.6V | 6.4 mA | ADC ±2 LSB INL | 12-bit ADC |
| KNOB | Quadrature encoder | 2.0–3.6V | 3.4 mA | Oscillator ±1% | 12-bit ADC |
| BUTTONS | 3× SPST | 2.0–3.6V | 2.5mA×3 + 3.4mA | ADC ±2 LSB INL | 12-bit ADC |

---

## Critical Limitations

| Constraint | What it means | Workaround |
|------------|--------------|------------|
| LSM9DS1 accel offset | Raw readings always slightly wrong at rest | Wait for `accelerationAvailable()` before streaming; calibrate baseline |
| Gyro drift | Roll/Pitch/Yaw wander over time | Use `Reset Tracking` in dashboard to recalibrate |
| MOVEMENT accel offset ±20 mg | Modulino IMU also biased | Run `calibrateSensor()` in `setup()` |
| THERMO slow response | Can't detect sudden spikes | Use for ambient monitoring only |
| DISTANCE line-of-sight only | Can't read through objects | Mount with clear line of sight to target |
| DISTANCE affected by dark surfaces | Dark targets read farther than reality | Calibrate with actual target surface |
| Qwiic 3.3V only | 5V sensors will damage modules | Only use Modulino modules on Qwiic |
| Qwiic max 1.2m cable | Limited reach | Daisy-chain extends total reach |
| PIXELS up to 267 mA (all LEDs full) | Stresses USB power | Keep brightness ≤ 80 normally |
| PIXELS needs `show()` | LEDs won't update without it | Always call `leds.show()` after `leds.set()` |
| Nano 33 BLE A7 not 5V tolerant | 5V signal will damage the board | Power OJFF14 from 3.3V or use level shifter |
