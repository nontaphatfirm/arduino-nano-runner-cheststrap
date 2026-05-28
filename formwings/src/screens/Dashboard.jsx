import { useCallback, useEffect, useRef, useState } from "react";
import { PostureArc } from "../components/PostureArc";
import { MetricStrip } from "../components/MetricStrip";
import { classify, badReason } from "../lib/classify";
import { generatePacket, resetSimulator } from "../lib/simulator";

const synth = typeof window !== "undefined" && window.speechSynthesis;
function speak(text) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1; u.pitch = 1;
  synth.speak(u);
}

function BleChip({ bleStatus }) {
  if (bleStatus === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#10B981] bg-[rgba(16,185,129,0.06)] px-2.5 py-0.5 rounded-full border border-[rgba(16,185,129,0.25)] tracking-wider uppercase select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
        Live
      </span>
    );
  }
  if (bleStatus === "stale") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#F59E0B] bg-[rgba(245,158,11,0.06)] px-2.5 py-0.5 rounded-full border border-[rgba(245,158,11,0.25)] tracking-wider uppercase select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-ping" />
        Sync
      </span>
    );
  }
  if (bleStatus === "disconnected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#EF4444] bg-[rgba(239,68,68,0.06)] px-2.5 py-0.5 rounded-full border border-[rgba(239,68,68,0.25)] tracking-wider uppercase select-none">
        Offline
      </span>
    );
  }
  return null;
}

export function RunningMan({ color, strideSec, size = 24 }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2.8" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="opacity-95"
    >
      {/* Head */}
      <circle cx="12" cy="5" r="1.8" fill={color} stroke="none" />
      
      {/* Torso */}
      <line x1="12" y1="7" x2="12" y2="13" />
      
      {/* Left Arm */}
      <path d="M 12 8 L 9 11 L 11 14" />
      
      {/* Right Arm */}
      <path d="M 12 8 L 15 11 L 13 14" />
      
      {/* Left Leg */}
      <path d="M 12 13 L 10 17 L 13 20" />
      
      {/* Right Leg */}
      <path d="M 12 13 L 14 17 L 11 20" />
    </svg>
  );
}

export function WorkoutLogoRing({ score, strideSec }) {
  const color = score >= 75 ? "#00FF66" : score >= 50 ? "#F59E0B" : "#FF3333";
  const strokeDashoffset = 75.4 - (score / 100 * 75.4); // 2 * PI * r (r=12)
  
  return (
    <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
      {/* Background Track Ring */}
      <svg width="44" height="44" viewBox="0 0 32 32" className="-rotate-90">
        <circle 
          cx="16" cy="16" r="12" 
          fill="none" 
          stroke="rgba(255, 255, 255, 0.08)" 
          strokeWidth="3.8" 
        />
        {/* Dynamic score ring */}
        <circle 
          cx="16" cy="16" r="12" 
          fill="none" 
          stroke={color} 
          strokeWidth="3.8" 
          strokeDasharray="75.4"
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      
      {/* Animating running man stick figure inside circle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <RunningMan color="#00E5FF" strideSec={strideSec} size={22} />
      </div>
    </div>
  );
}

export function PacingSlider({ score, formState }) {
  const color = formState === "GOOD" ? "#00FF66" : "#FF3333";
  return (
    <div className="w-full max-w-[320px] h-[40px] flex items-center relative select-none mx-auto">
      {/* Background Track with zone divisions */}
      <div className="absolute inset-x-0 h-3 rounded-full overflow-hidden bg-gradient-to-r from-[#FF3333]/20 via-[#F59E0B]/20 to-[#00FF66]/20 border border-[rgba(255,255,255,0.06)]" />
      
      {/* Sliding Pacing Bubble (Pill shape) */}
      <div 
        className="absolute h-8.5 px-4 rounded-full flex items-center justify-center font-black text-xs select-none transition-all duration-300 ease-out uppercase tracking-widest"
        style={{
          left: `calc(${score}% - ${score * 0.72}px)`, // Adjusts to keep the 72px wide bubble inside viewport bounds
          backgroundColor: color,
          color: "#000000",
          boxShadow: `0 0 12px ${color}60`,
          minWidth: "72px",
        }}
      >
        {formState}
      </div>
    </div>
  );
}

export function Dashboard({ mode, setMode, bleLatest, bleStatus, onNavigate, session }) {
  const [metrics,    setMetrics]    = useState(null);
  const [formState,  setFormState]  = useState("GOOD");
  const [hint,       setHint]       = useState(null);
  const [voice,      setVoice]      = useState(false);
  const [centiSeconds, setCentiSeconds] = useState("00");
  const [wallClock, setWallClock] = useState("10:09");
  const [pageIndex,  setPageIndex]  = useState(1);

  const seqRef       = useRef(0);
  const simRef       = useRef(null);
  const lastFormRef  = useRef("GOOD");
  const touchStartX  = useRef(null);

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    setPageIndex(p => delta < 0 ? Math.min(2, p + 1) : Math.max(0, p - 1));
  }

  // Dynamic wall clock effect
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      setWallClock(`${h}:${m}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  // Centiseconds rolling effect when workout is active
  useEffect(() => {
    if (!session.running) { setCentiSeconds("00"); return; }
    let frame;
    const update = () => {
      const ms = Date.now() % 1000;
      setCentiSeconds(String(Math.floor(ms / 10)).padStart(2, "0"));
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [session.running]);

  const applyPacket = useCallback((packet) => {
    const form = packet.form !== null
      ? (packet.form === 0 ? "GOOD" : "BAD")   // model result from UNO Q
      : classify(packet);                       // demo threshold fallback

    const reason = form === "BAD" ? (packet.hint ?? badReason(packet)) : null;
    setMetrics(packet);
    setFormState(form);
    setHint(reason);
    if (!session.running) session.startSession();
    session.recordPacket(packet, form);
    // voice alert on state transition
    if (voice && form !== lastFormRef.current) {
      speak(form === "BAD" ? `Bad form. ${reason ?? ""}` : "Good form.");
    }
    lastFormRef.current = form;
  }, [session, voice]);

  // Demo mode: tick every 500 ms
  useEffect(() => {
    if (mode !== "demo") { clearInterval(simRef.current); return; }
    resetSimulator();
    simRef.current = setInterval(() => {
      seqRef.current += 1;
      applyPacket(generatePacket(seqRef.current));
    }, 500);
    return () => clearInterval(simRef.current);
  }, [mode, applyPacket]);

  // BLE mode: consume latest packet from useBle
  useEffect(() => {
    if (mode !== "ble" || !bleLatest) return;
    applyPacket(bleLatest);
  }, [mode, bleLatest, applyPacket]);

  const isGood = formState === "GOOD";
  const arcActive = mode === "demo" ? session.running : bleStatus === "connected";

  const cadence = metrics?.c ?? 170;
  const strideSec = (60 / cadence).toFixed(3);
  
  const asym = metrics?.asym ?? 2;
  const fs = metrics?.fs ?? 0;

  // Theming colors based on posture alerts and asymmetries
  const color = isGood ? "#00FF66" : "#FF3333";
  // Compute live Form Score (0 - 100) dynamically based on all 7 parameters
  const formScore = (() => {
    if (!metrics) return 100;
    const { c, vo, gct, vgrf, lean } = metrics;
    let score = 100;

    // 1. Cadence (ideal 170+ spm)
    if (c < 170) score -= Math.max(0, 170 - c) * 0.6;
    // 2. Vertical oscillation (ideal <= 8 cm)
    if (vo > 8)  score -= Math.max(0, vo - 8) * 4;
    // 3. Ground contact time (ideal <= 280 ms)
    if (gct > 280) score -= Math.max(0, gct - 280) * 0.12;
    // 4. Impact loading rate (ideal <= 25 BW/s; firmware scale)
    if (vgrf > 25) score -= Math.max(0, vgrf - 25) * 0.8;
    // 5. Trunk lean (ideal 5–15°; penalise both over-lean and backward lean)
    const absLean = Math.abs(lean);
    if (absLean > 15) score -= Math.max(0, absLean - 15) * 2;
    // 6. L/R asymmetry (ideal < 8%)
    if (asym > 8) score -= Math.max(0, asym - 8) * 2.5;
    // 7. Foot strike (heel = penalty)
    const hl = metrics.heelLikelihood ?? (fs === 1 ? 0.8 : 0.2);
    if (hl > 0.5) score -= Math.max(0, hl - 0.5) * 30;
    
    return Math.round(Math.max(0, Math.min(100, score)));
  })();

  return (
    <main className="h-screen flex flex-col bg-[#000000] text-white overflow-hidden justify-between pt-[max(12px,env(safe-area-inset-top))] px-4 pb-[max(12px,env(safe-area-inset-bottom))] relative font-sans">

      {/* ── LOCKED HEIGHT HUD STATUS HEADER ── */}
      <div 
        className="flex items-center justify-end select-none px-1 h-11 flex-shrink-0"
      >
        <div className="text-[15px] font-black text-[rgba(255,255,255,0.7)] tracking-wide font-mono">
          {wallClock}
        </div>
      </div>

      {/* ── 2. WORKOUT MASSIVE NEON YELLOW TIMER ── */}
      <div className="text-center select-none py-1.5 flex-shrink-0">
        <div className="text-6xl font-black font-mono tracking-tight text-[#FFFF00] leading-none drop-shadow-[0_2px_10px_rgba(255,255,0,0.2)]">
          {session.elapsedFmt}<span className="text-4xl font-black opacity-85">.{centiSeconds}</span>
        </div>
      </div>

      {/* ── 3. FORM STATE BANNER ── */}
      <div className="text-center select-none flex-shrink-0 py-1">
        <div
          className="text-7xl font-black tracking-widest leading-none"
          style={{ color, textShadow: `0 0 40px ${color}99, 0 0 12px ${color}60` }}
        >
          {formState}
        </div>
      </div>

      {/* ── BLE STATUS NOTICE (all pages) ── */}
      {mode === "ble" && bleStatus !== "connected" && (
        <div className="flex-shrink-0 mx-4 mb-1 px-4 py-2 rounded-xl flex items-center gap-2.5 border"
          style={{
            background: bleStatus === "stale" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
            borderColor: bleStatus === "stale" ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: bleStatus === "stale" ? "#F59E0B" : "#EF4444",
              animation: bleStatus === "stale" ? "ping 1s cubic-bezier(0,0,0.2,1) infinite" : "none",
            }}
          />
          <span
            className="text-[12px] font-black uppercase tracking-widest"
            style={{ color: bleStatus === "stale" ? "#F59E0B" : "#EF4444" }}
          >
            {bleStatus === "stale" ? "Signal lost — reconnecting…" : "BLE offline — connect in Settings"}
          </span>
        </div>
      )}

      {/* ── ENVIRONMENT HEAT ALERT ── */}
      {metrics?.envAlert && (() => {
        const isCrit = metrics.envAlert.severity === "CRIT";
        const bg     = isCrit ? "rgba(239,68,68,0.10)" : "rgba(245,158,11,0.08)";
        const border = isCrit ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.3)";
        const clr    = isCrit ? "#EF4444" : "#F59E0B";
        return (
          <div className="flex-shrink-0 mx-4 mb-1 px-4 py-2 rounded-xl flex items-center gap-2.5 border"
            style={{ background: bg, borderColor: border }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={clr} strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
            </svg>
            <span className="text-[12px] font-black uppercase tracking-widest" style={{ color: clr }}>
              {metrics.envAlert.message}
            </span>
          </div>
        );
      })()}

      {/* ── 4 + 5. SWIPEABLE PAGES ── */}
      <div
        className="flex-1 min-h-0 w-full overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full"
          style={{ transform: `translateX(${-pageIndex * 100}%)`, transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)" }}
        >

          {/* ── PAGE 0: Telemetry metrics ── */}
          <div className="w-full h-full flex-shrink-0 flex flex-col">
            <div className="flex items-center justify-between px-5 py-2 flex-shrink-0">
              <span className="text-[10px] font-black text-gray-500 tracking-widest uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
                Telemetry
              </span>
              <div className="flex items-center gap-2">
                {metrics?.fallback && (
                  <span className="text-[10px] font-black text-[#F59E0B] bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.3)] px-2 py-0.5 rounded-full uppercase tracking-widest">
                    No Steps
                  </span>
                )}
                {mode === "ble" && <BleChip bleStatus={bleStatus} />}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <MetricStrip metrics={metrics} />
            </div>

            {/* Environment rows */}
            {metrics?.envData && (
              <div className="flex-shrink-0 border-t border-[rgba(255,255,255,0.07)]">
                {[
                  { label: "Temperature", value: `${metrics.envData.temperature_c.toFixed(1)}°C`,
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg> },
                  { label: "Humidity",    value: `${Math.round(metrics.envData.humidity_pct)}%`,
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> },
                  { label: "Heat Index",  value: `${metrics.envData.heat_index_c.toFixed(1)}°C`,
                    color: metrics.envData.risk_state !== "Normal" ? (metrics.envData.risk_state === "Danger" ? "#EF4444" : "#F59E0B") : undefined,
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg> },
                ].map(r => (
                  <div key={r.label} className="flex items-center px-5 h-10 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 flex-1">{r.label}</span>
                    <span className="text-[15px] font-black font-mono mr-3" style={{ color: r.color ?? "rgba(255,255,255,0.7)" }}>{r.value}</span>
                    <span style={{ color: r.color ?? "rgba(255,255,255,0.3)" }}>{r.icon}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── PAGE 1: Enlarged PostureArc (default) ── */}
          <div className="w-full h-full flex-shrink-0 flex items-center justify-center py-2">
            <div
              className={`rounded-[28px] p-3 w-full max-w-[340px] aspect-[160/195] flex items-center justify-center relative overflow-hidden transition-all duration-500 bg-black ${
                isGood
                  ? "border border-[rgba(0,255,102,0.22)] shadow-[0_0_32px_rgba(0,255,102,0.10)]"
                  : "border border-[rgba(255,51,51,0.22)] shadow-[0_0_32px_rgba(255,51,51,0.10)]"
              }`}
            >
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 rounded-tl opacity-40" style={{ borderColor: color }} />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 rounded-tr opacity-40" style={{ borderColor: color }} />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 rounded-bl opacity-40" style={{ borderColor: color }} />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 rounded-br opacity-40" style={{ borderColor: color }} />
              <PostureArc metrics={metrics} formState={formState} active={arcActive} />
            </div>
          </div>

          {/* ── PAGE 2: Form score ── */}
          <div className="w-full h-full flex-shrink-0 flex flex-col px-6 py-4">

            {/* Top: ring + focus — fixed upper half */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-0">
              <div className="relative w-52 h-52 flex-shrink-0 flex items-center justify-center">
                <svg width="208" height="208" viewBox="0 0 208 208" className="-rotate-90">
                  <circle cx="104" cy="104" r="88" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  <circle
                    cx="104" cy="104" r="88"
                    fill="none"
                    stroke={color}
                    strokeWidth="12"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - formScore / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s", filter: `drop-shadow(0 0 8px ${color}60)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-7xl font-black font-mono leading-none" style={{ color }}>{formScore}</span>
                  <span className="text-[11px] font-black text-gray-500 tracking-widest uppercase mt-1">Form Score</span>
                </div>
              </div>

              {metrics?.dominantFeature && (() => {
                const FEATURE_LABELS = {
                  cadence_spm: "Cadence", vertical_oscillation_cm: "Bounce",
                  gct_flight_balance_ms: "Ground Contact", impact_loading_rate_bw_s: "Impact",
                  trunk_forward_lean_deg: "Trunk Lean", left_right_asymmetry_pct: "Asymmetry",
                  heel_strike_likelihood: "Foot Strike",
                };
                const label = FEATURE_LABELS[metrics.dominantFeature];
                return label ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Focus</span>
                    <span className="text-[13px] font-black uppercase tracking-widest px-3 py-1 rounded-full border"
                      style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
                      {label}
                    </span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Bottom: hint — fixed height, never pushes ring */}
            <div className="flex-shrink-0 pb-2 h-[120px] flex items-center">
              {hint ? (
                <div className="w-full px-5 py-4 rounded-2xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)]">
                  <p className="text-[clamp(18px,5vw,28px)] font-black text-[#EF4444] uppercase tracking-wide leading-tight line-clamp-3">{hint}</p>
                </div>
              ) : (
                <div className="w-full px-5 py-4 rounded-2xl bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.2)]">
                  <p className="text-[clamp(18px,5vw,28px)] font-black text-[#10B981] uppercase tracking-wide leading-tight">Form looks good!</p>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* ── 6. COMPLICATION WATCH DOCK ── */}
      <div className="flex flex-col gap-2 px-3 pt-2.5 pb-1 border-t border-[rgba(255,255,255,0.06)] flex-shrink-0 select-none">

        {/* Row 1 — primary actions: mode | pause | end */}
        <div className="flex items-center justify-between gap-3">
          {/* Toggle Mode pill */}
          <div className="flex bg-[rgba(255,255,255,0.05)] rounded-full p-0.5 w-[120px]">
            {["demo", "ble"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 h-11 rounded-full border-none cursor-pointer font-black text-[13px] tracking-wider uppercase transition-all duration-150 ${
                  mode === m
                    ? "bg-[#00FF66] text-[#000000]"
                    : "bg-transparent text-[rgba(255,255,255,0.5)] hover:text-white"
                }`}
              >
                {m === "demo" ? "DEM" : "LIVE"}
              </button>
            ))}
          </div>

          {/* Pause / Resume Pill */}
          <button
            onClick={() => session.running ? session.pauseSession() : session.startSession()}
            className="h-12 flex-1 rounded-full text-[14px] font-black cursor-pointer border-none bg-[#FFFF00] text-black hover:opacity-90 transition-all duration-150 flex items-center justify-center gap-2"
          >
            {session.running ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                PAUSE
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                RUN
              </>
            )}
          </button>

          {/* Stop / End button */}
          <button
            onClick={() => { session.pauseSession(); onNavigate("summary"); }}
            className="w-12 h-12 rounded-full border-none cursor-pointer flex items-center justify-center bg-[#FF3333] text-white hover:opacity-90 font-black text-[13px]"
            title="End Run"
          >
            END
          </button>
        </div>

        {/* Row 2 — secondary actions: voice | reset | settings */}
        <div className="flex items-center justify-center gap-6">
          {/* Audio mute toggle */}
          <button
            onClick={() => setVoice(v => !v)}
            className={`w-12 h-12 rounded-full border-none cursor-pointer flex items-center justify-center transition-all duration-150 ${
              voice
                ? "bg-[#00E5FF] text-black"
                : "bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.7)]"
            }`}
            title="Voice alerts"
          >
            {voice ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            )}
          </button>

          {/* Reset button */}
          <button
            onClick={() => { session.resetSession(); resetSimulator(); }}
            className="w-12 h-12 rounded-full border-none cursor-pointer flex items-center justify-center bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.7)]"
            title="Reset"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          </button>

          {/* Settings button */}
          <button
            onClick={() => onNavigate("settings")}
            className="w-12 h-12 rounded-full border-none cursor-pointer flex items-center justify-center bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.7)]"
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>
 
      {/* ── 7. APPLE WATCH PAGE DOTS INDICATOR ── */}
      <div className="flex justify-center gap-2 py-1 select-none flex-shrink-0">
        {[0, 1, 2].map(i => (
          <button
            key={i}
            onClick={() => setPageIndex(i)}
            className={`rounded-full border-none cursor-pointer transition-all duration-300 ${
              i === pageIndex
                ? "w-4 h-2 bg-white shadow-[0_0_4px_white]"
                : "w-2 h-2 bg-[rgba(255,255,255,0.2)]"
            }`}
          />
        ))}
      </div>

    </main>
  );
}
