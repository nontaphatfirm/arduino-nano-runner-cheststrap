const C = { 
  teal: "#06B6D4", 
  muted: "#8BAEC8", 
  bg: "#030712", 
  card: "rgba(17, 25, 40, 0.65)", 
  good: "#10B981", 
  bad: "#EF4444" 
};

export function Settings({
  mode,
  setMode,
  bleStatus,
  bleLog = [],
  bleLogCount = 0,
  onBleConnect,
  onBleDisconnect,
  onBleSaveLog,
  onBleClearLog,
  onNavigate,
}) {
  
  const backIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  );

  const bluetoothIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 inline">
      <path d="m7 7 10 10-5 5V2l5 5L7 17"/>
    </svg>
  );

  const targetIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 inline">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );

  const databaseIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 inline">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
    </svg>
  );

  return (
    <main className="min-h-screen bg-[#030712] text-white p-6 max-pt-[max(24px,env(safe-area-inset-top))] max-pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-4.5 select-none">
      
      {/* Settings Screen Header */}
      <div className="flex items-center gap-3.5 mb-2">
        <button 
          onClick={() => onNavigate("dashboard")} 
          className="bg-transparent border-none text-[#06B6D4] hover:text-[#22D3EE] flex items-center justify-center p-1.5 rounded-lg hover:bg-[rgba(6,182,212,0.06)] cursor-pointer transition-all duration-150"
        >
          {backIcon}
        </button>
        <h1 className="margin-0 text-xl font-black uppercase tracking-tight">Settings</h1>
      </div>

      {/* Mode selection card */}
      <section className="glass-card rounded-2xl p-4.5">
        <div className="text-[10px] font-extrabold text-[rgba(255,255,255,0.4)] tracking-widest uppercase mb-3">
          Telemetry Data Source
        </div>
        <div className="flex gap-2">
          {["demo", "ble"].map((m) => (
            <button 
              key={m} 
              onClick={() => setMode(m)} 
              className={`flex-1 h-11 rounded-xl border-none cursor-pointer font-extrabold text-xs tracking-wider uppercase transition-all duration-200 ${
                mode === m 
                  ? "bg-[#06B6D4] text-[#030712] font-black shadow-[0_4px_12px_rgba(6,182,212,0.25)]" 
                  : "bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.45)] hover:text-white"
              }`}
            >
              {m === "demo" ? "Demo Mode" : "BLE Live Stream"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-semibold text-[rgba(255,255,255,0.45)] leading-relaxed">
          {mode === "demo"
            ? "Simulates physical exertion and muscle fatigue progression over a 5-minute window. Useful for system walkthroughs without active hardware connection."
            : "Establishes a low-energy wireless GATT connection with Arduino UNO Q for live telemetry computations."}
        </p>
      </section>

      {/* BLE live configuration card */}
      {mode === "ble" && (
        <section className="glass-card rounded-2xl p-4.5">
          <div className="text-[10px] font-extrabold text-[rgba(255,255,255,0.4)] tracking-widest uppercase mb-3.5">
            {bluetoothIcon} Bluetooth Device
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-black select-none">
                {bleStatus === "connected" && (
                  <span className="inline-flex items-center gap-1.5 text-[#10B981]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    CONNECTED
                  </span>
                )}
                {bleStatus === "stale" && (
                  <span className="inline-flex items-center gap-1.5 text-[#F59E0B]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-ping" />
                    SYNCING…
                  </span>
                )}
                {bleStatus === "disconnected" && (
                  <span className="inline-flex items-center gap-1.5 text-[#EF4444]">
                    ✕ DISCONNECTED
                  </span>
                )}
              </div>
              <div className="text-[10px] font-bold text-[rgba(255,255,255,0.4)] mt-1 tracking-wide uppercase">
                Arduino Nano 33 / UNO Q
              </div>
            </div>
            {bleStatus === "disconnected" ? (
              <button 
                onClick={onBleConnect} 
                className="h-8.5 px-4 rounded-xl border-none bg-[#06B6D4] text-[#030712] font-black text-xs cursor-pointer hover:bg-[#22D3EE] transition-all duration-150 select-none shadow-[0_4px_8px_rgba(6,182,212,0.2)]"
              >
                Connect
              </button>
            ) : (
              <button 
                onClick={onBleDisconnect} 
                className="h-8.5 px-4 rounded-xl bg-transparent text-[rgba(255,255,255,0.7)] border border-[rgba(255,255,255,0.12)] font-extrabold text-xs cursor-pointer hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.03)] transition-all duration-150 select-none"
              >
                Disconnect
              </button>
            )}
          </div>
          <div className="mt-3.5 p-3.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl text-[11px] font-semibold text-[rgba(255,255,255,0.45)] leading-relaxed">
            <strong className="text-white font-bold">Fallback Logic:</strong> In the event of a drop in signal strength, values freeze at last packet index. Auto-reconnection handles silent GATT reconnect sweeps every 5 seconds.
          </div>

          <div className="mt-3.5 border-t border-[rgba(255,255,255,0.06)] pt-3.5">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div>
                <div className="text-[10px] font-extrabold text-[rgba(255,255,255,0.4)] tracking-widest uppercase">
                  Live Bluetooth Log
                </div>
                <div className="text-[10px] font-bold text-[rgba(255,255,255,0.35)] mt-1">
                  {bleLogCount} saved lines · showing latest 20
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onBleSaveLog}
                  className="h-8 px-3 rounded-lg border-none bg-[#10B981] text-[#030712] font-black text-[10px] tracking-wider uppercase cursor-pointer hover:bg-[#34D399] transition-all duration-150 select-none"
                >
                  Save
                </button>
                <button
                  onClick={onBleClearLog}
                  className="h-8 px-3 rounded-lg bg-transparent text-[rgba(255,255,255,0.65)] border border-[rgba(255,255,255,0.12)] font-black text-[10px] tracking-wider uppercase cursor-pointer hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.03)] transition-all duration-150 select-none"
                >
                  Clear
                </button>
              </div>
            </div>
            <pre className="h-44 overflow-auto rounded-xl bg-[rgba(3,7,18,0.95)] border border-[rgba(255,255,255,0.05)] p-3 font-mono text-[9px] leading-relaxed text-[#8BAEC8] whitespace-pre-wrap break-words select-text">
              {bleLog.length ? bleLog.join("\n") : "Waiting for Bluetooth notifications..."}
            </pre>
          </div>
        </section>
      )}

      {/* BLE technical contract reference */}
      <section className="glass-card rounded-2xl p-4.5">
        <div className="text-[10px] font-extrabold text-[rgba(255,255,255,0.4)] tracking-widest uppercase mb-3">
          {databaseIcon} BLE Data Contract Specs
        </div>
        <div className="font-mono text-[10px] text-[rgba(255,255,255,0.5)] leading-relaxed select-text select-all">
          <div className="flex justify-between py-1 border-b border-[rgba(255,255,255,0.03)]">
            <span className="text-white font-bold">Service UUID</span>
            <span>19B10000-E8F2-537E-4F6C-D104768A1214</span>
          </div>
          <div className="flex justify-between py-1 border-b border-[rgba(255,255,255,0.03)]">
            <span className="text-white font-bold">Characteristic UUID</span>
            <span>19B10001-E8F2-537E-4F6C-D104768A1214</span>
          </div>
          <div className="mt-3">
            <span className="text-[#06B6D4] font-bold block mb-1">Raw Payload Mapping:</span>
            <div className="p-3.5 bg-[rgba(3,7,18,0.95)] border border-[rgba(255,255,255,0.05)] rounded-xl text-[#06B6D4] tracking-tight font-black leading-normal">
              {`{ "timestamp": 12345, "acc_x_g": 0.123, "acc_y_g": 0.456, "acc_z_g": 0.789, "gyro_x_dps": 1.234, "gyro_y_dps": 2.345, "gyro_z_dps": 3.456 }`}
            </div>
          </div>
          <div className="mt-2.5 text-[9px] font-semibold text-[rgba(255,255,255,0.35)] leading-normal uppercase">
            Raw Nano IMU frames are converted into live form metrics in the browser.
          </div>
        </div>
      </section>

      {/* Recalibration target trigger */}
      <button 
        onClick={() => onNavigate("calibration")} 
        className="w-full h-11 rounded-xl border border-[rgba(255,255,255,0.12)] bg-transparent text-[rgba(255,255,255,0.85)] font-extrabold text-xs tracking-wider uppercase flex items-center justify-center cursor-pointer hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.03)] transition-all duration-150 active:scale-[0.99] select-none"
      >
        {targetIcon} Recalibrate Sensor Baseline
      </button>
    </main>
  );
}
