
/* ─────────────────────────────────────────────────────────────
   PostureArc — Abstract Telemetry Posture Visualizer
   Focused strictly on the leaning spine torso and clinical laser beam.
   All foot strikes and metronome blinking have been relocated to the
   main dashboard edges to maximize phone screen use and glanceability.
 ───────────────────────────────────────────────────────────── */

const CX = 150, CY = 130;

const C = {
  good:  "#10B981",   // Emerald green
  bad:   "#EF4444",   // Red alert
  warn:  "#F59E0B",   // Warning amber
  teal:  "#06B6D4",   // Cyan focus
  ring:  "rgba(255,255,255,0.08)",
  bg:    "#030712",
};

export function PostureRunner({ color, strideSec, lean, bouncePx, active = true }) {
  const ps = active ? "running" : "paused";
  return (
    <g>
      <style>{`
        .pr-bob { animation: prBob ${strideSec}s ease-in-out infinite; animation-play-state: ${ps}; transform-origin: 150px 130px; }
        .pr-arm-l { animation: swingArmL ${strideSec}s ease-in-out infinite; animation-play-state: ${ps}; transform-origin: 150px 78px; }
        .pr-arm-r { animation: swingArmR ${strideSec}s ease-in-out infinite; animation-play-state: ${ps}; transform-origin: 150px 78px; }
        .pr-leg-l { animation: swingLegL ${strideSec}s ease-in-out infinite; animation-play-state: ${ps}; transform-origin: 150px 130px; }
        .pr-leg-r { animation: swingLegR ${strideSec}s ease-in-out infinite; animation-play-state: ${ps}; transform-origin: 150px 130px; }

        @keyframes prBob {
          0%, 100% { transform: translateY(-${bouncePx}px); }
          50% { transform: translateY(0px); }
        }
        @keyframes swingArmL {
          0%, 100% { transform: rotate(25deg); }
          50% { transform: rotate(-35deg); }
        }
        @keyframes swingArmR {
          0%, 100% { transform: rotate(-35deg); }
          50% { transform: rotate(25deg); }
        }
        @keyframes swingLegL {
          0%, 100% { transform: rotate(-20deg); }
          50% { transform: rotate(25deg); }
        }
        @keyframes swingLegR {
          0%, 100% { transform: rotate(25deg); }
          50% { transform: rotate(-20deg); }
        }
      `}</style>

      {/* Main Bobbing Group (bobs legs and upper body together as a rigid unit) */}
      <g className="pr-bob">
        {/* ── LEGS (outside upper-body leaning, but swings around hips 150,130) ── */}
        {/* Left Leg */}
        <path 
          d="M 150 130 L 155 159 L 147 185" 
          stroke={color} 
          strokeWidth="8.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="pr-leg-l"
        />
        {/* Right Leg (background, lower opacity for depth) */}
        <path 
          d="M 150 130 L 155 159 L 147 185" 
          stroke={color} 
          strokeWidth="8.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="pr-leg-r"
          opacity="0.65"
        />

        {/* ── UPPER BODY & HEAD (leans dynamically matching lean degrees inside nested group) ── */}
        <g transform={`rotate(${lean}, 150, 130)`}>
          {/* Torso Spine */}
          <line 
            x1="150" y1="130" 
            x2="150" y2="78" 
            stroke={color} 
            strokeWidth="11.5" 
            strokeLinecap="round" 
            filter="url(#neonGlow)"
          />
          <line 
            x1="150" y1="130" 
            x2="150" y2="78" 
            stroke="#fff" 
            strokeWidth="2.8" 
            strokeLinecap="round" 
            opacity="0.45"
          />

          {/* Head */}
          <circle 
            cx="150" cy="56" r="10.5" 
            fill="#030712" 
            stroke={color} 
            strokeWidth="3.8" 
            filter="url(#neonGlow)"
          />
          <circle 
            cx="150" cy="56" r="3.8" 
            fill="#fff" 
            opacity="0.8"
          />

          {/* Left Arm */}
          <path 
            d="M 150 78 L 138 102 L 156 118" 
            stroke={color} 
            strokeWidth="7.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="pr-arm-l"
          />

          {/* Right Arm */}
          <path 
            d="M 150 78 L 138 102 L 156 118" 
            stroke={color} 
            strokeWidth="7.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="pr-arm-r"
            opacity="0.65"
          />
        </g>
        
        {/* Hips joint cover */}
        <circle cx="150" cy="130" r="6" fill={color} filter="url(#neonGlow)" />
      </g>
    </g>
  );
}

export function PostureArc({ metrics, formState, active = true }) {
  const color   = formState === "GOOD" ? C.good : C.bad;
  const lean    = metrics?.lean  ?? 8;
  const vo      = metrics?.vo    ?? 8;
  const cadence = metrics?.c     ?? 170;

  const strideSec = (60 / cadence).toFixed(3);
  const bouncePx  = Math.min(vo * 0.75, 12).toFixed(1);

  return (
    <div className="relative w-full flex items-center justify-center">
      <svg
        viewBox="70 15 160 210"
        aria-label="Abstract posture visualizer"
        className="w-full h-auto block select-none"
      >
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(17, 24, 39, 0.5)" />
            <stop offset="100%" stopColor="#030712" />
          </radialGradient>
          
          <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Soft background glow */}
        <circle cx={CX} cy={CY} r="95" fill="url(#bgGlow)" />

        {/* ── 1. CLINICAL LASER REFERENCE AXIS ── */}
        
        {/* Soft vertical baseline laser guide */}
        <line 
          x1={CX} y1={CY - 72} 
          x2={CX} y2={CY + 53} 
          stroke="rgba(6, 182, 212, 0.16)" 
          strokeWidth="2" 
        />
        
        {/* Top 0° Calibration Tick */}
        <line 
          x1={CX - 6} y1={CY - 72} 
          x2={CX + 6} y2={CY - 72} 
          stroke={C.teal} 
          strokeWidth="2" 
          opacity="0.6"
        />
        <circle cx={CX} cy={CY - 72} r="2.5" fill={C.teal} filter="url(#neonGlow)" />
        
        {/* Telemetry reference target rings */}
        <circle cx={CX} cy={CY + 53} r="3" fill="none" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r="65" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3 6" />

        {/* Upright calibration label */}
        <text 
          x={CX} y={CY - 80} 
          textAnchor="middle" 
          className="text-[9px] font-black fill-[rgba(6,182,212,0.6)] tracking-widest uppercase"
        >
          REF 0°
        </text>

        {/* ── 2. Flat road ground plane ── */}
        <line 
          x1={CX - 80} y1={CY + 53} 
          x2={CX + 80} y2={CY + 53} 
          stroke="rgba(255, 255, 255, 0.25)" 
          strokeWidth="3" 
          strokeLinecap="round" 
        />

        {/* ── 3. Dynamic Biomechanical Running Avatar (Apple Watch style, leans and bobs dynamically) ── */}
        <PostureRunner color={color} strideSec={strideSec} lean={lean * 0.65} bouncePx={bouncePx} active={active} />

        {/* ── SIMPLE LEAN ANGLE READOUT ── */}
        <g transform={`translate(${CX}, ${CY + 84})`}>
          <rect
            x="-62" y="-10" width="124" height="20" rx="8"
            fill="rgba(17, 24, 39, 0.95)"
            stroke={color} strokeWidth="1.5"
          />
          <text
            x="0" y="4.5"
            textAnchor="middle"
            fill={color}
            className="text-[12px] font-black tracking-widest font-mono"
          >
            {lean >= 0 ? "+" : ""}{lean.toFixed(1)}° LEAN
          </text>
        </g>

      </svg>
    </div>
  );
}
