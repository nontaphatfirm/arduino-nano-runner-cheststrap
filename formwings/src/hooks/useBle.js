import { useCallback, useEffect, useRef, useState } from "react";
import { SERVICE_UUID, CHAR_UUID, DEVICE_NAME, parseRaw, parsePrediction } from "../lib/bleContract";
import { ImuProcessor } from "../lib/imuProcessor";

const STALE_MS     = 12000; // no complete prediction for 12 s → stale (firmware may skip BLE windows)
const RECONNECT_MS = 5000;  // retry interval after disconnect
const RECENT_LOG_LINES = 20;
const MAX_LOG_LINES = 50000;
const MAX_BUFFER_CHARS = 12000;
const PREDICTION_START = '{"type":"running_form_prediction"';
const WINDOW_QUIET_MS = 350;
const PARTIAL_REPAIR_QUIET_MS = 220;

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

function findCompleteJsonEnd(text) {
  let depth = 0;
  let inString = false;
  let escape = false;
  let started = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
      started = true;
    } else if (ch === "}") {
      depth -= 1;
      if (started && depth === 0) return i;
      if (depth < 0) return -1;
    }
  }

  return -1;
}

function tryRepairPartialJson(text) {
  if (!text.startsWith("{") || !text.includes('"class"')) return null;

  const candidates = [`${text}}`];
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
    } else if (ch === "," && depth === 1) {
      candidates.push(`${text.slice(0, i)}}`);
    }
  }

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    try {
      JSON.parse(candidates[i]);
      return candidates[i];
    } catch {
      // Try the next earlier top-level field boundary.
    }
  }

  return null;
}

function isPredictionHeaderOnly(text) {
  try {
    const p = JSON.parse(text);
    return p.type === "running_form_prediction" && !p.features && p.class == null;
  } catch {
    return false;
  }
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
  const lastPartial = useRef("");
  const pendingPrediction = useRef(null);
  const pendingTimer = useRef(null);
  const partialRepairTimer = useRef(null);

  // ── helpers ───────────────────────────────────────────────────────────────

  const clearTimers = () => {
    clearTimeout(staleTimer.current);
    clearTimeout(reconnTimer.current);
    clearTimeout(pendingTimer.current);
    clearTimeout(partialRepairTimer.current);
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
    const prediction = parsePrediction(json);
    if (prediction) {
      appendLogLine(json);
      const windowId = prediction.windowId;
      if (windowId == null) {
        setLatest(prediction);
        return;
      }

      pendingPrediction.current = prediction;
      clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(() => {
        if (pendingPrediction.current) setLatest(pendingPrediction.current);
        pendingPrediction.current = null;
      }, WINDOW_QUIET_MS);
      return;
    }
    const raw = parseRaw(json);
    if (raw) {
      appendLogLine(json);
      setLatest(processor.current.process(raw));
    }
  }, [appendLogLine]);

  const schedulePartialRepair = useCallback((text) => {
    clearTimeout(partialRepairTimer.current);
    partialRepairTimer.current = setTimeout(() => {
      const nextPrediction = text.indexOf(PREDICTION_START, 1);
      const repairSource = nextPrediction > 0 ? text.slice(0, nextPrediction) : text;
      const repaired = tryRepairPartialJson(repairSource);
      if (repaired && repaired !== lastPartial.current) {
        lastPartial.current = repaired;
        dispatchJson(repaired);
      }

      if (nextPrediction > 0) {
        bleBuffer.current = text.slice(nextPrediction);
        lastPartial.current = "";
      }
    }, PARTIAL_REPAIR_QUIET_MS);
  }, [dispatchJson]);

  const consumeBufferedJson = useCallback(() => {
    let buf = bleBuffer.current;
    const start = buf.indexOf("{");
    if (start === -1) {
      if (buf.length > MAX_BUFFER_CHARS) bleBuffer.current = "";
      return;
    }

    if (start > 0) {
      buf = buf.slice(start);
      bleBuffer.current = buf;
    }

    const completeEnd = findCompleteJsonEnd(buf);
    if (completeEnd >= 0) {
      const candidate = buf.slice(0, completeEnd + 1);
      try {
        JSON.parse(candidate);
        if (isPredictionHeaderOnly(candidate)) {
          bleBuffer.current = candidate.slice(0, -1) + buf.slice(completeEnd + 1);
          schedulePartialRepair(bleBuffer.current);
          return;
        }
        bleBuffer.current = buf.slice(completeEnd + 1);
        lastPartial.current = "";
        clearTimeout(partialRepairTimer.current);
        dispatchJson(candidate);
        return;
      } catch {
        // Keep buffering; a later notification may make the stream recoverable.
      }
    }

    const nextPrediction = buf.indexOf(PREDICTION_START, 1);
    if (nextPrediction > 0) {
      schedulePartialRepair(buf.slice(0, nextPrediction));
      bleBuffer.current = buf.slice(nextPrediction);
      lastPartial.current = "";
    } else if (buf.length > MAX_BUFFER_CHARS) {
      const keepFrom = Math.max(0, buf.lastIndexOf(PREDICTION_START));
      bleBuffer.current = keepFrom > 0 ? buf.slice(keepFrom) : "";
      lastPartial.current = "";
      clearTimeout(partialRepairTimer.current);
    } else {
      schedulePartialRepair(buf);
    }
  }, [dispatchJson, schedulePartialRepair]);

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
        consumeBufferedJson();
      }
    });
    await char.startNotifications();
  }, [armStaleTimer, consumeBufferedJson, dispatchJson]);

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
    lastPartial.current = "";
    pendingPrediction.current = null;
    clearTimeout(pendingTimer.current);
    clearTimeout(partialRepairTimer.current);
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
