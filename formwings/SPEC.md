# FormSense v2 — Product Specification

**Hackathon**: WellSense AIoT & System Product — Super AI Engineer Season 6  
**Demo deadline**: 2026-05-29  
**Stack**: React 19 + Vite + Tailwind v4, no native wrapper

---

## 1. System Architecture

```
[Arduino Nano 33 BLE Sense Rev1]
  LSM9DS1 (9-axis IMU) + Butterworth low-pass filter
  → JSON over USB Serial (115200 baud, ~20 Hz)
  → timestamp_s, acc_x/y/z (g), gyro_x/y/z (deg/s)
        ↓ hardware serial wire
[Arduino UNO Q]
  Sliding window → 7 biomechanical computations
  Lightweight Time-Series Transformer model
    → GOOD / BAD + multi-head attention weights
  Rule-based fallback (for demo/offline mode)
        ↓ BLE GATT Notify (~20 Hz)
[Phone Web App]
  Dashboard display + audio voice alerts
        ↓ HTTPS/WSS
[Supabase]
  athlete rows: user_id, session_id, cadence_spm,
  vertical_oscillation, gct_ms, vgrf_bw, lean_deg,
  asym_pct, foot_strike, form_label, attention_weights
```

---

## 2. BLE Data Contract

| Field        | Service UUID  | `19B10000-E8F2-537E-4F6C-D104768A1214` |
|--------------|---------------|----------------------------------------|
| Char UUID    | notify, 20 Hz | `19B10001-E8F2-537E-4F6C-D104768A1214` |

**Payload** (JSON ≤ 120 bytes):
```json
{
  "seq": 1,
  "c":    174,
  "vo":   8.2,
  "gct":  245,
  "vgrf": 2.4,
  "lean": 9.1,
  "asym": 3.2,
  "fs":   0,
  "form": 0,
  "attn": [0.42, 0.18, 0.12, 0.10, 0.09, 0.06, 0.03]
}
```

| Key    | Metric              | Unit     | Good range      |
|--------|---------------------|----------|-----------------|
| `c`    | Cadence             | spm      | 160–185         |
| `vo`   | Vertical oscillation| cm       | 4–10            |
| `gct`  | Ground contact time | ms       | 160–280         |
| `vgrf` | Peak impact force   | ×BW      | 1.8–2.6         |
| `lean` | Trunk lean forward  | °        | 3–15            |
| `asym` | L/R step asymmetry  | %        | 0–8             |
| `fs`   | Foot strike         | 0/1      | 0 = fore/mid    |
| `form` | Model output        | 0/1/null | 0=GOOD, 1=BAD   |
| `attn` | Attention weights   | [7]      | per-metric focus|

`form: null` → client falls back to threshold classification (`classify.js`).  
`attn` is optional; when present, highlight the dominant metric in the UI.

**Fallback on disconnect**: freeze last values, auto-reconnect every 5 s silently.

---

## 3. Screens & Navigation

```
calibration → dashboard ↔ settings
                ↓
             summary → dashboard (new run)
```

### 3.1 Calibration
- Step 0: Instructions — attach sensor to waistband, stand still
- Step 1: 3-second countdown (skip in demo mode)
- Step 2: Confirmed — "IMU baseline captured"

### 3.2 Dashboard (primary screen)
- Full-screen GOOD / BAD state banner (dominant color)
- Mode toggle strip: 🎮 DEMO ↔ 📡 BLE LIVE (switches data source live)
- Voice alert toggle 🔊/🔇 (Web Speech API, fires on state transitions)
- Run timer + distance (top right)
- Pause / Resume / Reset / End controls
- PostureArc SVG — animated body silhouette + rings (center)
  - Outer ring: cadence sweep dot (one rotation per stride)
  - Middle ring: oscillation thickness (thicker = more bounce)
  - Lean needle: inside ring, 210°–330° arc
  - Body silhouette: pill-shaped filled limbs, leans with trunk lean
  - Legs/arms animate at stride cadence
  - Sensor badge at waist center
  - Foot indicator: heel-dominant vs midfoot/forefoot
- MetricStrip: 7 metric chips with fill bars (bottom)
  - When `attn` present, highlight chip with highest attention weight

### 3.3 Settings
- Data source: Demo ↔ BLE Live
- BLE connection status + Connect/Disconnect
- BLE data contract reference (UUIDs + payload format)
- Calibration shortcut

### 3.4 Summary
- % GOOD form, run time, distance
- GOOD / BAD count pills
- Average of all 7 metrics
- Foot strike dominant pattern
- Share (Web Share API / clipboard fallback)
- New run → returns to dashboard with reset session

---

## 4. Data Modes

### Demo mode
- `generatePacket(seq)` — simulates fatigue over ~300 s
- Fatigue model: cadence drifts down, GCT up, lean increases, occasional spikes
- `form: null` always → classification via `classify.js` threshold rules

### BLE Live mode
- `useBle.js` — Web Bluetooth API (Chrome/Edge desktop + Android)
- Not available on iOS Safari (limitation noted in UI)
- Stale timer: 2 000 ms → status = "stale"
- Auto-reconnect: every 5 000 ms via `device.gatt.connect()`
- `form` from UNO Q Transformer model (0 or 1); `null` = use threshold

---

## 5. Classification (client-side fallback)

`src/lib/classify.js` — used when `packet.form === null`

| Metric | BAD threshold |
|--------|--------------|
| Cadence | < 152 spm |
| Trunk lean | > 18° |
| GCT | > 310 ms |
| vGRF | > 2.8 ×BW |
| L/R asymmetry | > 10% |

This function is the seam: swap for model inference without changing callers.

---

## 6. Session Tracking

`src/hooks/useSession.js`

- **Elapsed**: wall-clock seconds, ticks every 1 s while `running = true`
- **Distance**: speed × Δt, where speed = (cadence/2 strides/min × 1.35 m) / 60
  - Uses actual Δt between packets (handles both 500 ms demo and 50 ms BLE)
- **History**: last 60 packets (for summary averages)
- **goodCount / badCount**: per-packet tally

---

## 7. Supabase Integration (planned)

Schema: `athlete_sessions`

```sql
user_id        uuid references auth.users
session_id     uuid default gen_random_uuid()
started_at     timestamptz
ended_at       timestamptz
distance_km    float4
good_pct       float4
avg_cadence    float4
avg_vo_cm      float4
avg_gct_ms     float4
avg_vgrf_bw    float4
avg_lean_deg   float4
avg_asym_pct   float4
foot_strike_dominant  text  -- 'heel' | 'midfoot'
packets        jsonb  -- raw history array
```

Upload trigger: user taps **End** → `pauseSession()` → navigate("summary") → POST to Supabase.  
RLS policy: `user_id = auth.uid()`.

---

## 8. Voice Alerts

Web Speech API (`window.speechSynthesis`).  
Fires only on GOOD→BAD or BAD→GOOD transitions (not every packet).  
Messages:
- BAD transition: `"Bad form. <reason>"` (e.g., "Bad form. Low cadence")
- GOOD transition: `"Good form."`
- Toggle: 🔇 button in dashboard header

---

## 9. Design System

| Token    | Value     | Usage |
|----------|-----------|-------|
| `good`   | `#22C55E` | Good form, positive metric |
| `bad`    | `#EF4444` | Bad form, alert |
| `warn`   | `#F59E0B` | Asymmetry caution |
| `teal`   | `#00C2B2` | Primary action, brand |
| `muted`  | `#8BAEC8` | Labels, secondary text |
| `bg`     | `#0A1628` | Page background |
| `card`   | `#0D2545` | Surface cards |

**Body silhouette**: pill-shaped `<rect rx>` elements (not `<line>`).  
Upper body rotates with lean (anchored at waist); lower body fixed.  
All limbs animate at stride cadence (`halfSec = 30 / cadence`).  
Bouncing on `bodyBob` at full stride period (`strideSec = 60 / cadence`).

---

## 10. Known Limitations

- Web Bluetooth not supported on iOS Safari → demo mode only on iPhone
- Web Bluetooth requires a secure context. A mobile browser opened at a LAN
  `http://<ip>:5173/` URL will not expose `navigator.bluetooth`; use
  `npm run dev:https` and open the printed `https://<ip>:5173/` URL in Android
  Chrome, then accept the local certificate warning.
- Distance is estimated (cadence × avg stride length), not GPS
- `attn` field in payload not yet implemented on UNO Q firmware — UI degrades gracefully
- Supabase upload not yet wired (session data stays local in this release)
- Audio alerts blocked by browser autoplay policy until user interaction

---

## 11. File Map

```
formwings/
├── index.html
├── vite.config.js
├── SPEC.md                  ← this file
└── src/
    ├── main.jsx
    ├── index.css            ← Tailwind + base styles
    ├── App.jsx              ← navigation shell, owns useBle + useSession
    ├── lib/
    │   ├── bleContract.js   ← UUIDs + parsePacket()
    │   ├── classify.js      ← threshold rules + badReason()
    │   └── simulator.js     ← demo data generator
    ├── hooks/
    │   ├── useBle.js        ← Web Bluetooth, reconnect, stale timer
    │   └── useSession.js    ← elapsed, distance, history, counts
    ├── components/
    │   ├── PostureArc.jsx   ← SVG visualizer (rings + body silhouette)
    │   └── MetricStrip.jsx  ← 7 metric chips
    └── screens/
        ├── Dashboard.jsx    ← live run screen
        ├── Settings.jsx     ← mode + BLE config
        ├── Calibration.jsx  ← sensor baseline flow
        └── Summary.jsx      ← post-run recap
```
