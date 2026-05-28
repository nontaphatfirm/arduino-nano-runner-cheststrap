import { useCallback, useEffect, useRef, useState } from "react";

export function useSession() {
  const [elapsed,  setElapsed]  = useState(0);
  const [distance, setDistance] = useState(0);
  const [running,  setRunning]  = useState(false);
  const [history,     setHistory]     = useState([]);  // last 60 packets (for live averages)
  const [fullHistory, setFullHistory] = useState([]);  // all packets (for summary charts)
  const [goodCount, setGoodCount] = useState(0);
  const [badCount,  setBadCount]  = useState(0);

  const elapsedRef  = useRef(0);
  const historyRef  = useRef([]);
  const timerRef    = useRef(null);
  const lastPktTs   = useRef(null);

  const startSession = useCallback(() => {
    setRunning(true);
  }, []);

  const pauseSession = useCallback(() => {
    setRunning(false);
  }, []);

  const resetSession = useCallback(() => {
    clearInterval(timerRef.current);
    elapsedRef.current      = 0;
    historyRef.current      = [];
    fullHistoryRef.current  = [];
    lastPktTs.current       = null;
    setElapsed(0);
    setDistance(0);
    setHistory([]);
    setFullHistory([]);
    setGoodCount(0);
    setBadCount(0);
    setRunning(false);
  }, []);

  // elapsed clock
  useEffect(() => {
    if (!running) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running]);

  const fullHistoryRef = useRef([]);

  const recordPacket = useCallback((packet, formState) => {
    const entry = { ...packet, formState, ts: Date.now() };
    const next = [...historyRef.current, entry].slice(-60);
    historyRef.current = next;
    setHistory([...next]);
    fullHistoryRef.current = [...fullHistoryRef.current, entry];
    setFullHistory([...fullHistoryRef.current]);

    // distance: cadence (steps/min) ÷ 2 = strides/min × 1.35 m stride
    const now  = Date.now();
    const dt_s = lastPktTs.current ? Math.min((now - lastPktTs.current) / 1000, 2) : 0;
    lastPktTs.current = now;
    const speed_m_s = ((packet.c || 170) / 2 * 1.35) / 60;
    setDistance((d) => d + speed_m_s * dt_s / 1000);

    if (formState === "GOOD") setGoodCount((n) => n + 1);
    else setBadCount((n) => n + 1);
  }, []);

  const fmt = (s) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sc = String(s % 60).padStart(2, "0");
    return `${m}:${sc}`;
  };

  return {
    elapsed, elapsedFmt: fmt(elapsed),
    distance, running,
    history, fullHistory, goodCount, badCount,
    startSession, pauseSession, resetSession, recordPacket,
  };
}
