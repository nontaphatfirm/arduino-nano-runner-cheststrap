# FormWings — Agent Context (Repo Root)

> Read this before working on any part of this repository.

## What This Project Is

**FormWings** is a wearable running form analysis system built for a Thai hackathon (Super AI Engineer Season 6). A chest-strap Arduino Nano 33 BLE Sense streams IMU data to an Arduino UNO Q, which runs a lightweight Time-Series Transformer model and sends biomechanical predictions over BLE to a React mobile web app.

**Live dashboard:** https://formwings.vercel.app  
**Demo deadline:** 2026-05-29

---

## Repository Layout

```
arduino/                         ← repo root
├── CLAUDE.md                    ← project context for Claude Code
├── AGENTS.md                    ← this file
├── HARDWARE.md                  ← sensor specs, wiring, I²C addresses
├── hardware-guide.md            ← beginner-friendly hardware walkthrough
├── sensors-test/                ← Arduino sketches (Nano 33 BLE Sense)
│   ├── sensors_test/
│   │   └── sensors_test.ino    ← primary sketch, streams JSON at 20 Hz
│   └── dashboard.html          ← legacy Web Serial dashboard
├── formwings/                   ← React mobile dashboard (PRIMARY)
│   ├── AGENT.md                 ← detailed agent context for formwings
│   ├── CHANGELOG.md             ← version history
│   ├── METRICS.md               ← metric definitions, ranges, calculations
│   ├── SPEC.md                  ← product specification
│   ├── Dataset/                 ← labelled IMU training data
│   │   ├── Goodform/
│   │   ├── Badform/
│   │   └── DATA_DICTIONARY.md
│   └── src/                    ← React source
└── FormSense/                   ← older prototype (archived)
```

**Always work in `formwings/` for dashboard changes.** `FormSense/` and `FormSense-v2/` are archived.

---

## System Architecture

```
[Arduino Nano 33 BLE Sense Rev1]   — waistband / sacrum
  LSM9DS1 9-axis IMU at 200 Hz
  → USB Serial (JSON frames at 20 Hz)
        ↓
[Arduino UNO Q]                    — belt / pocket
  Digital filtering (Madgwick, Butterworth)
  Feature extraction (7 biomechanical metrics)
  Lightweight Time-Series Transformer
  Rule-based alert engine
  Modulino THERMO (temperature / humidity)
  → BLE GATT notify (~1 Hz prediction windows)
        ↓
[formwings mobile web app]         — runner's phone
  Web Bluetooth → 3-page dashboard
  → (planned) Supabase upload
```

---

## BLE Data Contract

**Incoming packet type:** `running_form_prediction`

Key fields consumed by the dashboard (see `formwings/src/lib/bleContract.js`):

| Field path | Dashboard key | Notes |
|---|---|---|
| `features.cadence_spm` | `c` | spm |
| `features.vertical_oscillation_cm` | `vo` | cm |
| `diagnostics.gct_ms` | `gct` | ms — raw ground contact time |
| `features.impact_loading_rate_bw_s` | `vgrf` | BW/s — loading rate (primary) |
| `diagnostics.peak_vgrf_bw_estimate` | `vgrf2` | ×BW — peak force (secondary) |
| `features.trunk_forward_lean_deg` | `lean` | degrees |
| `features.left_right_asymmetry_pct` | `asym` | % |
| `features.heel_strike_likelihood` | `heelLikelihood` | 0–1 |
| `class` | `form` | 0=Good, 1=Bad |
| `dominant_feature` | `dominantFeature` | key string |
| `feature_contributions` | `featureContributions` | SHAP-like logit values |
| `diagnostics.fallback_window` + `detected_step_events` | `fallback` | bool — data quality |
| `environment.*` | `envData` | always stored |
| `recommendation.severity` | `envAlert` | banner only when CRIT or sensor error |

Legacy raw IMU format (`acc_x_g`, `gyro_x_dps`, …) is also handled via `parseRaw()` + `ImuProcessor` (client-side processing fallback).

---

## Hardware Quick Reference

### Arduino Nano 33 BLE Sense Rev1

| Property | Value |
|----------|-------|
| SKU | ABX00031 |
| Sensor | LSM9DS1 (accel ±4g, gyro ±2000 dps, mag) |
| Processor | nRF52480 Cortex-M4F @ 64 MHz |
| Flash / RAM | 1 MB / 256 KB |
| I/O voltage | **3.3V only — NOT 5V tolerant** |
| USB ids | idVendor 0x2341 / idProduct 0x805A |

### Arduino UNO Q — Modulino modules (Qwiic / Wire1)

| Module | I²C Address | Function |
|--------|-------------|----------|
| DISTANCE | 0x29 | ToF laser range 0–1200 mm |
| THERMO | 0x44 | Temp ±0.25°C / Humidity ±2.8% |
| MOVEMENT | 0x6A | 6-axis IMU (LSM6DSOXTR) |
| PIXELS | 0x6C | 8× RGB LEDs |
| BUZZER | 0x3C | Passive buzzer 31–4186 Hz |
| KNOB | 0x76 | Rotary encoder |
| BUTTONS | 0x7C | 3× tactile buttons |

Always use **Modulino Library Address** in code (not the hardware scan address).

### Arduino Library Dependencies

```
Arduino_LSM9DS1              — Nano 33 BLE Sense Rev1 IMU
Arduino_Modulino  v0.7.0    — all Modulino modules (UNO Q)
MsgPack           v0.4.2    — required by Modulino
Arduino_RouterBridge         — Monitor.print on UNO Q
WiFi (built-in)              — UNO Q WiFi
```

---

## formwings Dashboard Quick Reference

**Deploy:** `cd formwings && vercel --prod`  
**Dev:** `npm run dev` → http://localhost:5173  
**Dev HTTPS (required for Android BLE):** `npm run dev:https`  

Key files:

| File | Role |
|------|------|
| `src/lib/bleContract.js` | BLE UUIDs + `parsePrediction()` + `parseRaw()` + `hintFromCode()` |
| `src/lib/simulator.js` | Demo data generator (fatigue model, calibrated to real payload) |
| `src/lib/classify.js` | Threshold fallback classifier + `badReason()` |
| `src/hooks/useBle.js` | Web Bluetooth, reconnect, stale timer, dual-format parsing |
| `src/hooks/useSession.js` | Elapsed, distance, history (last 60), fullHistory (all packets) |
| `src/screens/Dashboard.jsx` | 3-page swipeable layout + form score + env alert |
| `src/screens/Summary.jsx` | Session summary + rolling average charts + PDF export |
| `src/components/PostureArc.jsx` | Animated SVG running figure, pauses when BLE inactive |
| `src/components/MetricStrip.jsx` | Full-screen 7-metric telemetry page |
| `METRICS.md` | Metric definitions, sensor, calculation, ranges, caveats |
| `Dataset/DATA_DICTIONARY.md` | Raw IMU dataset field descriptions and value ranges |
