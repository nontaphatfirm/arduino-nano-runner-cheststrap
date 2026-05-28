import { useCallback, useEffect, useRef, useState } from "react";
import { SERVICE_UUID, CHAR_UUID, DEVICE_NAME, parseRaw, parsePrediction } from "../lib/bleContract";
import { ImuProcessor } from "../lib/imuProcessor";

const STALE_MS     = 5000;  // no data for 5 s → stale (packets arrive ~2 s apart in chunks)
const RECONNECT_MS = 5000;  // retry interval after disconnect
const RECENT_LOG_LINES = 20;
const MAX_LOG_LINES = 50000;

function getBluetoothSupportMessage() {
  if (!window.isSecureContext) {
    return [
      "Web Bluetooth is blocked because this page is not a secure context.",
      `Current page: ${window.location.origin}`,
      "Open the dashboard over HTTPS, or use localhost on the same device.",
    ].join("\n");
  }

  if (!navigator.bluetooth) {
    return "Web Bluetooth is not supported in this browser.\nUse Chrome on Android or Chrome/Edge on desktop.";
  }

  return null;
}

export function useBle() {
  const [status, setStatus] = useState("disconnected"); // "connected"|"stale"|"disconnected"
  const [device, setDevice] = useState(null);
  const [latest, setLatest] = useState(null);
  const [recentLog, setRecentLog] = useState([]);
  const [logCount, setLogCount] = useState(0);

  const deviceRef   = useRef(null);
  const charRef     = useRef(null);
  const staleTimer  = useRef(null);
  const reconnTimer = useRef(null);
  const processor   = useRef(new ImuProcessor());
  const logRef      = useRef([]);
  const bleBuffer   = useRef("");        // fallback: raw byte accumulator
  const bleFrames   = useRef(new Map()); // framing protocol: msgId → {chunks, totalChunks}

  // ── helpers ───────────────────────────────────────────────────────────────

  const clearTimers = () => {
    clearTimeout(staleTimer.current);
    clearTimeout(reconnTimer.current);
  };

  const armStaleTimer = useCallback(() => {
    clearTimeout(staleTimer.current);
    staleTimer.current = setTimeout(() => setStatus("stale"), STALE_MS);
  }, []);

  const appendLogLine = useCallback((text) => {
    const receivedAt = new Date().toISOString();
    const line = `${receivedAt} ${text}`;

    logRef.current = [...logRef.current, line].slice(-MAX_LOG_LINES);
    setLogCount(logRef.current.length);
    setRecentLog(logRef.current.slice(-RECENT_LOG_LINES));
  }, []);

  const dispatchJson = useCallback((json) => {
    appendLogLine(json);
    const prediction = parsePrediction(json);
    if (prediction) { setLatest(prediction); return; }
    const raw = parseRaw(json);
    if (raw) setLatest(processor.current.process(raw));
  }, [appendLogLine]);

  const subscribeChar = useCallback(async (char) => {
    bleBuffer.current = "";
    bleFrames.current.clear();

    char.addEventListener("characteristicvaluechanged", (e) => {
      const pkt = new TextDecoder().decode(e.target.value);

      setStatus("connected");
      armStaleTimer();

      const type = pkt[0];

      if (type === "^") {
        // START: ^[msgid4][totalChunks_hex2][hash8]
        const msgId       = pkt.slice(1, 5);
        const totalChunks = parseInt(pkt.slice(5, 7), 16);
        bleFrames.current.set(msgId, { chunks: new Array(totalChunks).fill(""), totalChunks });

      } else if (type === ":") {
        // DATA: :[msgid4][seq_hex2][payload13]
        const msgId   = pkt.slice(1, 5);
        const seq     = parseInt(pkt.slice(5, 7), 16);
        const payload = pkt.slice(7);
        const frame   = bleFrames.current.get(msgId);
        if (frame && seq < frame.totalChunks) {
          frame.chunks[seq] = payload;
        }

      } else if (type === "!") {
        // END: ![msgid4][totalChunks_hex2] — reassemble and dispatch
        const msgId = pkt.slice(1, 5);
        const frame = bleFrames.current.get(msgId);
        if (!frame) return;
        bleFrames.current.delete(msgId);
        const json = frame.chunks.join("");
        if (json) dispatchJson(json);

      } else {
        // Fallback for unframed streams (legacy / unknown format)
        bleBuffer.current += pkt;
        if (bleBuffer.current.length > 8000) { bleBuffer.current = ""; return; }
        const buf   = bleBuffer.current;
        const start = buf.indexOf("{");
        const end   = buf.lastIndexOf("}");
        if (start === -1 || end <= start) return;
        const candidate = buf.slice(start, end + 1);
        try { JSON.parse(candidate); } catch { return; }
        bleBuffer.current = buf.slice(end + 1);
        dispatchJson(candidate);
      }
    });
    await char.startNotifications();
  }, [appendLogLine, armStaleTimer, dispatchJson]);

  const tryReconnect = useCallback(async () => {
    clearTimeout(reconnTimer.current);
    reconnTimer.current = setTimeout(async () => {
      const dev = deviceRef.current;
      if (!dev) return;
      try {
        processor.current.reset();
        const server  = await dev.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        const char    = await service.getCharacteristic(CHAR_UUID);
        charRef.current = char;
        await subscribeChar(char);
        setStatus("connected");
        armStaleTimer();
      } catch {
        tryReconnect();  // keep retrying silently
      }
    }, RECONNECT_MS);
  }, [subscribeChar, armStaleTimer]);

  // ── public API ────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    const supportMessage = getBluetoothSupportMessage();
    if (supportMessage) {
      alert(supportMessage);
      return;
    }
    try {
      // Filter by device name; declare service so we can access it after pairing
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ name: DEVICE_NAME }],
        optionalServices: [SERVICE_UUID],
      });
      deviceRef.current = dev;
      setDevice(dev);
      processor.current.reset();

      dev.addEventListener("gattserverdisconnected", () => {
        setStatus("disconnected");
        tryReconnect();
      });

      const server  = await dev.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const char    = await service.getCharacteristic(CHAR_UUID);
      charRef.current = char;
      await subscribeChar(char);
      setStatus("connected");
      armStaleTimer();
    } catch (err) {
      if (err.name !== "NotFoundError") {
        console.error("BLE connect error:", err);
      }
    }
  }, [subscribeChar, armStaleTimer, tryReconnect]);

  const disconnect = useCallback(() => {
    clearTimers();
    processor.current.reset();
    bleBuffer.current = "";
    bleFrames.current.clear();
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    deviceRef.current = null;
    charRef.current   = null;
    setDevice(null);
    setStatus("disconnected");
    setLatest(null);
  }, []);

  const clearLog = useCallback(() => {
    logRef.current = [];
    setRecentLog([]);
    setLogCount(0);
  }, []);

  const saveLog = useCallback(() => {
    if (!logRef.current.length) {
      alert("No Bluetooth log lines to save yet.");
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = new Blob([`${logRef.current.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `formwings-ble-log-${stamp}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => () => clearTimers(), []);

  return { status, device, latest, recentLog, logCount, connect, disconnect, saveLog, clearLog };
}
