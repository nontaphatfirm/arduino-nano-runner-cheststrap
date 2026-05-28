# FormWings — Agent Context

> Read this before touching any code in this folder.

## What This Is
A mobile-first web dashboard for real-time runner form analysis.  
Receives biomechanical data over **Web Bluetooth BLE** from an Arduino UNO Q (which processes IMU data from a Nano 33 BLE Sense chest strap) and displays it on a phone screen during a run.

**Live URL:** https://formwings.vercel.app  
**Deploy:** `vercel --prod` from inside `formwings/`  
**Dev:** `npm run dev` → http://localhost:5173 (HTTP, no BLE on mobile)  
**Dev HTTPS:** `npm run dev:https` → https://<LAN-IP>:5173 (required for Android Chrome BLE)

---

## Stack
- React 19 + Vite 7 + Tailwind v4
- Web Bluetooth API (Chrome/Edge desktop + Android Chrome only — not iOS Safari)
- Web Speech API for voice alerts

---

## Key Files

| File | Role |
|------|------|
| `src/App.jsx` | Navigation shell; owns `useBle` + `useSession` |
| `src/screens/Dashboard.jsx` | Primary screen — 3-page swipeable layout |
| `src/screens/Calibration.jsx` | Sensor baseline flow |
| `src/screens/Summary.jsx` | Post-run recap |
| `src/screens/Settings.jsx` | Mode toggle + BLE connect/disconnect |
| `src/components/PostureArc.jsx` | Animated SVG running figure + lean readout |
| `src/components/MetricStrip.jsx` | Full-screen 7-metric list (Page 0) |
| `src/hooks/useBle.js` | Web Bluetooth hook — connect, notify, reconnect, stale timer |
| `src/hooks/useSession.js` | Elapsed timer, distance, good/bad counts, history |
| `src/lib/bleContract.js` | BLE UUIDs + `parseRaw()` — parses incoming BLE packets |
| `src/lib/imuProcessor.js` | Converts raw IMU frames → 7 biomechanical metrics (client-side) |
| `src/lib/classify.js` | Threshold-based GOOD/BAD fallback when model output is null |
| `src/lib/simulator.js` | Demo data generator (fatigue model over ~300 s) |

---

## Dashboard Layout (3 swipeable pages)

```
┌─────────────────────────┐
│  Clock          11:04   │  ← always visible
│  00:01.83               │  ← session timer
│  GOOD / BAD             │  ← dominant form banner
│  [BLE offline banner?]  │  ← shown only when BLE disconnected/stale
├─────────────────────────┤
│  ← swipe left/right →  │
│                         │
│  Page 0: Telemetry      │  7 metrics, one per row
│  Page 1: PostureArc     │  animated running figure (DEFAULT)
│  Page 2: Score + Hint   │  score ring + advice text
│                         │
├─────────────────────────┤
│  [DEM|LIVE] [PAUSE] [END]│  Row 1 — primary actions
│    [🔇]  [↺]   [⚙]     │  Row 2 — secondary actions
│       · — ·             │  page dots
└─────────────────────────┘
```

---

## BLE Data Contract

**Current (client-side processing):**  
`bleContract.js:parseRaw()` expects raw IMU frames:
```json
{"timestamp":12345,"acc_x_g":0.12,"acc_y_g":0.45,"acc_z_g":0.78,
 "gyro_x_dps":1.2,"gyro_y_dps":2.3,"gyro_z_dps":3.4}
```
`imuProcessor.js` converts these → `{ c, vo, gct, vgrf, lean, asym, fs, form, attn }`.

**Planned (model output from UNO Q):**  
The UNO Q will eventually send pre-computed ML predictions:
```json
{
  "type": "running_form_prediction",
  "features": { "cadence_spm": 166.67, "vertical_oscillation_cm": 7.42, ... },
  "diagnostics": { "gct_ms": 308.0, ... },
  "class": "Bad Form",
  "probabilities": { "Good": 0.12, "Bad Form": 0.88 },
  "attention_weights": { ... },
  "dominant_feature": "impact_loading_rate_bw_s",
  "priority_trigger": { "severity": "WARN", "message_th": "..." }
}
```
`parseRaw()` currently **drops** this format (checks for `acc_x_g`). When the firmware is ready, update `bleContract.js` + bypass `imuProcessor` for this path.

**BLE UUIDs:**
- Service: `19b10000-e8f2-537e-4f6c-d104768a1214`
- Characteristic: `19b10001-e8f2-537e-4f6c-d104768a1214`
- Device name filter: `FROMWiNGs`  (MAC: 14:B5:CD:F0:7C:39)

---

## Metric Shape (internal)

| Key | Metric | Unit | Good range |
|-----|--------|------|------------|
| `c` | Cadence | spm | 160–185 |
| `vo` | Vertical oscillation | cm | 4–10 |
| `gct` | Ground contact time | ms | 160–280 |
| `vgrf` | Peak impact force | ×BW | 1.8–2.6 |
| `lean` | Trunk lean forward | ° | 3–15 |
| `asym` | L/R asymmetry | % | 0–8 |
| `fs` | Foot strike | 0/1 | 0 = fore/mid |
| `form` | Model output | 0/1/null | 0=GOOD |
| `attn` | Attention weights | float[7] | optional |

---

## Key Behaviours
- **Demo mode** — `generatePacket(seq)` simulates fatigue; PostureArc animates when `session.running`
- **BLE mode** — PostureArc animates only when `bleStatus === "connected"`; freezes on stale/disconnect
- **Stale timer** — 2 000 ms without a packet → `status = "stale"` (amber banner)
- **Auto-reconnect** — silently retries every 5 000 ms after disconnect
- **Voice alerts** — fire only on GOOD↔BAD transitions, not every packet
- **Offline banner** — shown on all 3 pages when `mode === "ble" && bleStatus !== "connected"`
