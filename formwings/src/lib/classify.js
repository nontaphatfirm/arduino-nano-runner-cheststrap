/**
 * Threshold-based GOOD/BAD classifier — used in Demo mode and as BLE fallback
 * when packet.form is null. In Model mode the UNO Q Transformer sends form=0|1.
 *
 * Thresholds calibrated to firmware output scales (see METRICS.md):
 *   vgrf = impact loading rate (BW/s), NOT peak vGRF (×BW)
 *   gct  = ground contact time from diagnostics.gct_ms
 */
export function classify(m) {
  if (!m) return "GOOD";
  if (m.c    < 155) return "BAD";   // cadence too low → braking impact risk
  if (m.lean > 18)  return "BAD";   // over-lean → lower-back strain
  if (m.lean < 0)   return "BAD";   // backward lean → braking posture
  if (m.gct  > 330) return "BAD";   // ground contact too long → loading risk
  if (m.vgrf > 30)  return "BAD";   // impact loading rate too high (BW/s scale)
  if (m.asym > 12)  return "BAD";   // significant L/R imbalance
  return "GOOD";
}

/** Primary metric causing BAD — used for hint when no model hint is available. */
export function badReason(m) {
  if (!m) return null;
  if (m.lean  > 18)  return "Stand taller";
  if (m.lean  < 0)   return "Lean forward slightly";
  if (m.c     < 155) return "Increase cadence";
  if (m.vgrf  > 30)  return "Land softer";
  if (m.gct   > 330) return "Less time on the ground";
  if (m.asym  > 12)  return "Even your left-right stride";
  if (m.fs    === 1) return "Land on midfoot";
  return null;
}
