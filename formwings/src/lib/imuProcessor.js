/**
 * ImuProcessor — converts raw Nano 33 BLE Sense IMU packets into
 * the 7 running metrics expected by the FormSense dashboard.
 *
 * Input  (50 Hz): { timestamp, acc_x_g, acc_y_g, acc_z_g,
 *                   gyro_x_dps, gyro_y_dps, gyro_z_dps }
 * Output         : { seq, c, vo, gct, vgrf, lean, asym, fs, form:null }
 *
 * All metrics are derived on the phone:
 *   c    — cadence (spm)          — from step-peak timestamps
 *   vo   — vertical oscillation   — from std-dev of amag window
 *   gct  — ground contact time    — from time amag stays above threshold
 *   vgrf — peak impact force ×BW  — from peak amag per step
 *   lean — trunk lean °           — complementary filter (accel + gyro)
 *   asym — L/R asymmetry %        — alternating step-interval difference
 *   fs   — foot strike 0/1        — rise-rate of amag at foot-strike
 */

const STEP_THRESH  = 1.25;  // g — minimum amag to count as ground contact
const MIN_STEP_MS  = 150;   // ms — discard impacts shorter than this
const MAX_STEP_MS  = 700;   // ms — discard impacts longer than this (trip/stumble)
const KEEP_STEPS   = 12;    // ring-buffer depth for step history
const LEAN_ALPHA   = 0.96;  // complementary filter weight (higher → smoother, slower)
const AMAG_WIN     = 50;    // samples (~1 s at 50 Hz) for VO std-dev

export class ImuProcessor {
  constructor() {
    this._reset();
  }

  _reset() {
    this._prevTs     = null;
    this._pitch      = null;   // trunk lean, null until first accel reading

    // Step state machine
    this._inStep     = false;
    this._stepT0     = 0;
    this._stepPeak   = 0;
    this._stepSamples = [];    // amag samples collected during current step

    // Per-step history (ring buffers of length KEEP_STEPS)
    this._stepTimes  = [];     // ts at which each step ended
    this._gcts       = [];     // ground contact duration (ms)
    this._peaks      = [];     // peak amag per step (proxy for vGRF)
    this._strikes    = [];     // 0=forefoot 1=heel per step

    // Oscillation ring buffer
    this._amagBuf    = [];

    // Last output (returned every call until a better estimate is ready)
    this._last = { seq:0, c:170, vo:7, gct:250, vgrf:2.2, lean:8, asym:2, fs:0, form:null };
  }

  reset() { this._reset(); }

  /** Process one raw IMU frame, return current metric estimates. */
  process(raw) {
    const ax = raw.acc_x_g    ?? 0;
    const ay = raw.acc_y_g    ?? 0;
    const az = raw.acc_z_g    ?? 0;
    const gx = raw.gyro_x_dps ?? 0;
    const ts = raw.timestamp  ?? Date.now();

    // dt in seconds, clamped to avoid huge jumps after pauses
    const dt = this._prevTs !== null
      ? Math.min((ts - this._prevTs) / 1000, 0.15)
      : 0.02;
    this._prevTs = ts;

    // ── 1. Acceleration magnitude ──────────────────────────────
    const amag = Math.sqrt(ax * ax + ay * ay + az * az);

    // ── 2. Trunk lean — complementary filter ──────────────────
    // accel-based tilt: how far the sensor leans from vertical
    const accelLean = Math.atan2(ax, Math.sqrt(ay * ay + az * az)) * (180 / Math.PI);
    // gx ≈ pitch rate for waist-mounted sensor (rotation around frontal axis)
    if (this._pitch === null) {
      this._pitch = accelLean;  // cold start: seed from accel
    } else {
      this._pitch = LEAN_ALPHA * (this._pitch + gx * dt) + (1 - LEAN_ALPHA) * accelLean;
    }
    const lean = +Math.abs(this._pitch).toFixed(1);

    // ── 3. Vertical oscillation — std-dev of amag window ──────
    this._amagBuf.push(amag);
    if (this._amagBuf.length > AMAG_WIN) this._amagBuf.shift();

    let vo = this._last.vo;
    if (this._amagBuf.length >= 10) {
      const mean = this._amagBuf.reduce((s, v) => s + v, 0) / this._amagBuf.length;
      const std  = Math.sqrt(
        this._amagBuf.reduce((s, v) => s + (v - mean) ** 2, 0) / this._amagBuf.length
      );
      // std ≈ 0.05g at slow jog → ~3 cm; 0.3g at fast run → ~15 cm
      vo = +(Math.max(3, Math.min(15, std * 50)).toFixed(1));
    }

    // ── 4. Step detection — threshold state machine ────────────
    if (amag > STEP_THRESH) {
      if (!this._inStep) {
        // foot-strike: enter ground contact
        this._inStep      = true;
        this._stepT0      = ts;
        this._stepPeak    = amag;
        this._stepSamples = [amag];
      } else {
        if (amag > this._stepPeak) this._stepPeak = amag;
        this._stepSamples.push(amag);
      }
    } else if (this._inStep) {
      // toe-off: exit ground contact
      this._inStep = false;
      const dur    = ts - this._stepT0;

      if (dur >= MIN_STEP_MS && dur <= MAX_STEP_MS) {
        // Foot strike classification: fast initial rise → heel, slow → forefoot
        // Compare the first-quarter amag rise vs the threshold
        const q1 = Math.floor(this._stepSamples.length * 0.25);
        const earlyPeak = this._stepSamples[Math.max(0, q1)];
        const riseRate  = (earlyPeak - 1.0) / ((dur * 0.25) / 1000); // g/s
        const isHeel    = riseRate > 4;  // threshold calibrated for waist sensor

        this._stepTimes.push(ts);
        this._gcts.push(dur);
        this._peaks.push(this._stepPeak);
        this._strikes.push(isHeel ? 1 : 0);

        // Keep ring buffers trimmed
        if (this._stepTimes.length > KEEP_STEPS) {
          this._stepTimes.shift();
          this._gcts.shift();
          this._peaks.shift();
          this._strikes.shift();
        }
      }

      this._stepPeak    = 0;
      this._stepSamples = [];
    }

    // ── 5. Cadence — from recent step timestamps ───────────────
    let cadence = this._last.c;
    const nSteps = this._stepTimes.length;
    if (nSteps >= 2) {
      const span = this._stepTimes[nSteps - 1] - this._stepTimes[0];
      cadence = Math.round((nSteps - 1) / span * 60_000);
      cadence = Math.max(100, Math.min(220, cadence));
    }

    // ── 6. GCT — rolling average of last 5 step durations ─────
    const gctSlice = this._gcts.slice(-5);
    const gct = gctSlice.length
      ? Math.round(gctSlice.reduce((a, b) => a + b, 0) / gctSlice.length)
      : this._last.gct;

    // ── 7. vGRF — rolling average of last 5 peak amags ────────
    const pkSlice = this._peaks.slice(-5);
    const vgrf = pkSlice.length
      ? +(pkSlice.reduce((a, b) => a + b, 0) / pkSlice.length).toFixed(2)
      : this._last.vgrf;

    // ── 8. Foot strike — majority vote of last 5 steps ────────
    const strSlice = this._strikes.slice(-5);
    const fs = strSlice.length
      ? (strSlice.reduce((a, b) => a + b, 0) > strSlice.length / 2 ? 1 : 0)
      : this._last.fs;

    // ── 9. L/R asymmetry — alternating step-interval diff ─────
    let asym = this._last.asym;
    if (this._stepTimes.length >= 4) {
      const intervals = [];
      for (let i = 1; i < this._stepTimes.length; i++) {
        intervals.push(this._stepTimes[i] - this._stepTimes[i - 1]);
      }
      const even = intervals.filter((_, i) => i % 2 === 0);
      const odd  = intervals.filter((_, i) => i % 2 !== 0);
      const avgE = even.reduce((a, b) => a + b, 0) / even.length;
      const avgO = odd.reduce((a, b) => a + b, 0) / odd.length;
      const avgAll = (avgE + avgO) / 2;
      if (avgAll > 0) {
        asym = +(Math.max(0, Math.min(30, Math.abs(avgE - avgO) / avgAll * 100)).toFixed(1));
      }
    }

    this._last = { seq: ts, c: cadence, vo, gct, vgrf, lean, asym, fs, form: null };
    return this._last;
  }
}
