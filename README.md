# Arduino Nano Runner Cheststrap

A wearable sensor system for runner form analysis built on the **Arduino Nano 33 BLE Sense Rev1**.  
Mounts on the chest or torso and streams 9-axis IMU data at 20 Hz to a Web Serial dashboard for real-time feedback.

---

## What It Measures

| Signal | Sensor | Insight |
|---|---|---|
| Acceleration (XYZ) | LSM9DS1 accelerometer (built-in) | Impact force, vertical oscillation, lean |
| Rotation rate (XYZ) | LSM9DS1 gyroscope (built-in) | Trunk lean, roll, yaw drift |
| Magnetic heading | LSM9DS1 magnetometer (built-in) | Absolute orientation reference |
| Ambient sound | OJFF14 analog sound sensor | Sound level / step rhythm |
| Visual capture | OV7675 camera | Keyframe image on demand |

---

## Hardware

### Main Board
**Arduino Nano 33 BLE Sense Rev1** (ABX00031) — Nordic nRF52480, ARM Cortex-M4F @ 64 MHz, 1 MB Flash / 256 KB RAM

Built-in sensors used:

| Chip | Function | I²C Address |
|---|---|---|
| LSM9DS1 | 9-axis IMU (accel + gyro + mag) | — (via library) |
| MP34DT05 | MEMS microphone | — (PDM) |
| APDS-9960 | Gesture / ambient light | 0x39 |
| ATECC608A | Crypto co-processor | — |

### External Sensors

| Component | Connection | Notes |
|---|---|---|
| OJFF14 Sound Sensor | S → A7, + → 3V3, − → GND | 3.3V supply; Nano analog pins are NOT 5V tolerant |
| OV7675 Camera | Arduino Tiny Machine Learning Shield | 8-bit DVP, SCCB config |

### Available Modulino Modules (Arduino Plug and Make Kit)
Connects to **Arduino UNO Q** via Qwiic chain (`Wire1`). Use Modulino library address in code — not the hardware scan address.

| Module | Chip | I²C Address | Specs |
|---|---|---|---|
| DISTANCE | VL53L4CDV0DH/1 (ToF laser) | 0x29 | 0–1200 mm, ±7 mm accuracy |
| THERMO | HS3003 | 0x44 | −40–125°C ±0.25°C / 0–100% RH ±2.8% |
| MOVEMENT | LSM6DSOXTR (6-axis IMU) | 0x6A | ±2–16 g / ±125–2000 dps |
| PIXELS | 8× LC8822-2020 RGB LEDs | 0x6C | 8-bit per channel, individually addressable |
| BUZZER | PKLCS1212E4001 passive buzzer | 0x3C | 31 Hz – 4186 Hz |
| KNOB | Quadrature rotary encoder | 0x76 | Rotary + press |
| BUTTONS | 3× SPST + LEDs | 0x7C | Tactile navigation |

---

## sensors-test — Main Sketch

> **This is the primary code for the project.**

```
sensors-test/
├── sensors_test/
│   └── sensors_test.ino   ← Arduino sketch (IMU + sound, 20 Hz JSON over Serial)
└── dashboard.html          ← Web Serial dashboard (Chrome / Edge)
```

### Serial Output

Streams newline-delimited JSON at 115200 baud, 20 Hz:

```json
{"type":"data","t":12345,"ax":0.12,"ay":0.03,"az":9.81,"gx":0.01,"gy":0.02,"gz":0.00,"mx":12.0,"my":4.0,"mz":39.0,"magReady":true,"soundRaw":2048,"soundPeak":120,"soundVolts":1.65,"soundLevel":0.13}
```

| Field | Unit | Description |
|---|---|---|
| ax, ay, az | m/s² | Acceleration |
| gx, gy, gz | rad/s | Angular velocity |
| mx, my, mz | µT | Magnetic field |
| soundRaw | 12-bit ADC avg | Mean ADC reading across 32 samples |
| soundPeak | 12-bit ADC pp | Peak-to-peak amplitude |
| soundVolts | V | Average voltage at A7 |
| soundLevel | 0–1 | Normalized sound activity |

### Dashboard Features
- Live XYZ acceleration charts
- Orientation: lean, roll, yaw
- Dead-reckoned 3D position estimate (integrate accel → velocity → displacement)
- Step cadence estimate from acceleration magnitude peaks
- Sound level visualization with sensitivity slider

### Required Libraries

Install via Arduino Library Manager:

| Board | Library |
|---|---|
| Nano 33 BLE Sense **Rev1** (default) | `Arduino_LSM9DS1` |
| Rev2 | `Arduino_BMI270_BMM150` — set `SENSOR_BOARD_REV 2` in sketch |

### Quick Start

1. Install `Arduino_LSM9DS1` from Arduino Library Manager.
2. Open `sensors-test/sensors_test/sensors_test.ino`.
3. Select board: **Arduino Nano 33 BLE**.
4. Upload.
5. Open `sensors-test/dashboard.html` in **Chrome** or **Edge**.
6. Click **Connect Serial** → select the Arduino port.
7. Hold the board still → click **Reset Tracking**.
8. Move like a runner torso: lean, bounce, side sway.

### OJFF14 Wiring

| OJFF14 pin | Nano 33 BLE Sense |
|---|---|
| S | A7 |
| + | 3V3 |
| − | GND |

> If powering OJFF14 from 5V, use a voltage divider or level shifter on the signal line — Nano 33 BLE analog inputs are not 5V tolerant.

---

## Repository Layout

| Path | Description |
|---|---|
| `sensors-test/` | **Main sketch + Web Serial dashboard** |
| `hardware/` | Datasheets (UNO Q, Modulino kit, Nano 33 BLE, OV7675, OJFF14) |
| `HARDWARE.md` | Full sensor specs, wiring, I²C addresses |
| `hardware-specs.md` | Concise hardware specification tables |
| `hardware-guide.md` | Beginner-friendly hardware walkthrough |
| `CLAUDE.md` | Project context |

---

## Board Identification

This project targets **Rev1** specifically (original Nano 33 BLE Sense).

USB descriptor confirms Rev1:
```
idVendor  : 0x2341  (Arduino)
idProduct : 0x805A
bcdDevice : 0x0101  (v1.01)
```

Rev2 uses different IMU chips (BMI270 + BMM150) — set `SENSOR_BOARD_REV 2` in the sketch if using Rev2.
