import { useState } from "react";
import { Dashboard }   from "./screens/Dashboard";
import { Summary }     from "./screens/Summary";
import { Settings }    from "./screens/Settings";
import { Calibration } from "./screens/Calibration";
import { useBle }      from "./hooks/useBle";
import { useSession }  from "./hooks/useSession";

function loadMode() {
  try { return localStorage.getItem("fs_mode") || "demo"; } catch { return "demo"; }
}

export default function App() {
  const [screen, setScreen] = useState("calibration");
  const [mode,   setModeState] = useState(loadMode);

  const ble     = useBle();
  const session = useSession();

  function setMode(m) {
    setModeState(m);
    try { localStorage.setItem("fs_mode", m); } catch {}
  }

  function navigate(to) {
    if (to === "summary")   session.pauseSession();
    if (to === "dashboard") session.resetSession();
    setScreen(to);
  }

  if (screen === "calibration") {
    return (
      <Calibration
        mode={mode}
        onDone={() => setScreen("dashboard")}
      />
    );
  }

  if (screen === "dashboard") {
    return (
      <Dashboard
        mode={mode}
        setMode={setMode}
        bleLatest={ble.latest}
        bleStatus={ble.status}
        onNavigate={navigate}
        session={session}
      />
    );
  }

  if (screen === "summary") {
    return (
      <Summary
        history={session.history}
        fullHistory={session.fullHistory}
        goodCount={session.goodCount}
        badCount={session.badCount}
        elapsedFmt={session.elapsedFmt}
        distance={session.distance}
        onNavigate={navigate}
      />
    );
  }

  if (screen === "settings") {
    return (
      <Settings
        mode={mode}
        setMode={setMode}
        bleStatus={ble.status}
        bleLog={ble.recentLog}
        bleLogCount={ble.logCount}
        onBleConnect={ble.connect}
        onBleDisconnect={ble.disconnect}
        onBleSaveLog={ble.saveLog}
        onBleClearLog={ble.clearLog}
        onNavigate={navigate}
      />
    );
  }

  return null;
}
