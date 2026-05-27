# WellSense Smart Pet Care

**WellSense AIoT & System Product Hackathon** — Super AI Engineer Season 6, On-Site Week 3  
**Deadline:** Fri 29 May 2026

Monitor Mango (a cat) at home while Nat (post car-accident patient) recovers in rehab.  
Three subteams — Smart Pet Care, Smart Pillbox, Smart Gait Aid — share one dashboard.

---

## Smart Pet Care — What We Monitor

| Signal | Sensor | Insight |
|---|---|---|
| Food bowl level | Modulino DISTANCE | Is Mango hungry? |
| Room temperature | Modulino THERMO | Is the room safe for a cat? |
| Cat activity | Modulino MOVEMENT | Is Mango active or unusually still? |
| Visual check | Phone camera (WiFi) | Snapshot on demand |
| Sound | OJFF14 analog sound sensor | Ambient noise / meow detection |
| Runner/motion form | Arduino Nano 33 BLE Sense Rev1 IMU | Position tracking, orientation |

**Outputs:** Modulino PIXELS (status beacon) + Modulino BUZZER (heat alert) + WiFi dashboard

---

## System States

```
Input → Processing → State → Dashboard → Feedback
```

| State | Trigger | PIXELS | BUZZER |
|---|---|---|---|
| ALL_OK | All values normal | Green | Silent |
| HUNGRY | Food bowl low | Yellow | Brief tone |
| TOO_HOT | Temp above threshold | Red | Alarm |
| INACTIVE_WARNING | No movement for too long | Blue | Reminder |

---

## Hardware

### Main Controller
**Arduino UNO Q** (ABX00162 / ABX00173) — Qualcomm QRB2210 MPU (4× Cortex-A53 @ 2 GHz, Debian Linux) + STM32U585 MCU (Cortex-M33 @ 160 MHz)

### Sensor Shield (Arduino Plug and Make Kit)
All Modulino modules connect via Qwiic / I²C chain. Use **Wire1** on UNO Q.

| Module | Chip | I²C Address | Range / Output |
|---|---|---|---|
| DISTANCE | VL53L4CDV0DH/1 (ToF laser) | 0x29 | 0–1200 mm, ±7 mm accuracy |
| THERMO | HS3003 | 0x44 | −40–125°C ±0.25°C / 0–100% RH ±2.8% |
| MOVEMENT | LSM6DSOXTR (6-axis IMU) | 0x6A | ±2–16 g accel / ±125–2000 dps gyro |
| PIXELS | 8× LC8822-2020 RGB LEDs | 0x6C | 8-bit per channel, individually addressable |
| BUZZER | PKLCS1212E4001 passive | 0x3C | 31 Hz – 4186 Hz |
| KNOB | Quadrature encoder | 0x76 | Rotary + press |
| BUTTONS | 3× SPST + LEDs | 0x7C | Tactile input |

### ML / Sensor Board
**Arduino Nano 33 BLE Sense Rev1** (ABX00031) — Nordic nRF52480 Cortex-M4F @ 64 MHz, 1 MB Flash / 256 KB RAM, BT 5

Built-in sensors: LSM9DS1 9-axis IMU · LPS22HB barometer · HTS221 humidity · APDS-9960 gesture/light · MP34DT05 microphone · ATECC608A crypto

### Camera
**OV7675** (1/9" CMOS, 640×480 VGA) on Arduino Tiny Machine Learning Shield  
Practical modes: 160×120 greyscale @ 15 fps (48× less data than RGB VGA)

### Sound Sensor
**OJFF14 Analog Sound Sensor** — wired to Nano 33 BLE A7 pin (use 3.3V supply — Nano analog inputs are NOT 5V tolerant)

---

## sensors-test — Main Sketch

> **This is the primary codebase for the project.**

```
sensors-test/
├── sensors_test/
│   └── sensors_test.ino   ← Arduino sketch (streams JSON at 20 Hz over Serial)
└── dashboard.html          ← Web Serial dashboard (Chrome / Edge)
```

### What It Does

Streams newline-delimited JSON at 115200 baud, 20 Hz:

```json
{"type":"data","t":12345,"ax":0.12,"ay":0.03,"az":9.81,"gx":0.01,"gy":0.02,"gz":0.00,"mx":12.0,"my":4.0,"mz":39.0,"magReady":true,"soundRaw":2048,"soundPeak":120,"soundVolts":1.65,"soundLevel":0.13}
```

| Field | Unit |
|---|---|
| ax, ay, az | m/s² |
| gx, gy, gz | rad/s |
| mx, my, mz | µT |
| soundRaw | 12-bit ADC average |
| soundPeak | 12-bit ADC peak-to-peak |
| soundVolts | average volts at A7 |
| soundLevel | normalized 0–1 |

Dashboard features: live acceleration charts, orientation (lean/roll/yaw), dead-reckoned XYZ position, step cadence estimate, sound level visualization.

### Required Libraries

| Board | Library |
|---|---|
| Nano 33 BLE Sense **Rev1** (default) | `Arduino_LSM9DS1` |
| Rev2 | `Arduino_BMI270_BMM150` (set `SENSOR_BOARD_REV 2` in sketch) |

For Modulino modules on UNO Q:

```
Arduino_Modulino  v0.7.0
MsgPack           v0.4.2
Arduino_RouterBridge
```

### Quick Start

1. Install `Arduino_LSM9DS1` via Arduino Library Manager.
2. Open `sensors-test/sensors_test/sensors_test.ino` in Arduino IDE.
3. Select board: **Arduino Nano 33 BLE**.
4. Upload.
5. Open `sensors-test/dashboard.html` in **Chrome** or **Edge**.
6. Click **Connect Serial** → select the Arduino port.
7. Hold sensor still → click **Reset Tracking**.

### OJFF14 Wiring

| OJFF14 pin | Nano 33 BLE Sense pin |
|---|---|
| S | A7 |
| + | 3V3 |
| − | GND |

> Power OJFF14 from 3.3V when connected to Nano 33 BLE. If powering at 5V, add a voltage divider or level shifter on the signal line.

---

## Project Files

| Path | Description |
|---|---|
| `sensors-test/` | **Main sketch + Web Serial dashboard** |
| `hardware/` | Datasheets (UNO Q, Modulino, Nano 33 BLE, OV7675, OJFF14) |
| `HARDWARE.md` | Full sensor specs, wiring, sampling rates, architecture diagrams |
| `pet-care-hardware-guide.md` | Beginner-friendly hardware walkthrough |
| `CLAUDE.md` | Project context and judging rubric |

---

## Judging Rubric

| Criterion | Points |
|---|---|
| Problem & User Value | 15 |
| System Architecture & HW Use | 20 |
| Multi-Sensor Insight & AI Logic | 20 |
| Dashboard & Feedback Interaction | 15 |
| Prototype Quality & Low-Power | 15 |
| Business Canvas, Demo & Storytelling | 15 |

---

## Team

Smart Pet Care subteam — WellSense AIoT Hackathon (Super AI Engineer Season 6)
