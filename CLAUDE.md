# Arduino Nano Runner Cheststrap — Project Context

## Web Dashboard

The companion phone dashboard lives in **`formwings/`** (React 19 + Vite + Tailwind v4).  
Live at **https://formwings.vercel.app** — deploy with `vercel --prod` from inside `formwings/`.  
See `formwings/AGENT.md` for full agent context, BLE contract, and file map.  
See `formwings/CHANGELOG.md` for version history.  
See `formwings/METRICS.md` for metric definitions, calculations, and thresholds.

---

## Overview

A wearable sacrum-mounted sensor system for runner form analysis.  
The **Arduino Nano 33 BLE Sense Rev1** streams 9-axis IMU data at 200 Hz over USB Serial to an **Arduino UNO Q**, which runs a Lightweight Time-Series Transformer model and transmits biomechanical predictions over BLE to the FormWings mobile dashboard.

See `HARDWARE.md` for all sensor specs, wiring, sampling rates, limitations, and I²C addresses.  
See `hardware-guide.md` for a beginner-friendly walkthrough of the hardware.

---

## System Architecture

```
[Arduino Nano 33 BLE Sense Rev1]  — worn at waistband / sacrum
  LSM9DS1 9-axis IMU (accel, gyro, mag) at 200 Hz
  → USB Serial — JSON frames at 20 Hz
        ↓
[Arduino UNO Q]                   — belt / pocket
  Digital filtering: Madgwick filter + Butterworth band-pass
  Feature extraction: 7 biomechanical metrics
  Lightweight Time-Series Transformer model
  Rule-based alert engine (priority_trigger)
  Modulino THERMO: temperature + humidity
  → BLE GATT notify — running_form_prediction JSON ~1 Hz
        ↓
[FormWings mobile web app]        — runner's phone (Chrome/Android)
  Web Bluetooth API
  3-page dashboard: PostureArc | Telemetry | Form Score
  Session summary with rolling average charts + PDF export
  → (planned) Supabase session upload
```

---

## BLE Output Format

The UNO Q sends `running_form_prediction` JSON each prediction window:

```json
{
  "type": "running_form_prediction",
  "window_id": 12,
  "timestamp_s": 128.42,
  "features": {
    "cadence_spm": 166.67,
    "vertical_oscillation_cm": 7.42,
    "gct_flight_balance_ms": 82.5,
    "impact_loading_rate_bw_s": 24.71,
    "trunk_forward_lean_deg": 12.3,
    "left_right_asymmetry_pct": 14.2,
    "heel_strike_likelihood": 0.72
  },
  "diagnostics": { "gct_ms": 308.0, "flight_time_ms": 225.5, ... },
  "class": "Bad Form",
  "probabilities": { "Good": 0.07, "Bad Form": 0.93 },
  "attention_weights": { ... },
  "feature_contributions": { ... },
  "dominant_feature": "heel_strike_likelihood",
  "priority_trigger": { "severity": "WARN", "code": "impact_estimate_high" },
  "environment": { "temperature_c": 27.4, "humidity_pct": 39.3, "heat_index_c": 27.2, "risk_state": "Normal" },
  "recommendation": { "severity": "OK", "device_message": "Thermal conditions look normal." }
}
```

See `formwings/METRICS.md` for full field definitions, value ranges, and calculation methods.

---

## What We're Measuring

| Signal | Sensor | Insight |
|--------|--------|---------|
| Acceleration (XYZ) | LSM9DS1 accel | Impact, vertical oscillation, trunk lean |
| Rotation rate (XYZ) | LSM9DS1 gyro | Roll, pitch, yaw / cadence |
| Magnetic heading | LSM9DS1 mag | Absolute orientation reference |
| Temperature + Humidity | Modulino THERMO (SHT40) | Heat index, thermal risk |

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

## Main Sketch

```
sensors-test/
├── sensors_test/
│   └── sensors_test.ino   ← primary sketch — streams JSON at 20 Hz
└── dashboard.html          ← legacy Web Serial dashboard (Chrome / Edge)
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
