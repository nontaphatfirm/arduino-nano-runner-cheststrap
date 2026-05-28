# FormWings — Metrics Reference

## Hardware

| Component | Location | Sensor | Rate |
|-----------|----------|--------|------|
| Arduino Nano 33 BLE Sense Rev1 | Waistband / sacrum | LSM9DS1 (accel ±4g, gyro ±2000 dps, mag) | 200 Hz |
| Arduino UNO Q | Belt / pocket | Runs ML pipeline; receives serial from Nano | — |
| Modulino THERMO | same belt unit | SHT40 (temp ±0.2°C, humidity ±1.8%) | on-demand |

All biomechanical metrics are derived from the **LSM9DS1** on the Nano 33 BLE Sense, worn at the **sacrum/lower back**. The UNO Q receives raw IMU frames over USB Serial, runs the signal pipeline, and transmits prediction windows over BLE.

---

## Shared Signal Pipeline (runs before every metric)

| Step | What happens |
|------|-------------|
| **0. Sample** | 200 Hz, ±4g accel, ±2000 dps gyro |
| **1. Axis align** | 2-second standing calibration rotates raw frame so Z = up, X = forward, Y = left |
| **2. Bias correct** | Subtract gyro zero-rate bias from calibration window |
| **3. Gravity separate** | Madgwick filter (β = 0.05) → `a_gravity` (orientation) + `a_linear` (motion) |
| **4. Filter banks** | Locomotor band 0.5–5 Hz (stride), Impact band 5–50 Hz (footstrike), Wideband (DC-removed) |

---

## System Architecture

```
Arduino Nano 33 BLE Sense (LSM9DS1 9-axis IMU)
  └─ Raw 6-axis frames at 200 Hz over USB Serial
        ↓
Arduino UNO Q
  ├─ Digital filtering (Madgwick, Butterworth band-pass)
  ├─ Feature extraction (7 biomechanical metrics below)
  ├─ Lightweight Time-Series Transformer model
  ├─ Rule-based engine (priority_trigger alerts)
  └─ BLE GATT notification → Mobile App
        +
Modulino THERMO (SHT40) → temperature / humidity
```

Arduino Nano also computes preliminary signals on-device: load anomaly score, lean, cadence, vertical oscillation, symmetry — these feed the UNO Q feature pipeline.

---

## Quick Reference Table

| Field | User label | Unit | Good range | Concern | Bad threshold | Sensor |
|-------|-----------|------|-----------|---------|--------------|--------|
| `cadence_spm` | Cadence | spm | 165–185 | < 160 | < 155 | LSM9DS1 accel Z |
| `vertical_oscillation_cm` | Bounce | cm | 6–10 | > 10 | > 11 | LSM9DS1 accel Z |
| `gct_flight_balance_ms` | GCT–Flight balance | ms | 50–110 | > 120 | > 150 | LSM9DS1 accel Z |
| `impact_loading_rate_bw_s` | Impact loading | BW/s | 15–25 | 25–30 | > 30 | LSM9DS1 accel Z |
| `trunk_forward_lean_deg` | Trunk lean | ° | 5–15 | > 15 or < 2 | > 18 or < 0 | LSM9DS1 accel (gravity) |
| `left_right_asymmetry_pct` | Asymmetry | % | < 8 | 8–12 | > 12 | LSM9DS1 accel XYZ |
| `heel_strike_likelihood` | Foot strike | 0–1 | < 0.5 (midfoot) | 0.5–0.7 | > 0.7 (heel) | LSM9DS1 accel Z |

**Diagnostics** (shown as secondary values or used by model only):

| Field | Unit | Typical range | Notes |
|-------|------|--------------|-------|
| `gct_ms` | ms | 220–330 | Raw ground contact time — shown as primary on GCT row |
| `flight_time_ms` | ms | 160–260 | Air time per step |
| `peak_vgrf_bw_estimate` | × BW | 1.8–2.6 | Peak ground reaction force — shown as secondary on Impact row |
| `footstrike_time_to_peak_ms` | ms | 10–55 | < 20 ms = heel signature; > 40 ms = forefoot |
| `fallback_window` | 0/1 | 0 | 1 = no valid step events, most metrics unreliable |
| `detected_step_events` | count | ≥ 4 | < 4 → reduced reliability; shown as "No Steps" badge |

---

## Per-Metric Detail

---

### 1. Cadence (`cadence_spm`)

**What the user understands:** How many steps per minute. Higher cadence → shorter ground contact → less impact per step.

**Sensor:** LSM9DS1 accelerometer Z-axis (locomotor band, 0.5–5 Hz)

**Calculation:**
```
1. Maintain 10-second sliding window of locomotor-band vertical accel
2. Every 2 seconds: compute autocorrelation of window
3. stride_period_samples = position of first local maximum after lag 0
4. cadence = 2 × (200 Hz / stride_period_samples) × 60
   (factor 2: autocorrelation finds stride period = 2 steps)
```

**Why autocorrelation over FFT:** More robust to amplitude variation between strides; finer period resolution than FFT bin width.

| | Value |
|-|-------|
| Good | 160–185 spm |
| Concern | < 160 spm |
| Bad threshold | < 155 spm |
| Typical in sample | 166.67 spm |

**Caveat:** Autocorrelation needs ~10 s of steady running to converge. First few windows may output 0 or erratic values.

---

### 2. Vertical Oscillation (`vertical_oscillation_cm`)

**What the user understands:** How much the body bobs up and down per stride. High bounce = wasted energy, higher injury risk.

**Sensor:** LSM9DS1 accelerometer Z-axis (locomotor band)

**Calculation:**
```
1. Identify stride events from locomotor-band peaks (toe-off to toe-off)
2. Per stride, double-integrate a_linear.z:
   - Integration 1: vertical velocity (zero-mean reset each stride)
   - Integration 2: vertical position (zero-drift reset at stride boundaries)
3. vo = max(position) − min(position) within stride
4. Average over last 10 strides → cm
```

| | Value |
|-|-------|
| Good | 6–10 cm |
| Concern | > 10 cm |
| Bad threshold | > 11 cm |
| Typical in sample | 7.42 cm |

**Caveat:** Double integration is drift-prone. The per-stride zero-mean velocity reset is the only thing preventing unbounded drift. Meaningless during fallback windows with no steps.

---

### 3. GCT–Flight Balance (`gct_flight_balance_ms`)

**What the user understands:** The difference between how long the foot is on the ground vs in the air. Lower = better balance between ground contact and flight.

**Sensor:** LSM9DS1 accelerometer Z-axis (both impact and locomotor bands)

**Calculation:**
```
GCT (ground contact time):
  IC (initial contact) = leading edge of impact-band peak > 2g
  TO (toe-off) = zero-crossing of locomotor-band vertical velocity after IC
  GCT = TO − IC  (ms)

Flight time:
  flight_time = next_IC − TO  (ms)

Balance:
  gct_flight_balance_ms = GCT − flight_time
```

A value near 0 means equal ground and flight time. Positive = more time on ground than air (common in beginners). Negative = more flight than ground (springy/efficient runners).

| | Value |
|-|-------|
| Good | 50–100 ms |
| Concern | > 120 ms |
| Bad threshold | > 150 ms |
| Typical in sample | 82.5 ms (GCT 308ms − flight 225.5ms) |

**Caveat:** At speeds > 13 km/h, sacrum-derived GCT overestimates vs foot-mounted reference (Garcia-Pinillos 2022).

---

### 4. Impact Loading Rate (`impact_loading_rate_bw_s`)

**What the user understands:** How hard the landing force builds up at each footstrike. High rate → more shock to joints → stress fracture / shin splint risk.

**Sensor:** LSM9DS1 accelerometer Z-axis (impact band, 5–50 Hz)

**Calculation:**
```
Per IC, take 100ms window of impact-band signal:
  a_peak = max(a_linear.z) in window

  Peak vGRF = regression(a_peak, cadence, body_mass)
    [Cottagiri / Pavailler 2022, n=100 runners at 9–13 km/h]

  Loading rate = (vGRF@80%peak − vGRF@20%peak)
               / (t@80% − t@20%)
  Smooth over last 5–10 strides → BW/s
```

**Note on scale:** The firmware outputs loading rate in a normalised BW/s scale where typical jogging values are **15–35 BW/s** (not the 50–100 BW/s commonly cited in lab literature, which uses different instrumentation).

| | Value |
|-|-------|
| Good | 15–25 BW/s |
| Concern | 25–30 BW/s |
| Bad threshold | > 30 BW/s |
| Typical in sample | 24.71 BW/s |
| UI color scale | 10 BW/s (green) → 45 BW/s (red) |

**Caveat:** vGRF regression has RMSE ~0.15 BW (±6%) under validation conditions. Error grows on different surfaces, shoes, or fatigue states. Trust the trend, not the absolute number.

**Also available:** `peak_vgrf_bw_estimate` (typically 1.8–2.6 ×BW) shown as secondary number on Impact row.

---

### 5. Trunk Forward Lean (`trunk_forward_lean_deg`)

**What the user understands:** How far the upper body is tilted forward. Some lean is good (propulsion), too much causes lower-back strain; negative means leaning backward (braking posture).

**Sensor:** LSM9DS1 accelerometer (gravity component from Madgwick filter)

**Calculation:**
```
pitch = atan2(a_gravity.x, a_gravity.z)
lean  = pitch − calibration_reference_pitch
low-pass filter at 0.5 Hz (removes stride oscillation, keeps bulk lean)
Update at 1 Hz
```

| | Value |
|-|-------|
| Good | 5–15° |
| Concern | > 15° or < 2° |
| Bad threshold | > 18° or < 0° (backward lean) |
| Typical in sample | 12.3° |
| UI color scale | uses \|lean\| so both over-forward and backward lean show as bad |

**Important caveat:** This measures **pelvic tilt**, not true trunk lean. They correlate during normal running but decouple when the runner "breaks at the waist." A second IMU at the sternum would be needed for true trunk lean. Negative values (backward lean) are usually a Madgwick filter cold-start artifact — allow ~5 s after calibration for convergence.

---

### 6. Left/Right Asymmetry (`left_right_asymmetry_pct`)

**What the user understands:** How different the left and right leg landings are. Perfect symmetry = 0%. High asymmetry may indicate muscle imbalance or compensation for pain.

**Sensor:** LSM9DS1 accelerometer XYZ (wideband)

**Calculation (Pogson "crackle" method, PMC11894424):**
```
a_res = sqrt(ax² + ay² + az²)
crackle = d³(a_res)/dt³  (Savitzky-Golay 5th-order, 21-sample window)

At each IC:
  sign of mediolateral crackle → Left foot (one sign) or Right foot (other sign)

Asymmetry index = |mean(left_magnitude) − mean(right_magnitude)|
                / mean(both) × 100%
Rolling 30-stride window, updated every ~10 s
```

| | Value |
|-|-------|
| Noise floor | < 5% (treat as zero) |
| Concern | > 8% |
| Bad threshold | > 12% |
| Typical in sample | 14.2% (flagged) |
| UI color scale | 0% (green) → 20% (red) |

**Caveat:** Weakest metric from a single sacrum IMU. Single-sacrum L/R discrimination is moderate in literature. Values < 5% should be treated as noise. For precise asymmetry, bilateral foot/shank IMUs would be needed.

---

### 7. Heel Strike Likelihood (`heel_strike_likelihood`)

**What the user understands:** Probability of landing heel-first (0 = definite midfoot/forefoot, 1 = definite heel strike). Heel striking at low cadence increases impact loading.

**Sensor:** LSM9DS1 accelerometer Z-axis (impact band)

**Calculation:**
```
Per IC, extract 50ms window of impact-band signal:
  initial_peak_amplitude  (g)
  time_to_peak            (ms)  ← also stored as footstrike_time_to_peak_ms
  sharpness = peak / integral(window)

Heel signature:   amplitude >3g, time_to_peak <20ms, high sharpness
Forefoot signature: amplitude <2g, time_to_peak >40ms, low sharpness

Output: continuous 0–1 probability
  → displayed as MID (< 0.5) or HEEL (≥ 0.5)
Updated every ~10 strides
```

| | Value |
|-|-------|
| Midfoot/forefoot | < 0.5 |
| Mixed | 0.5–0.65 |
| Heel | > 0.65 |
| Bad threshold | > 0.7 |
| Typical in sample | 0.72 (heel) |

**Caveat:** Sacrum is a poor location for footstrike detection — the impact transient is heavily filtered by the kinetic chain. This is a coarse 2-class signal (heel vs. not-heel), not a 3-class continuum. Treat as directional coaching signal only.

---

## Model Output Fields

| Field | Description |
|-------|-------------|
| `class` | `"Good"` or `"Bad Form"` — Transformer model output |
| `probabilities` | `{ "Good": 0–1, "Bad Form": 0–1 }` — confidence |
| `dominant_feature` | Feature key with highest model attention weight |
| `attention_weights` | Per-feature attention from model (0–1, sums to 1) |
| `feature_contributions` | SHAP-like logit contributions — positive pushes toward Bad Form, negative toward Good |
| `priority_trigger.code` | Rule-based alert code (e.g. `lean_high`, `impact_estimate_high`) |

---

## Environment Fields

Measured by **Modulino THERMO** (SHT40 sensor) on the UNO Q belt unit.

| Field | Unit | Description |
|-------|------|-------------|
| `temperature_c` | °C | Ambient air temperature |
| `humidity_pct` | % | Relative humidity |
| `heat_index_c` | °C | Feels-like temperature (NWS Rothfusz regression combining temp + humidity) |
| `risk_state` | Normal / Caution / Danger | Thermal stress category |
| `risk_score` | 0–100 | Numeric risk scale |

**Risk thresholds (NWS scale):**

| risk_state | Heat Index | Meaning |
|-----------|-----------|---------|
| Normal | < 27°C | No thermal concern |
| Caution | 27–32°C | Fatigue possible with prolonged exercise |
| Danger | > 32°C | Heat cramps / exhaustion likely |

**Dashboard alert policy (Thailand-calibrated):**

Thailand's ambient heat index is typically 30–37°C year-round. Alerting at the standard NWS Caution threshold (27°C) would trigger on every run and cause alert fatigue.

| Condition | Banner shown? | Env row color |
|-----------|--------------|--------------|
| Heat index < 27°C | No | White |
| Heat index 27–32°C (Caution / "Warm humid") | No | Amber |
| Heat index 32–38°C (Danger / "Risk elevated") | No | Amber |
| Heat index > 38°C (CRIT / "Risk high") | **Yes — red** | Red |
| Sensor unavailable or stale | **Yes — amber** | Grey |

The WARN messages are still visible on the Page 0 telemetry env rows as amber-coloured values — the runner can see them but the screen is not interrupted.
