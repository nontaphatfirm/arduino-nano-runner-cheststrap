function rng(lo, hi) { return lo + Math.random() * (hi - lo); }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function fmt(v, d = 4) { return parseFloat(v.toFixed(d)); }

let t = 0;

export function resetSimulator() { t = 0; }

// Must match ATTN_KEYS order in bleContract.js
const FEATURE_KEYS = [
  "cadence_spm",
  "vertical_oscillation_cm",
  "gct_flight_balance_ms",
  "impact_loading_rate_bw_s",
  "trunk_forward_lean_deg",
  "left_right_asymmetry_pct",
  "heel_strike_likelihood",
];

const HINT_MAP = {
  cadence_spm:             "Increase cadence",
  vertical_oscillation_cm: "Run flatter",
  gct_flight_balance_ms:   "Less time on the ground",
  impact_loading_rate_bw_s:"Land softer",
  trunk_forward_lean_deg:  "Stand taller",
  left_right_asymmetry_pct:"Even your left-right stride",
  heel_strike_likelihood:  "Land on midfoot",
};

export function generatePacket(seq) {
  t += 0.5;
  const fatigue = clamp(t / 300, 0, 1);
  const wave    = (Math.sin(t / 13) + 1) / 2;
  const spike   = Math.random() < 0.10 ? rng(0.3, 1) : 0;

  // ── Biomechanical metrics (calibrated to real payload ranges) ──────────

  const c    = clamp(rng(160, 175) - fatigue * 25 - wave * 4   - spike * 30, 140, 185);
  const vo   = clamp(rng(6.5, 9)   + fatigue * 3  + wave * 1.5 + spike * 4,  3,   14);
  const gct  = clamp(rng(260, 320) + fatigue * 60 + wave * 20  + spike * 80, 200, 400);

  // Flight time derived from stride period and GCT
  // stride_period_ms ≈ 60000 / (c / 2) = 120000 / c  →  per-step ≈ 60000/c
  const stepMs      = 60000 / Math.max(c, 100);
  const flightTime  = clamp(stepMs - gct + rng(-20, 20), 100, 300);
  const gctBalance  = fmt(gct - flightTime, 1);  // gct_flight_balance_ms

  // Loading rate (firmware outputs ~15–35 BW/s range, not 50–100)
  const vgrf  = clamp(rng(18, 28)  + fatigue * 8  + wave * 2   + spike * 10, 10,  45);
  const vgrf2 = clamp(rng(1.9, 2.4)+ fatigue * 0.4 + wave * 0.1 + spike * 0.5, 1.5, 3.2);

  const lean  = clamp(rng(8, 14)   + fatigue * 9  + wave * 3   + spike * 14, 2,   30);
  const asym  = clamp(rng(5, 12)   + fatigue * 8  + wave * 3   + spike * 10, 0,   25);

  // Heel-strike likelihood (0–1); worsens with fatigue
  const heelLikelihood = clamp(rng(0.35, 0.75) + fatigue * 0.2 + spike * 0.3, 0, 1);
  const fs   = heelLikelihood > 0.5 ? 1 : 0;

  // Footstrike time-to-peak (ms): shorter = more heel-like
  const ttoPeak = clamp(10 + (1 - heelLikelihood) * 40 + rng(-3, 3), 5, 60);

  // ── Attention weights ──────────────────────────────────────────────────
  const badness = [
    clamp(1 - (c - 140) / 45, 0, 1),                  // cadence: low = bad
    clamp((vo - 5) / 9, 0, 1),                         // bounce: high = bad
    clamp(Math.max(gctBalance, 0) / 120, 0, 1),        // balance: high = bad
    clamp((vgrf - 15) / 25, 0, 1),                     // loading rate: high = bad
    clamp((lean - 5) / 22, 0, 1),                      // lean: high = bad
    clamp(asym / 20, 0, 1),                             // asym: high = bad
    clamp((heelLikelihood - 0.3) / 0.7, 0, 1),         // heel: high = bad
  ];

  const weightedSum = badness.reduce((s, v) => s + v + 0.05, 0);
  const attn = badness.map(v => fmt((v + 0.05) / weightedSum));

  const domIdx        = badness.indexOf(Math.max(...badness));
  const dominantFeature = FEATURE_KEYS[domIdx];

  // ── Feature contributions (SHAP-like logit values) ─────────────────────
  // Positive pushes toward "Bad Form", negative toward "Good"
  // Calibrated to real payload magnitude range (-5 to +8)
  const contribRaw = [
    -(c - 165) / 4   + rng(-0.3, 0.3),   // low cadence = positive (bad)
    (vo - 7.5) / 3   + rng(-0.15, 0.15), // high bounce = positive
    gctBalance / 25  + rng(-0.3, 0.3),   // high balance = positive
    (vgrf - 22) / 3  + rng(-0.3, 0.3),   // high loading = positive
    (lean - 12) / 3  + rng(-0.3, 0.3),   // high lean = positive
    (asym - 10) / 8  + rng(-0.1, 0.1),   // high asym = positive
    (heelLikelihood - 0.45) * 14 + rng(-0.4, 0.4), // heel strike = large positive
  ];

  const featureContributions = {};
  FEATURE_KEYS.forEach((k, i) => { featureContributions[k] = fmt(contribRaw[i]); });

  // ── Classification ─────────────────────────────────────────────────────
  const isBad = c < 155 || lean > 18 || gct > 330 || asym > 12 || heelLikelihood > 0.7 || vgrf > 30;
  const form  = isBad ? 1 : 0;

  const meanBad = clamp(
    badness.reduce((s, v) => s + v, 0) / badness.length + rng(-0.04, 0.04),
    0.01, 0.99
  );
  const probabilities = {
    "Good":     fmt(1 - meanBad),
    "Bad Form": fmt(meanBad),
  };

  // ── Environment ────────────────────────────────────────────────────────
  const temp      = clamp(27 + wave * 3 + fatigue * 2 + rng(-0.5, 0.5), 22, 38);
  const humidity  = clamp(50 + wave * 12 + rng(-2, 2), 28, 85);
  const heatIndex = clamp(temp + (humidity - 40) * 0.12 + rng(-0.2, 0.2), temp - 1, temp + 6);
  const riskState = heatIndex >= 38 ? "Danger" : heatIndex >= 32 ? "Caution" : "Normal";
  const riskScore = Math.round(clamp((heatIndex - 18) * 3, 0, 100));

  const envData  = {
    temperature_c: fmt(temp, 2),
    humidity_pct:  fmt(humidity, 2),
    heat_index_c:  fmt(heatIndex, 2),
    risk_state:    riskState,
    risk_score:    riskScore,
  };
  // Map heat index to exact device_message strings (matches firmware)
  let recSeverity = "OK";
  let recMessage  = "Thermal conditions look normal.";
  if (heatIndex >= 38)      { recSeverity = "CRIT"; recMessage = "Heat risk high; slow down, hydrate, and consider stopping."; }
  else if (heatIndex >= 32) { recSeverity = "WARN"; recMessage = "Heat risk elevated; reduce pace and avoid hard intervals."; }
  else if (heatIndex >= 29) { recSeverity = "WARN"; recMessage = "Warm humid conditions; control pace and hydrate."; }

  // Only banner on CRIT — WARN is routine in Thailand's climate and causes alert fatigue.
  // Sensor errors would set isSensorError=true and still show a banner (handled in bleContract).
  const envAlert = recSeverity === "CRIT" ? {
    severity:  "CRIT",
    state:     riskState,
    message:   recMessage,
    heatIndex: envData.heat_index_c,
    riskScore,
  } : null;

  return {
    seq,
    // Biomechanical
    c, vo, gct,
    flightTime: fmt(flightTime, 1),
    gctBalance,
    vgrf,    // impact loading rate (primary)
    vgrf2,   // peak vGRF estimate (secondary)
    lean, asym,
    heelLikelihood: fmt(heelLikelihood, 2),
    fs,
    ttoPeak: fmt(ttoPeak, 1),
    // Model outputs
    form,
    attn,
    dominantFeature,
    featureContributions,
    hint:     isBad ? (HINT_MAP[dominantFeature] ?? null) : null,
    fallback: false,
    // Environment
    envData,
    envAlert,
    probabilities,
  };
}
