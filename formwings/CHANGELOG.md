# FormWings Changelog

## [0.2.2] — 2026-05-28

### BLE Data Contract — New Payload Format
- **`parsePrediction()`** — `bleContract.js` now parses the UNO Q `running_form_prediction` JSON natively; `ImuProcessor` is bypassed when model output is received
- **New fields parsed:** `feature_contributions` (SHAP-like logit values), `gctBalance` (GCT − flight time), `flightTime`, `heelLikelihood` (0–1 continuous), `ttoPeak`, `dominantFeature`, `envData` (always stored), `envAlert` (conditional on severity)
- **Dual-format support** — legacy raw IMU packets (`acc_x_g`, …) still handled via `parseRaw()` + `ImuProcessor` as fallback
- **All 6 firmware thermal messages handled** — `hintFromCode()` maps `priority_trigger.code` → English advice; `recommendation.severity` drives banner visibility

### Telemetry Page (Page 0)
- **Environment rows** — Temperature, Humidity, Heat Index shown at bottom of Page 0 with sensor icons; Heat Index turns amber/red when elevated
- **No-Steps badge** — amber "NO STEPS" pill in header when `fallback_window=1` + `detected_step_events=0`
- **Dominant feature highlight** — the metric row matching `dominant_feature` glows teal; falls back to highest `attention_weight` if absent
- **Secondary vGRF** — `peak_vgrf_bw_estimate` shown as small secondary number below the Impact loading rate value

### Metric Thresholds Corrected
- **Impact loading rate scale fixed** — `metricColor` range corrected from old ×BW scale (1.8–3.2) to loading rate BW/s scale (10–45); Impact row was always red before this fix
- **`classify.js` updated** — BAD thresholds: `vgrf > 30 BW/s` (was `> 2.8 ×BW`), `gct > 330 ms` (was `> 310`), `asym > 12%` (was `> 10%`); added `lean < 0` (backward lean) case
- **`formScore` recalibrated** — all 7 metric penalties use correct scales; heel strike uses continuous `heelLikelihood`
- **Lean icon fix** — uses `|lean|` so negative lean values don't break the needle SVG direction

### Form Score Page (Page 2)
- **Ring position pinned** — hint box is fixed `h-[120px]`; ring never moves regardless of hint length
- **Focus label** — pill below score ring showing `FEATURE_LABELS[dominantFeature]` (e.g. "Focus · CADENCE")
- **Hint text size** — `clamp(18px, 5vw, 28px)` with `line-clamp-3` to prevent overflow

### Alert Fatigue — Thailand Climate Calibration
- **CRIT-only banner** — environment alert banner now fires only for `recommendation.severity === "CRIT"` (heat index > 38°C) or sensor errors; WARN messages (27–38°C) are visible as colored env rows only
- **Sensor error banner** — `environment.status !== "ok"` still triggers an amber banner regardless of risk level

### Demo Simulator Recalibrated
- **Ranges match real firmware output** — cadence 155–175 spm, loading rate 15–35 BW/s, asymmetry 5–18%, heel likelihood 0.35–0.85, GCT 250–380 ms
- **`featureContributions` generated** — SHAP-like logit values with realistic magnitudes (−5 to +8)
- **`flightTime` derived** from step period and GCT; `gctBalance` computed
- **Thermal messages** — simulator maps heat index to exact firmware device_message strings

### Session Summary
- **`fullHistory`** — `useSession` now tracks all packets (no 60-packet limit); passed to Summary for accurate long-run charts
- **Rolling average trend charts** — form state timeline bar + 3 area charts (Cadence, Trunk Lean, Impact Rate) with 6-point rolling average and gradient fill
- **Export PDF** — "Export PDF" button opens a white-background print-friendly report in a new tab and triggers `window.print()`; includes all charts rendered as SVG, Thai locale date, all session averages; color-printer friendly

### Documentation
- **`formwings/METRICS.md`** — comprehensive metric reference: sensor, pipeline, calculation, value ranges, caveats, Thailand alert policy table
- **`formwings/Dataset/DATA_DICTIONARY.md`** — raw IMU dataset field descriptions, file naming, value ranges from 11 213 records, bad-form scenario descriptions
- **`formwings/AGENT.md`** — agent context: architecture diagram, file map, BLE contract, key behaviours
- **`AGENTS.md`** (root) — repo-wide agent context covering hardware + dashboard
- **`CLAUDE.md`** (root) — updated system architecture and BLE output format

---

## [0.2.1] — 2026-05-28

### UI Overhaul
- **Buttons enlarged** — all action buttons grown from 36 px → 48 px; icons scaled from 14 px → 18 px; Pause/Run pill taller with bigger label
- **GOOD / BAD banner** — replaced PacingSlider with full-width `text-7xl` neon-glow form-state banner; most dominant visual on screen
- **3-page swipeable layout** — PostureArc, Telemetry, and Form Score pages navigable by swipe or dot tap
  - Page 0 (left): Full-screen telemetry — 7 metrics, one per row, large values, solid-color icons, colored left stripe + bottom fill bar
  - Page 1 (center, default): Enlarged PostureArc (`max-w-[340px]`) with no metrics overlay
  - Page 2 (right): Form score ring (224 px, neon glow) + large advice/hint text (`text-3xl`)
- **Page dots** — tappable; active dot stretches to pill shape (Apple Watch style)
- **PostureArc enlarged** — card grows from `max-w-[230px]` → `max-w-[340px]`
- **Lean pill widened** — rect expanded from 88 px → 124 px wide to prevent text overflow
- **BLE offline banner** — persistent red/amber strip visible across all three pages when BLE is disconnected or stale
- **PostureArc animation pauses** — running figure freezes on BLE disconnect or stale; resumes on reconnect

### Deployment
- Vercel alias changed from `formsense-v2.vercel.app` → **`formwings.vercel.app`**
- Project renamed from `FormSense-v2/` → `formwings/`

---

## [0.2.0] — 2026-05-27

### Initial FormWings Release
- React 19 + Vite + Tailwind v4 single-page app
- Web Bluetooth GATT (BLE Live mode) + demo simulator
- PostureArc SVG visualiser — animated running figure, lean needle, lean readout pill
- MetricStrip — 5-metric 2-column grid (cadence, bounce, GCT, impact, lean)
- Session tracking — elapsed timer, distance estimate, good/bad packet counts
- Voice alerts via Web Speech API on form-state transitions
- Auto-reconnect every 5 s on BLE disconnect; stale timer at 2 s
- Calibration flow → Dashboard → Summary → Settings screens
- HTTPS dev server (`npm run dev:https`) for Android Chrome BLE access
- Deployed to Vercel
