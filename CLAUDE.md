# Arduino Nano Runner Cheststrap — Project Context

## Overview

A wearable chest-mounted sensor system for runner form analysis.  
The **Arduino Nano 33 BLE Sense Rev1** streams 9-axis IMU data and analog sound at 20 Hz over USB Serial to a Web Serial dashboard.

See `HARDWARE.md` for all sensor specs, wiring, sampling rates, limitations, and I²C addresses.  
See `hardware-guide.md` for a beginner-friendly walkthrough of the hardware.

---

## What We're Measuring

| Signal | Sensor | Insight |
|--------|--------|---------|
| Acceleration (XYZ) | LSM9DS1 (built-in IMU) | Impact, vertical oscillation, trunk lean |
| Rotation rate (XYZ) | LSM9DS1 gyroscope | Roll, pitch, yaw / cadence |
| Magnetic heading | LSM9DS1 magnetometer | Absolute orientation reference |
| Sound | OJFF14 analog sensor → A7 | Ambient noise, step rhythm |
| Visual capture | OV7675 (Tiny ML Shield) | Keyframe image on demand |

---

## System Flow

```
Input → Processing → Dashboard → Feedback
```

| Step | Implementation |
|------|----------------|
| Input | LSM9DS1 (accel + gyro + mag) + OJFF14 sound → Nano 33 BLE Sense |
| Processing | Dead-reckoning: accel → velocity → position; step peaks → cadence |
| Dashboard | Live charts, 3D position, orientation, sound level via Web Serial |
| Feedback | Visual cues in dashboard (lean alert, bounce threshold) |

---

## Available Hardware (Arduino Plug and Make Kit)

These Modulino modules connect to **Arduino UNO Q** via Qwiic (`Wire1`):

| Module | I²C Address | Function |
|--------|-------------|----------|
| DISTANCE | 0x29 | ToF laser range: 0–1200 mm |
| THERMO | 0x44 | Temperature ±0.25°C / Humidity ±2.8% |
| MOVEMENT | 0x6A | 6-axis IMU (LSM6DSOXTR) |
| PIXELS | 0x6C | 8× RGB LEDs |
| BUZZER | 0x3C | Passive buzzer 31–4186 Hz |
| KNOB | 0x76 | Rotary encoder |
| BUTTONS | 0x7C | 3× tactile buttons |

Always use the **Modulino Library Address** in code (not the hardware scan address).

---

## Library Dependencies

```
Arduino_LSM9DS1              — Nano 33 BLE Sense Rev1 IMU (Rev2: Arduino_BMI270_BMM150)
Arduino_Modulino  v0.7.0    — all Modulino modules (UNO Q)
MsgPack           v0.4.2    — required by Modulino
Arduino_RouterBridge         — Monitor.print on UNO Q
WiFi (built-in)              — UNO Q WiFi
```

---

## Main Code

```
sensors-test/
├── sensors_test/
│   └── sensors_test.ino   ← primary sketch — streams JSON at 20 Hz
└── dashboard.html          ← Web Serial dashboard (Chrome / Edge)
```

Sketch targets **Rev1** by default (`SENSOR_BOARD_REV 1`).  
Set to `2` and install `Arduino_BMI270_BMM150` for Rev2.

---

## Board Identification

| Property | Value |
|----------|-------|
| SKU | ABX00031 |
| USB idVendor | 0x2341 (Arduino) |
| USB idProduct | 0x805A |
| USB bcdDevice | 0x0101 (Rev1) |
| Processor | nRF52480 Cortex-M4F @ 64 MHz |
| Flash / RAM | 1 MB / 256 KB |
| I/O voltage | 3.3V only — NOT 5V tolerant |
