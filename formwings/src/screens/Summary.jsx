const C = {
  good: "#10B981",
  bad:  "#EF4444",
  warn: "#F59E0B",
  teal: "#06B6D4",
  muted:"#8BAEC8",
  bg:   "#030712",
};

// ── Chart helpers ──────────────────────────────────────────────────────────

function downsample(arr, maxPts = 200) {
  if (arr.length <= maxPts) return arr;
  const step = arr.length / maxPts;
  return Array.from({ length: maxPts }, (_, i) => arr[Math.floor(i * step)]);
}

function rollingAvg(arr, key, win = 6) {
  return arr.map((_, i) => {
    const s = arr.slice(Math.max(0, i - win + 1), i + 1);
    return s.reduce((acc, p) => acc + (p[key] ?? 0), 0) / s.length;
  });
}

function FormTimeline({ data }) {
  if (!data.length) return null;
  const W = 300, H = 14;
  const segments = [];
  let start = 0, cur = data[0].formState;
  for (let i = 1; i <= data.length; i++) {
    if (i === data.length || data[i].formState !== cur) {
      segments.push({ x: (start / data.length) * W, w: ((i - start) / data.length) * W, state: cur });
      if (i < data.length) { start = i; cur = data[i].formState; }
    }
  }
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Form State</span>
        <div className="flex gap-2.5">
          <span className="text-[9px] font-black text-[#10B981] uppercase tracking-wider">■ Good</span>
          <span className="text-[9px] font-black text-[#EF4444] uppercase tracking-wider">■ Bad</span>
        </div>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="rounded-sm overflow-hidden">
        {segments.map((s, i) => (
          <rect key={i} x={s.x} y={0} width={Math.max(0.5, s.w)} height={H}
            fill={s.state === "GOOD" ? C.good : C.bad} opacity={0.75} />
        ))}
      </svg>
    </div>
  );
}

function RollingChart({ data, metricKey, label, unit, lo, hi, color }) {
  if (data.length < 2) return null;
  const pts  = downsample(data, 200);
  const vals = rollingAvg(pts, metricKey);
  const W = 300, H = 56, pTop = 4, pBot = 4;
  const range = hi - lo || 1;
  const toY   = v => pTop + (1 - Math.max(0, Math.min(1, (v - lo) / range))) * (H - pTop - pBot);
  const coords = vals.map((v, i) => `${((i / (vals.length - 1)) * W).toFixed(1)},${toY(v).toFixed(1)}`);
  const linePoints = coords.join(' ');
  const areaPoints = `0,${H} ${linePoints} ${W},${H}`;
  const lastVal    = vals[vals.length - 1];
  const lastY      = toY(lastVal);

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
        <span className="text-[11px] font-black font-mono" style={{ color }}>
          {lastVal.toFixed(1)}<span className="text-[9px] text-gray-600 ml-0.5">{unit}</span>
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#grad-${metricKey})`} />
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={W} cy={lastY} r="3" fill={color} />
      </svg>
    </div>
  );
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s, r) => s + (r[key] ?? 0), 0) / arr.length;
}

const METRIC_DEFS = [
  { key: "c",    label: "Cadence",        unit: " spm",  round: 0, 
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1.5">
        <circle cx="18" cy="4" r="2"/><path d="m8 23 2-6 2.5-2 1.5 5"/><path d="M15 13.5H9L6 10l3-5.5 3 2 1 2.5"/>
      </svg>
    ) 
  },
  { key: "vo",   label: "Bounce",         unit: " cm",   round: 1,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1.5">
        <path d="m8 6 4-4 4 4"/><path d="m16 18-4 4-4-4"/><path d="M12 2v20"/>
      </svg>
    )
  },
  { key: "gct",  label: "Ground Contact", unit: " ms",   round: 0,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1.5">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
    )
  },
  { key: "vgrf", label: "Impact Rate",    unit: " BW/s",  round: 1,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1.5">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    )
  },
  { key: "lean", label: "Trunk Lean",     unit: "°",     round: 1,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1.5">
        <line x1="12" y1="22" x2="12" y2="2"/><line x1="12" y1="22" x2="20" y2="6"/><path d="M12 12a8 8 0 0 1 6.5-4"/>
      </svg>
    )
  },
];

export function Summary({ history, fullHistory = [], goodCount, badCount, elapsedFmt, distance, onNavigate }) {
  const total   = goodCount + badCount || 1;
  const goodPct = Math.round((goodCount / total) * 100);
  const isGood  = goodPct >= 70;

  const avgOf = (key) =>
    history.length ? history.reduce((s, p) => s + (p[key] ?? 0), 0) / history.length : 0;

  function makeSvgTimeline(data) {
    if (!data.length) return "";
    const W = 500, H = 20;
    const segs = [];
    let start = 0, cur = data[0].formState;
    for (let i = 1; i <= data.length; i++) {
      if (i === data.length || data[i].formState !== cur) {
        const x = (start / data.length) * W;
        const w = ((i - start) / data.length) * W;
        segs.push(`<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0.5, w).toFixed(1)}" height="${H}" fill="${cur === "GOOD" ? "#10B981" : "#EF4444"}" opacity="0.85"/>`);
        if (i < data.length) { start = i; cur = data[i].formState; }
      }
    }
    return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;border-radius:4px;overflow:hidden">${segs.join("")}</svg>`;
  }

  function makeSvgChart(data, key, lo, hi, stroke) {
    if (data.length < 2) return "";
    const pts  = downsample(data, 150);
    const vals = rollingAvg(pts, key);
    const W = 500, H = 64, pT = 6, pB = 6;
    const range = hi - lo || 1;
    const toY = v => pT + (1 - Math.max(0, Math.min(1, (v - lo) / range))) * (H - pT - pB);
    const coords = vals.map((v, i) => `${((i / (vals.length - 1)) * W).toFixed(1)},${toY(v).toFixed(1)}`);
    const line = coords.join(" ");
    const area = `0,${H} ${line} ${W},${H}`;
    return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block">
      <polygon points="${area}" fill="${stroke}" opacity="0.12"/>
      <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function exportPDF() {
    const date = new Date().toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>FormWings Run Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Arial,sans-serif;background:#fff;color:#111;padding:36px;max-width:720px;margin:0 auto}
  h1{font-size:24px;font-weight:900;letter-spacing:-.5px;margin-bottom:3px}
  .sub{font-size:12px;color:#888;margin-bottom:28px}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
  .card{background:#f5f5f5;border-radius:10px;padding:14px 16px}
  .clabel{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#888;margin-bottom:4px}
  .cval{font-size:26px;font-weight:900;font-family:monospace;line-height:1}
  .cunit{font-size:11px;font-weight:600;color:#888;margin-left:2px}
  .good{color:#059669}.bad{color:#DC2626}
  .pills{display:flex;gap:10px;margin-bottom:28px}
  .pill{padding:5px 14px;border-radius:99px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}
  .pgood{background:#d1fae5;color:#065f46;border:1px solid #6ee7b7}
  .pbad{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
  section{margin-bottom:28px}
  .stitle{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#999;border-bottom:1px solid #eee;padding-bottom:6px;margin-bottom:14px}
  .crow{margin-bottom:16px}
  .clrow{display:flex;justify-content:space-between;margin-bottom:5px;align-items:baseline}
  .clname{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#555}
  .clnum{font-size:12px;font-weight:800;font-family:monospace}
  table{width:100%;border-collapse:collapse}
  tr{border-bottom:1px solid #f0f0f0}
  td{padding:10px 4px;font-size:13px}
  td:last-child{text-align:right;font-family:monospace;font-weight:800;font-size:16px}
  .ml{color:#555;font-weight:600}
  footer{margin-top:32px;font-size:10px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:12px}
  @media print{body{padding:16px;max-width:100%}}
</style></head><body>
<h1>FormWings Run Report</h1>
<div class="sub">Generated ${date}</div>

<div class="grid3">
  <div class="card"><div class="clabel">Duration</div><div class="cval">${elapsedFmt}</div></div>
  <div class="card"><div class="clabel">Distance</div><div class="cval">${distance.toFixed(2)}<span class="cunit">km</span></div></div>
  <div class="card"><div class="clabel">Good Form</div><div class="cval ${goodPct >= 70 ? "good" : "bad"}">${goodPct}<span class="cunit">%</span></div></div>
</div>
<div class="pills">
  <span class="pill pgood">${goodCount} Stable windows</span>
  <span class="pill pbad">${badCount} Alert windows</span>
</div>

<section>
  <div class="stitle">Session Trends</div>
  <div class="crow">
    <div class="clrow"><span class="clname">Form State</span><span style="font-size:10px;color:#888">■ <span style="color:#10B981">Good</span> &nbsp;■ <span style="color:#DC2626">Bad</span></span></div>
    ${makeSvgTimeline(fullHistory)}
  </div>
  <div class="crow">
    <div class="clrow"><span class="clname">Cadence</span><span class="clnum" style="color:#0891b2">${avgOf("c").toFixed(0)} <span style="font-size:9px;color:#888">spm</span></span></div>
    ${makeSvgChart(fullHistory, "c", 140, 190, "#0891b2")}
  </div>
  <div class="crow">
    <div class="clrow"><span class="clname">Trunk Lean</span><span class="clnum" style="color:#d97706">${avgOf("lean").toFixed(1)} <span style="font-size:9px;color:#888">°</span></span></div>
    ${makeSvgChart(fullHistory, "lean", 0, 25, "#d97706")}
  </div>
  <div class="crow">
    <div class="clrow"><span class="clname">Impact Loading Rate</span><span class="clnum" style="color:#dc2626">${avgOf("vgrf").toFixed(1)} <span style="font-size:9px;color:#888">BW/s</span></span></div>
    ${makeSvgChart(fullHistory, "vgrf", 10, 45, "#dc2626")}
  </div>
</section>

<section>
  <div class="stitle">Session Averages</div>
  <table>
    <tr><td class="ml">Cadence</td><td>${avgOf("c").toFixed(0)} <span style="font-size:11px;color:#888">spm</span></td></tr>
    <tr><td class="ml">Vertical Oscillation</td><td>${avgOf("vo").toFixed(1)} <span style="font-size:11px;color:#888">cm</span></td></tr>
    <tr><td class="ml">Ground Contact Time</td><td>${avgOf("gct").toFixed(0)} <span style="font-size:11px;color:#888">ms</span></td></tr>
    <tr><td class="ml">Impact Loading Rate</td><td>${avgOf("vgrf").toFixed(1)} <span style="font-size:11px;color:#888">BW/s</span></td></tr>
    <tr><td class="ml">Trunk Lean</td><td>${avgOf("lean").toFixed(1)} <span style="font-size:11px;color:#888">°</span></td></tr>
    <tr><td class="ml">Asymmetry</td><td>${avgOf("asym").toFixed(1)} <span style="font-size:11px;color:#888">%</span></td></tr>
  </table>
</section>

<footer>FormWings — Running Form Analysis &nbsp;|&nbsp; Arduino Nano 33 BLE Sense + UNO Q Lightweight Transformer</footer>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Allow pop-ups to export PDF."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 700);
  }

  return (
    <main className="min-h-screen bg-[#030712] text-white p-6 max-pt-[max(24px,env(safe-area-inset-top))] max-pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-4.5 select-none">
      <h1 className="margin-0 text-xl font-black uppercase tracking-tight">Run Summary</h1>

      {/* Modern Circular Progress Ring form score card */}
      <div 
        className={`glass-card rounded-2xl p-5 flex flex-col items-center gap-4 relative overflow-hidden ${
          isGood ? "good-glow" : "bad-glow"
        }`}
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-[rgba(255,255,255,0.03)]" />
        
        {/* Dynamic Telemetry Circle */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg width="144" height="144" viewBox="0 0 100 100" className="-rotate-90">
            <circle 
              cx="50" 
              cy="50" 
              r="40" 
              fill="none" 
              stroke="rgba(255,255,255,0.04)" 
              strokeWidth="5" 
            />
            <circle 
              cx="50" 
              cy="50" 
              r="40" 
              fill="none" 
              stroke={isGood ? C.good : C.bad} 
              strokeWidth="6" 
              strokeDasharray="251.2" 
              strokeDashoffset={251.2 - (goodPct / 100) * 251.2}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: "drop-shadow(0 0 4px currentColor)" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <div 
              className="text-4xl font-black font-mono tracking-tighter" 
              style={{ color: isGood ? C.good : C.bad }}
            >
              {goodPct}%
            </div>
            <div className="text-[9px] font-black tracking-widest text-[rgba(255,255,255,0.4)] uppercase mt-0.5 select-none">
              GOOD FORM
            </div>
          </div>
        </div>

        <div className="text-center z-10">
          <div className="text-base font-black text-white tracking-tight">
            {distance.toFixed(2)} km
          </div>
          <div className="text-xs font-semibold text-[rgba(255,255,255,0.45)] mt-0.5">
            Total Duration: {elapsedFmt}
          </div>
        </div>

        {/* Dynamic breakdown pills */}
        <div className="flex gap-2.5 justify-center mt-1 z-10">
          <span className="text-[10px] font-black text-[#10B981] bg-[rgba(16,185,129,0.08)] px-3 py-1 rounded-full border border-[rgba(16,185,129,0.35)] tracking-wider uppercase select-none">
            {goodCount} Stables
          </span>
          <span className="text-[10px] font-black text-[#EF4444] bg-[rgba(239,68,68,0.08)] px-3 py-1 rounded-full border border-[rgba(239,68,68,0.35)] tracking-wider uppercase select-none">
            {badCount} Alerts
          </span>
        </div>
      </div>

      {/* Session trend charts */}
      {fullHistory.length >= 4 && (
        <div className="rounded-2xl p-4.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[10px] font-extrabold text-[rgba(255,255,255,0.4)] tracking-widest uppercase mb-4">
            Session Trends
          </div>
          <div className="flex flex-col gap-5">
            <FormTimeline data={fullHistory} />
            <RollingChart data={fullHistory} metricKey="c"    label="Cadence"      unit="spm"  lo={140} hi={190} color={C.teal} />
            <RollingChart data={fullHistory} metricKey="lean" label="Trunk Lean"   unit="°"    lo={0}   hi={25}  color={C.warn} />
            <RollingChart data={fullHistory} metricKey="vgrf" label="Impact Rate"  unit="BW/s" lo={10}  hi={45}  color={C.bad}  />
          </div>
        </div>
      )}

      {/* Average telemetry readings card */}
      <div className="glass-card rounded-2xl p-4.5">
        <div className="text-[10px] font-extrabold text-[rgba(255,255,255,0.4)] tracking-widest uppercase mb-3">
          Session Averages
        </div>
        <div className="flex flex-col gap-2">
          {METRIC_DEFS.map(({ key, label, unit, round, icon }) => {
            const val = avg(history, key);
            return (
              <div key={key} className="flex justify-between items-center py-2 border-b border-[rgba(255,255,255,0.03)]">
                <span className="text-sm font-semibold text-[rgba(255,255,255,0.6)] flex items-center">
                  <span className="text-[#06B6D4] mr-2.5">{icon}</span>
                  {label}
                </span>
                <span className="text-lg font-black font-mono text-white">
                  {val.toFixed(round)}
                  <span className="text-[10px] font-bold text-[rgba(255,255,255,0.4)] ml-1 uppercase">{unit.trim()}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary control panel actions */}
      <div className="flex gap-3.5 mt-2">
        <button
          onClick={exportPDF}
          className="flex-1 h-11.5 rounded-xl border-none bg-[#06B6D4] text-[#030712] font-black text-xs tracking-wider uppercase cursor-pointer hover:bg-[#22D3EE] transition-all duration-200 select-none shadow-[0_4px_12px_rgba(6,182,212,0.25)] active:scale-[0.98]"
        >
          Export PDF
        </button>
        <button 
          onClick={() => onNavigate("dashboard")} 
          className="flex-1 h-11.5 rounded-xl bg-transparent text-[rgba(255,255,255,0.75)] border border-[rgba(255,255,255,0.12)] font-black text-xs tracking-wider uppercase cursor-pointer hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.03)] transition-all duration-200 select-none active:scale-[0.98]"
        >
          New Session
        </button>
      </div>
    </main>
  );
}
