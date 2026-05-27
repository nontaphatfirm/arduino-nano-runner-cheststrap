# sensors_test — Runner Form Sensor Test

**Board:** Arduino Nano 33 BLE Sense Rev1 by default  
**Project pivot:** beginner runner form feedback from live IMU input

## Files

| File | Purpose |
|------|---------|
| `sensors_test.ino` | Arduino sketch — reads IMU and streams JSON at 20 Hz over Serial |
| `../dashboard.html` | Web Serial dashboard — shows acceleration, orientation, estimated displacement, path, and running-form cues |

## What Changed

The old version tested every onboard sensor for the pet-care story. The new version focuses on live runner-form sensing:

| Signal | Sensor | Visual |
|--------|--------|--------|
| Acceleration | IMU accelerometer | live XYZ chart and impact estimate |
| Orientation | IMU gyro + accel + optional magnetometer | runner lean/roll/yaw values |
| Estimated displacement | derived from acceleration | Blender-style XYZ position scene |
| Step pulses | acceleration magnitude peaks | cadence estimate |
| Sound intensity | OJFF14 analog sound sensor | level chart, peak-to-peak ADC, average voltage |

## Position Estimate

The dashboard position comes from live IMU dead reckoning: acceleration is rotated into world axes, gravity is removed, small noise is filtered, then acceleration is integrated into velocity and displacement. Use `Reset Tracking` while the sensor is still to recalibrate the estimate.

## Required Libraries

For Rev1:

```text
Arduino_LSM9DS1
```

For Rev2, set `SENSOR_BOARD_REV` to `2` in `sensors_test.ino` and install:

```text
Arduino_BMI270_BMM150
```

## OJFF14 Sound Sensor Wiring

OpenJumper documents OJFF14 as an analog sound sensor using an LM358 and electret microphone. It exposes:

| OJFF14 pin | Nano 33 BLE Sense |
|------------|-------------------|
| `S` | `A7` |
| `+` | `3V3` for direct Nano analog input |
| `-` | `GND` |

The OpenJumper doc lists the module working voltage as `5V`, but the Nano 33 BLE Sense analog inputs are not 5V tolerant. If powering OJFF14 from 5V, protect `A0` with a voltage divider or level shifter.

## Serial Output

Newline-delimited JSON at 115200 baud:

```json
{"type":"data","t":12345,"ax":0.12,"ay":0.03,"az":9.81,"gx":0.01,"gy":0.02,"gz":0.00,"mx":12.0,"my":4.0,"mz":39.0,"magReady":true,"soundRaw":2048,"soundPeak":120,"soundVolts":1.65,"soundLevel":0.13}
```

Units:

| field | unit |
|-------|------|
| `ax, ay, az` | m/s² |
| `gx, gy, gz` | rad/s |
| `mx, my, mz` | microtesla |
| `soundRaw` | 12-bit ADC average |
| `soundPeak` | 12-bit ADC peak-to-peak |
| `soundVolts` | average volts at A0 |
| `soundLevel` | normalized 0-1 sound activity |

The dashboard also has a software `Sensitivity` slider for OJFF14. This scales the visualized level only; it does not change the hardware gain. Use the module's 10K potentiometer for hardware sensitivity, and use the dashboard slider for display tuning.

## Test Flow

1. Upload `sensors_test.ino` to the Nano 33 BLE Sense.
2. Open `dashboard.html` in Chrome or Edge.
3. Click `Connect Serial` and select the Arduino port.
4. Hold the sensor still and click `Reset Tracking`.
5. Move it like a runner torso/waist sensor: small forward lean, bounce, and side sway.

## Breadcrumbs From the Fix

- The reference repo avoids streaming fake zero values before the IMU is ready. This sketch does the same.
- The reference repo converts accelerometer and gyroscope values to physical units before downstream processing. This sketch streams m/s² and rad/s.
- The old dashboard only visualized sensor values and a board orientation. The new dashboard derives runner-specific cues and position/path visuals from the IMU stream.
- The OJFF14 documentation was downloaded from OpenJumper's current docs into `hardware/OJFF14/OJFF14-sound-sensor.md`.
