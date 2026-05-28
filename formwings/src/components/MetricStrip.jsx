const C = {
  good: "#10B981",
  warn: "#F59E0B",
  bad:  "#EF4444",
  teal: "#06B6D4",
};

function metricColor(value, lo, hi, invert = false) {
  const ratio = (value - lo) / (hi - lo);
  if (invert) {
    if (ratio < 0.4) return C.good;
    if (ratio < 0.7) return C.warn;
    return C.bad;
  }
  if (ratio > 0.6) return C.good;
  if (ratio > 0.35) return C.warn;
  return C.bad;
}

// Icons — solid color only, no partial fill animation
const CadenceIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="17" cy="4" r="2" fill="currentColor" stroke="none" />
    <path d="m7 22 2-6 3-2 1.5 5" />
    <path d="M14 13H8L5 10l3-5 3 2 1 2.5" />
  </svg>
);

const BounceIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeOpacity="0.3" />
    <circle cx="12" cy="7" r="4" fill="currentColor" />
    <path d="M6 21 Q12 17 18 21" strokeOpacity="0.5" />
  </svg>
);

const GctIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="12" x2="12" y2="6" />
    <line x1="12" y1="12" x2="16" y2="14" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

const ImpactIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const LeanIcon = ({ lean }) => {
  const angle = Math.min(Math.abs(lean) / 30, 1) * 0.9;
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="12" y1="22" x2="12" y2="3" stroke="currentColor" strokeOpacity="0.25" />
      <line
        x1="12" y1="22"
        x2={12 + 10 * Math.sin(angle)}
        y2={22 - 18 * Math.cos(angle)}
      />
      <circle cx="12" cy="22" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
};

const AsymIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" strokeOpacity="0.3" />
    <rect x="2" y="9" width="8" height="6" rx="1.5" fill="currentColor" fillOpacity="0.8" stroke="none" />
    <rect x="14" y="11" width="8" height="4" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="none" />
  </svg>
);

const FsIcon = ({ heel }) => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    {heel
      ? <path d="M5 20 Q7 13 10 9 Q13 5 16 5 L18 7 L18 11 Q15 17 11 20 Z" opacity="0.9" />
      : <path d="M7 19 Q9 13 13 10 Q16 7 18 9 L17 13 Q14 17 10 18 Z" opacity="0.9" />
    }
  </svg>
);

function MetricRow({ icon, label, value, subValue, subLabel, color, fill, isFocused }) {
  return (
    <div
      className="flex-1 flex items-center px-5 relative overflow-hidden min-h-0"
      style={{ background: isFocused ? "rgba(6,182,212,0.04)" : "transparent" }}
    >
      {/* Left status stripe */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-all duration-500"
        style={{ background: color }}
      />

      {/* Large value + optional secondary */}
      <div className="flex-shrink-0 flex flex-col justify-center" style={{ minWidth: "6rem" }}>
        <div
          className="font-black font-mono tracking-tighter leading-none"
          style={{ fontSize: "clamp(32px, 7vw, 52px)", color: isFocused ? C.teal : "#ffffff" }}
        >
          {value}
        </div>
        {subValue != null && (
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-[13px] font-black font-mono text-gray-500">{subValue}</span>
            {subLabel && <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{subLabel}</span>}
          </div>
        )}
      </div>

      {/* Label only — no unit */}
      <div className="flex-1 ml-3">
        <span
          className="font-black uppercase tracking-wider leading-none"
          style={{
            fontSize: "clamp(14px, 3.5vw, 18px)",
            color: isFocused ? C.teal : "rgba(255,255,255,0.6)",
          }}
        >
          {label}
        </span>
      </div>

      {/* Icon — color only, no fill animation */}
      <div className="flex-shrink-0 ml-3" style={{ color: isFocused ? C.teal : color }}>
        {icon}
      </div>

      {/* Bottom fill bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[rgba(255,255,255,0.04)]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(4, Math.min(100, fill * 100))}%`, background: color }}
        />
      </div>
    </div>
  );
}

const DOMINANT_FEATURE_IDX = {
  cadence_spm: 0, vertical_oscillation_cm: 1, gct_flight_balance_ms: 2,
  impact_loading_rate_bw_s: 3, trunk_forward_lean_deg: 4,
  left_right_asymmetry_pct: 5, heel_strike_likelihood: 6,
};

export function MetricStrip({ metrics }) {
  if (!metrics) return null;

  const { c, vo, gct, vgrf, vgrf2, lean, asym = 0, fs = 0, heelLikelihood = fs * 0.8, attn, dominantFeature } = metrics;

  const maxAttnIdx = attn && Array.isArray(attn) && attn.length >= 7
    ? attn.indexOf(Math.max(...attn))
    : -1;

  // dominantFeature from model takes priority over attn array
  const focusIdx = dominantFeature != null
    ? (DOMINANT_FEATURE_IDX[dominantFeature] ?? maxAttnIdx)
    : maxAttnIdx;

  // Correct ranges based on actual firmware output scales
  const absLean  = Math.abs(lean);  // both over-forward AND backward lean are bad
  const cadColor  = metricColor(c,       140, 190, false);  // higher = better
  const voColor   = metricColor(vo,      4,   14,  true);   // 4–14 cm; lower = better
  const gctColor  = metricColor(gct,     200, 400, true);   // 200–400 ms; lower = better
  const vgrfColor = metricColor(vgrf,    10,  45,  true);   // 10–45 BW/s loading rate; lower = better
  const leanColor = metricColor(absLean, 0,   25,  true);   // 0–25°; lower = better
  const asymColor = metricColor(asym,    0,   20,  true);   // 0–20%; lower = better
  const fsColor   = heelLikelihood > 0.7 ? C.bad : heelLikelihood > 0.5 ? C.warn : C.good;

  const cadFill  = Math.max(0, Math.min(1, (c - 140) / 50));
  const voFill   = Math.max(0, Math.min(1, 1 - (vo - 4) / 10));
  const gctFill  = Math.max(0, Math.min(1, 1 - (gct - 200) / 200));
  const vgrfFill = Math.max(0, Math.min(1, 1 - (vgrf - 10) / 35));   // loading rate scale
  const leanFill = Math.max(0, Math.min(1, 1 - absLean / 25));
  const asymFill = Math.max(0, Math.min(1, 1 - asym / 20));
  const fsFill   = fs === 0 ? 1 : 0.4;

  const rows = [
    { label: "Cadence",       value: Math.round(c),             color: cadColor,  fill: cadFill,  icon: <CadenceIcon />,          focused: focusIdx === 0 },
    { label: "Bounce",        value: vo.toFixed(1),              color: voColor,   fill: voFill,   icon: <BounceIcon />,            focused: focusIdx === 1 },
    { label: "Ground Contact",value: Math.round(gct),            color: gctColor,  fill: gctFill,  icon: <GctIcon />,               focused: focusIdx === 2 },
    { label: "Impact",        value: vgrf.toFixed(2),            color: vgrfColor, fill: vgrfFill, icon: <ImpactIcon />,
      subValue: vgrf2 != null ? vgrf2.toFixed(2) : null, subLabel: "vGRF",        focused: focusIdx === 3 },
    { label: "Trunk Lean",    value: lean.toFixed(1),            color: leanColor, fill: leanFill, icon: <LeanIcon lean={lean} />,  focused: focusIdx === 4 },
    { label: "Asymmetry",     value: asym.toFixed(1),            color: asymColor, fill: asymFill, icon: <AsymIcon />,              focused: focusIdx === 5 },
    { label: "Foot Strike",   value: fs === 0 ? "MID" : "HEEL", color: fsColor,   fill: fsFill,   icon: <FsIcon heel={fs === 1} />, focused: focusIdx === 6 },
  ];

  return (
    <div className="flex flex-col h-full divide-y divide-[rgba(255,255,255,0.05)]">
      {rows.map(r => (
        <MetricRow
          key={r.label}
          label={r.label}
          value={r.value}
          subValue={r.subValue}
          subLabel={r.subLabel}
          color={r.color}
          fill={r.fill}
          icon={r.icon}
          isFocused={r.focused}
        />
      ))}
    </div>
  );
}
