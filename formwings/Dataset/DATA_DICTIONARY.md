# FormWings Dataset — Data Dictionary

## Overview

Raw IMU log files captured by the FormWings web dashboard (BLE Live mode) during labelled running sessions. Each file contains continuous 6-axis inertial data from an **Arduino Nano 33 BLE Sense Rev1** (LSM9DS1 sensor) worn at the **waistband/sacrum**.

---

## Dataset Summary

| Class | Scenario | File | Lines | IMU Records | Duration |
|-------|----------|------|-------|-------------|----------|
| Good Form | Normal running | `Goodform/goodform-formwings-ble-log-2026-05-28T09-29-08-921Z.txt` | 875 | 4 374 | 89.6 s |
| Bad Form | High stepping | `Badform/badform-highstep-formwings-ble-log-2026-05-28T09-33-31-633Z.txt` | 354 | 1 767 | 36.2 s |
| Bad Form | Lean forward | `Badform/badform-leanforward-formwings-ble-log-2026-05-28T09-37-19-942Z.txt` | 315 | 1 575 | 32.2 s |
| Bad Form | Left-right asymmetry | `Badform/badform-leftright-formwings-ble-log-2026-05-28T09-35-25-251Z.txt` | 324 | 1 620 | 33.2 s |
| Bad Form | Quick/shuffle steps | `Badform/badform-quicksteps-formwings-ble-log-2026-05-28T09-31-14-296Z.txt` | 376 | 1 877 | 38.4 s |
| **Total** | | | **2 244** | **11 213** | **~5.5 min** |

IMU sampling rate: **~20 Hz** (5 samples per BLE notification, notifications at ~100 ms intervals).

---

## File Naming Convention

```
{class}-{scenario}-formwings-ble-log-{capture_utc}.txt
```

| Segment | Example | Description |
|---------|---------|-------------|
| `class` | `goodform` / `badform` | Label applied at recording time |
| `scenario` | `highstep`, `leanforward`, `leftright`, `quicksteps` | Bad-form type (omitted for good form) |
| `capture_utc` | `2026-05-28T09-29-08-921Z` | ISO 8601 UTC timestamp when recording was saved (colons replaced with dashes) |

---

## File Structure

Each file is a plain-text log. One **line** per BLE characteristic notification:

```
{wall_clock_utc} {record_1};{record_2};{record_3};{record_4};{record_5}
```

| Part | Example | Description |
|------|---------|-------------|
| `wall_clock_utc` | `2026-05-28T09:27:33.152Z` | ISO 8601 UTC timestamp when the web app received the BLE notification |
| Records | `176868,-0.027,-1.307,...` | 5 semicolon-separated IMU records per notification |

The 5 records represent 5 consecutive 20 Hz samples buffered on the Arduino and sent together in one BLE packet (total payload ~120 bytes).

---

## Record Format

Each record is **7 comma-separated fields** with no spaces:

```
seq,acc_x_g,acc_y_g,acc_z_g,gyro_x_dps,gyro_y_dps,gyro_z_dps
```

> **Note on `seq` / `timestamp_s`:** The `seq` field is the Arduino `millis()` counter — milliseconds since the board was powered on. It serves as both the sequence number (monotonically increasing integer) and the sample timestamp. Convert to seconds: `timestamp_s = seq / 1000.0`.

---

## Field Descriptions

| # | Field | Type | Unit | Description |
|---|-------|------|------|-------------|
| 1 | `seq` | uint32 | ms | Arduino `millis()` timestamp. Monotonically increasing. Also usable as sequence number. Convert to `timestamp_s` by dividing by 1000. |
| 2 | `acc_x_g` | float32 | g | Accelerometer X-axis (mediolateral — left/right). Positive = left. |
| 3 | `acc_y_g` | float32 | g | Accelerometer Y-axis (anterior-posterior + gravity component). Includes ~−1 g gravity offset when sensor is chest/waist-mounted. |
| 4 | `acc_z_g` | float32 | g | Accelerometer Z-axis (superior — vertical). |
| 5 | `gyro_x_dps` | float32 | °/s | Gyroscope X-axis (pitch rate — forward/backward tilt). |
| 6 | `gyro_y_dps` | float32 | °/s | Gyroscope Y-axis (roll rate — left/right tilt). |
| 7 | `gyro_z_dps` | float32 | °/s | Gyroscope Z-axis (yaw rate — rotation around vertical axis). |

---

## Observed Value Ranges

Computed across all 11 213 records in this dataset:

| Field | Min | Max | Notes |
|-------|-----|-----|-------|
| `seq` | 176 868 ms | 751 490 ms | ~176 s – 751 s since board power-on |
| `acc_x_g` | −0.790 g | +0.594 g | Small mediolateral sway |
| `acc_y_g` | −2.060 g | −0.047 g | Always negative — dominated by gravity at waist mounting angle |
| `acc_z_g` | −0.687 g | +1.207 g | Vertical oscillation + gravity projection |
| `gyro_x_dps` | −102.4 °/s | +88.9 °/s | Pitch rate (highest during foot-strike) |
| `gyro_y_dps` | −101.2 °/s | +63.7 °/s | Roll rate |
| `gyro_z_dps` | −53.6 °/s | +52.4 °/s | Yaw rate (pelvic rotation) |

> **Axis note:** These are raw sensor-frame values before the Madgwick/axis-alignment pipeline. The gravity vector appears primarily in `acc_y` because of how the sensor sits on the waistband. After the shared front-end pipeline (`a_gravity` separation + axis alignment), the vertical axis becomes Z = up.

---

## Bad Form Scenario Descriptions

| Scenario key | Description | Primary biomechanical signature |
|---|---|---|
| `highstep` | Runner exaggerates knee lift / high stepping | High vertical oscillation, longer flight time, increased impact at landing |
| `leanforward` | Runner bends excessively at the waist | Large `gyro_x` excursions (pitch), elevated trunk forward lean |
| `leftright` | Runner rocks side-to-side | Elevated `acc_x` amplitude, large `gyro_z` (yaw), high L/R asymmetry |
| `quicksteps` | Shuffle running / very short rapid steps | High cadence with very low vertical oscillation, short GCT, low amplitude peaks |

---

## Example Record (parsed)

Raw line:
```
2026-05-28T09:27:33.152Z 176868,-0.027,-1.307,0.795,3.329,25.861,-9.205;...
```

Parsed first record:

| Field | Raw value | Interpreted |
|-------|-----------|-------------|
| `seq` | 176868 | 176.868 s since power-on |
| `timestamp_s` | 176.868 | (seq / 1000) |
| `acc_x_g` | −0.027 | Slight rightward lean |
| `acc_y_g` | −1.307 | Gravity projection (forward-tilt component) |
| `acc_z_g` | 0.795 | Vertical acceleration component |
| `gyro_x_dps` | 3.329 | Near-zero pitch rate (stable trunk) |
| `gyro_y_dps` | 25.861 | Roll rate (lateral rock) |
| `gyro_z_dps` | −9.205 | Yaw rate (slight pelvic rotation left) |

---

## Sensor Specification

| Property | Value |
|----------|-------|
| Sensor | LSM9DS1 (9-axis) on Arduino Nano 33 BLE Sense Rev1 |
| Accelerometer range | ±4 g |
| Gyroscope range | ±2000 °/s |
| Sampling rate | 200 Hz on-board; BLE output ~20 Hz (5 samples/notification) |
| Mounting location | Waistband / sacrum (lower back) |
| Connection | BLE GATT notify → Web Bluetooth → FormWings dashboard |
