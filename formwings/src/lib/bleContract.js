// UUIDs from UNO Q firmware (confirmed via nRF Connect, 2026-05-28)
export const SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
export const CHAR_UUID    = "19b10001-e8f2-537e-4f6c-d104768a1214";
export const DEVICE_NAME  = "FROMWiNGs";

// Attention-weight key order — must match MetricStrip row order
const ATTN_KEYS = [
  "cadence_spm",
  "vertical_oscillation_cm",
  "gct_flight_balance_ms",
  "impact_loading_rate_bw_s",
  "trunk_forward_lean_deg",
  "left_right_asymmetry_pct",
  "heel_strike_likelihood",
];

const HINT_MAP = {
  lean_high:            "Stand taller",
  lean_low:             "Lean forward slightly",
  cadence_low:          "Increase cadence",
  cadence_high:         "Ease the pace",
  impact_estimate_high: "Land softer",
  bounce_high:          "Run flatter",
  gct_high:             "Less time on the ground",
  asymmetry_high:       "Even your left-right stride",
  heel_strike:          "Land on midfoot",
  heel_strike_high:     "Land on midfoot",
};

export function hintFromCode(code) {
  if (!code) return null;
  return HINT_MAP[code] ?? null;
}

/**
 * Parse a running_form_prediction packet from the UNO Q ML pipeline.
 * Returns the internal metric shape used by the dashboard, or null.
 */
export function parsePrediction(text) {
  try {
    const p = JSON.parse(text);
    if (p.type !== "running_form_prediction") return null;

    const f  = p.features    ?? {};
    const d  = p.diagnostics ?? {};
    const aw = p.attention_weights ?? {};

    const env = p.environment ?? null;

    const envData = env ? {
      temperature_c: env.temperature_c,
      humidity_pct:  env.humidity_pct,
      heat_index_c:  env.heat_index_c,
      risk_state:    env.risk_state,
      risk_score:    env.risk_score ?? 0,
    } : null;

    const rec = p.recommendation ?? {};
    const recSeverity = rec.severity ?? "OK";

    // Sensor errors (status !== "ok") always warrant a banner regardless of risk level.
    // Routine warm/humid WARN messages are NOT bannered — they describe normal Thailand
    // conditions and would cause alert fatigue. Only CRIT triggers the banner.
    const isSensorError = env?.status !== "ok";
    const showBanner    = recSeverity === "CRIT" || isSensorError;

    const envAlert = showBanner
      ? {
          severity:  isSensorError ? "WARN" : recSeverity,  // "WARN" | "CRIT"
          state:     env?.risk_state ?? "Unknown",
          message:   rec.device_message ?? "Thermal warning",
          heatIndex: env?.heat_index_c ?? null,
          riskScore: env?.risk_score ?? null,
        }
      : null;

    return {
      // Standard metric fields
      timestamp: (p.timestamp_s ?? Date.now() / 1000) * 1000,
      c:     f.cadence_spm              ?? 0,
      vo:    f.vertical_oscillation_cm  ?? 0,
      gct:   d.gct_ms                   ?? 0,
      vgrf:  f.impact_loading_rate_bw_s ?? 0,  // primary: loading rate
      vgrf2: d.peak_vgrf_bw_estimate    ?? 0,  // secondary: peak vGRF
      lean:  f.trunk_forward_lean_deg   ?? 0,
      asym:  f.left_right_asymmetry_pct ?? 0,
      fs:    (f.heel_strike_likelihood  ?? 0) > 0.5 ? 1 : 0,
      form:  p.class === "Good" ? 0 : 1,

      // Diagnostics extras
      flightTime:  d.flight_time_ms              ?? 0,
      gctBalance:  (d.gct_ms ?? 0) - (d.flight_time_ms ?? 0),  // gct_flight_balance_ms
      ttoPeak:     d.footstrike_time_to_peak_ms  ?? 0,
      heelLikelihood: f.heel_strike_likelihood   ?? 0,

      // Attention weights as ordered array
      attn: ATTN_KEYS.map(k => aw[k] ?? 0),

      // Model explanation
      dominantFeature:     p.dominant_feature    ?? null,
      featureContributions: p.feature_contributions ?? null,
      hint:                hintFromCode(p.priority_trigger?.code),

      // Data quality flag
      fallback: (d.detected_step_events ?? 1) <= 0 && (d.fallback_window ?? 0) >= 1,

      // Environment
      envData,
      envAlert,
      probabilities: p.probabilities ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Parse one raw IMU JSON frame from the Nano (legacy path).
 * Expected shape:
 *   {"timestamp":12345,"acc_x_g":0.123,...,"gyro_z_dps":3.456}
 * Returns null on parse failure so caller can drop bad frames.
 */
export function parseRaw(text) {
  try {
    const p = JSON.parse(text);
    if (typeof p.acc_x_g !== "number") return null;
    return {
      timestamp:  p.timestamp   ?? Date.now(),
      acc_x_g:    p.acc_x_g,
      acc_y_g:    p.acc_y_g,
      acc_z_g:    p.acc_z_g,
      gyro_x_dps: p.gyro_x_dps,
      gyro_y_dps: p.gyro_y_dps,
      gyro_z_dps: p.gyro_z_dps,
    };
  } catch {
    return null;
  }
}
