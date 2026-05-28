import { useEffect, useState } from "react";

const C = { 
  teal: "#06B6D4", 
  muted: "#8BAEC8", 
  bg: "#030712", 
  good: "#10B981" 
};

export function Calibration({ mode, onDone }) {
  const [step,    setStep]    = useState(0);  // 0=instruct, 1=counting, 2=done
  const [counter, setCounter] = useState(3);

  useEffect(() => {
    if (step !== 1) return;
    if (mode === "demo") { setTimeout(() => setStep(2), 400); return; }
    const t = setInterval(() => {
      setCounter((n) => {
        if (n <= 1) { clearInterval(t); setStep(2); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step, mode]);

  return (
    <main className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-6 text-center gap-8 relative overflow-hidden select-none">
      
      {/* Sci-fi background grid accent */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-[rgba(6,182,212,0.04)] blur-3xl pointer-events-none" />

      {step === 0 && (
        <div className="flex flex-col items-center gap-7 max-w-[320px] z-10">
          {/* Standing Biomechanical Figure HUD */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-dashed border-[rgba(6,182,212,0.25)] animate-[spin_16s_linear_infinite]" />
            <div className="absolute inset-2 rounded-full border border-solid border-[rgba(6,182,212,0.08)]" />
            <svg width="44" height="44" viewBox="0 0 64 64" fill="none" stroke={C.teal} strokeWidth="3" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
              <circle cx="32" cy="12" r="4.5" strokeWidth="3.5" />
              <line x1="32" y1="16.5" x2="32" y2="40" strokeWidth="3.5" />
              <line x1="32" y1="22" x2="22" y2="30" strokeWidth="2.8" />
              <line x1="32" y1="22" x2="42" y2="30" strokeWidth="2.8" />
              <line x1="32" y1="40" x2="25" y2="58" strokeWidth="3.2" />
              <line x1="32" y1="40" x2="39" y2="58" strokeWidth="3.2" />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-2 uppercase">
              Calibrate Sensor
            </h1>
            <p className="text-sm font-semibold leading-relaxed text-[rgba(255,255,255,0.5)]">
              Attach the sensor to your waistband.<br />
              Stand still with feet shoulder-width apart.<br />
              Tap <strong className="text-white">Start</strong> when ready.
            </p>
          </div>

          <button 
            onClick={() => setStep(1)} 
            className="w-full min-h-[48px] rounded-2xl border-none cursor-pointer bg-[#06B6D4] text-[#030712] font-black text-sm tracking-wider uppercase hover:bg-[#22D3EE] transition-all duration-200 shadow-[0_4px_16px_rgba(6,182,212,0.35)] active:scale-[0.98]"
          >
            Start calibration
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col items-center gap-5 z-10">
          {/* Animated Countdown Progress Arc */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-[rgba(6,182,212,0.15)]" />
            <svg width="112" height="112" viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle 
                cx="50" cy="50" r="44" 
                fill="none" stroke={C.teal} strokeWidth="4" 
                strokeDasharray="276" strokeDashoffset={276 - (counter / 3) * 276}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="text-5xl font-black font-mono text-[#06B6D4] drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
              {counter}
            </div>
          </div>
          <p className="text-sm font-extrabold tracking-widest text-[rgba(255,255,255,0.4)] uppercase animate-pulse">
            Baseline calibration: Hold still…
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center gap-7 max-w-[320px] z-10">
          {/* Vector check mark illustration */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-[rgba(16,185,129,0.15)]" />
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" stroke={C.good} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]">
              <path d="M14 32 L26 44 L50 20" />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-2 uppercase">
              Calibrated!
            </h1>
            <p className="text-sm font-semibold leading-relaxed text-[rgba(255,255,255,0.5)]">
              IMU baseline successfully captured.<br />Ready for real-time form analytics.
            </p>
          </div>

          <button 
            onClick={onDone} 
            className="w-full min-h-[48px] rounded-2xl border-none cursor-pointer bg-[#10B981] text-[#030712] font-black text-sm tracking-wider uppercase hover:bg-[#34D399] transition-all duration-200 shadow-[0_4px_16px_rgba(16,185,129,0.35)] active:scale-[0.98]"
          >
            Start running →
          </button>
        </div>
      )}
    </main>
  );
}
