#!/usr/bin/env python3
"""
OV7675 Live Viewer — pull-based, threaded
  Grayscale stream: QQVGA 160×120  (press R to request manually, auto-loops)
  Color capture   : QVGA  320×240  press C in viewer window → saves PNG
  Quit            : press Q in viewer window

Usage:
    python viewer.py [--port /dev/cu.usbmodemXXXX] [--scale 3]
"""

import sys
import argparse
import threading
import queue
import time
from datetime import datetime
from pathlib import Path

import serial
import serial.tools.list_ports
import numpy as np
import cv2

# ── Resolution constants ──────────────────────────────────────────────────────
GRAY_W, GRAY_H   = 160, 120
COLOR_W, COLOR_H = 320, 240
STREAM_BYTES = GRAY_W  * GRAY_H  * 2    # 38,400  — QQVGA RGB565 (wire format)
COLOR_BYTES  = COLOR_W * COLOR_H * 2    # 153,600 — QVGA  RGB565
BAUD        = 921600
SAVE_DIR    = Path(__file__).parent / "captures"


# ── Port detection ────────────────────────────────────────────────────────────
def find_arduino_port():
    for p in serial.tools.list_ports.comports():
        if any(k in (p.description or "").lower()
               for k in ("arduino", "usbmodem", "usbserial", "nano")):
            return p.device
    ports = serial.tools.list_ports.comports()
    return ports[0].device if ports else None


# ── Pixel decoders ────────────────────────────────────────────────────────────
def rgb565_to_bgr(raw: bytes, w: int, h: int) -> np.ndarray:
    buf = np.frombuffer(raw, dtype=np.uint16).byteswap().reshape(h, w)
    r = ((buf >> 11) & 0x1F).astype(np.uint8) * 8
    g = ((buf >>  5) & 0x3F).astype(np.uint8) * 4
    b = ((buf       ) & 0x1F).astype(np.uint8) * 8
    return np.stack([b, g, r], axis=-1)


def decode_stream(raw: bytes) -> np.ndarray:
    """QQVGA RGB565 wire frame → grayscale BGR for display."""
    bgr = rgb565_to_bgr(raw, GRAY_W, GRAY_H)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def color_correct(img: np.ndarray) -> np.ndarray:
    """
    Gray world white balance for OV7675.
    Scales each channel so their means are equal — corrects the camera's
    strong green bias. Blue will clip ~11% in very bright highlights (unavoidable:
    OV7675 raw is extremely blue-deficient, requiring ~2× amplification).
    The 11% clipping only affects blown-out highlights; overall colour balance
    is accurate (B≈G≈R≈105 after correction).
    """
    f = img.astype(np.float32)
    avg_b = np.mean(f[:,:,0])
    avg_g = np.mean(f[:,:,1])
    avg_r = np.mean(f[:,:,2])
    avg   = (avg_b + avg_g + avg_r) / 3.0
    f[:,:,0] = np.clip(f[:,:,0] * avg / (avg_b + 1e-6), 0, 255)
    f[:,:,1] = np.clip(f[:,:,1] * avg / (avg_g + 1e-6), 0, 255)
    f[:,:,2] = np.clip(f[:,:,2] * avg / (avg_r + 1e-6), 0, 255)
    return f.astype(np.uint8)


def decode_color(raw: bytes) -> np.ndarray:
    """QVGA RGB565 → colour-corrected BGR."""
    return color_correct(rgb565_to_bgr(raw, COLOR_W, COLOR_H))


# ── Reader thread ─────────────────────────────────────────────────────────────
# Sends 'r' to request a grayscale frame, or 'c' for color.
# Arduino always replies with exactly the expected number of bytes.
def reader_thread(ser, frame_q, capture_event, quit_event):
    while not quit_event.is_set():
        try:
            if capture_event.is_set():
                capture_event.clear()
                ser.write(b'c')
                ser.flush()
                data = ser.read(COLOR_BYTES)
                if len(data) == COLOR_BYTES:
                    frame_q.put(('C', data))  # blocks until display consumes it
            else:
                ser.write(b'r')
                ser.flush()
                data = ser.read(STREAM_BYTES)
                if len(data) == STREAM_BYTES:
                    try:
                        frame_q.put_nowait(('G', data))
                    except queue.Full:
                        pass  # display thread is behind — drop frame, keep going
        except Exception:
            if not quit_event.is_set():
                time.sleep(0.05)


# ── Main display loop ─────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port",  default=None, help="Serial port (auto-detect)")
    parser.add_argument("--scale", default=3,    type=int, help="Zoom factor (default 3)")
    args = parser.parse_args()

    port = args.port or find_arduino_port()
    if not port:
        print("ERROR: No serial port found. Connect Nano 33 BLE and retry.")
        print("       Or specify:  python viewer.py --port /dev/cu.usbmodemXXXX")
        sys.exit(1)

    print(f"Connecting to {port} at {BAUD} baud...")
    try:
        ser = serial.Serial(port, BAUD, timeout=5)
    except serial.SerialException as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    SAVE_DIR.mkdir(exist_ok=True)
    print("Connected.")
    print("  C = color capture    Q = quit")
    print(f"  Saves to: {SAVE_DIR}/")

    frame_q      = queue.Queue(maxsize=2)
    capture_evt  = threading.Event()
    quit_evt     = threading.Event()

    t = threading.Thread(target=reader_thread,
                         args=(ser, frame_q, capture_evt, quit_evt),
                         daemon=True)
    t.start()

    # Window size preserves exact 4:3 (160×120 × scale)
    WIN_W = GRAY_W * args.scale   # 480 at scale=3
    WIN_H = GRAY_H * args.scale   # 360 at scale=3

    # Pre-create window immediately so it's visible before first frame
    cv2.namedWindow("OV7675 Live", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("OV7675 Live", WIN_W, WIN_H)
    waiting = np.zeros((WIN_H, WIN_W, 3), dtype=np.uint8)
    cv2.putText(waiting, "Waiting for camera...",
                (WIN_W // 2 - 120, WIN_H // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (180, 180, 180), 1, cv2.LINE_AA)
    cv2.putText(waiting, "Make sure sketch is uploaded to Nano 33 BLE",
                (WIN_W // 2 - 175, WIN_H // 2 + 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (120, 120, 120), 1, cv2.LINE_AA)
    cv2.imshow("OV7675 Live", waiting)
    cv2.waitKey(1)

    frame_count  = 0
    fps          = 0.0
    fps_frames   = 0
    fps_t0       = time.time()
    capturing    = False

    while True:
        key = cv2.waitKey(10) & 0xFF  # 10 ms poll — never blocks

        if key == ord('q'):
            quit_evt.set()
            break

        if key == ord('c') and not capturing:
            capturing = True
            capture_evt.set()
            print("Requesting color capture…")

        try:
            frame_type, data = frame_q.get(timeout=0.5)
        except queue.Empty:
            continue

        # ── Grayscale frame ──
        if frame_type == 'G':
            capturing = False
            frame_count += 1
            fps_frames  += 1
            now = time.time()
            if now - fps_t0 >= 0.5:
                fps       = fps_frames / (now - fps_t0)
                fps_frames = 0
                fps_t0    = now

            img     = decode_stream(data)
            display = cv2.resize(img, (WIN_W, WIN_H), interpolation=cv2.INTER_LINEAR)

            # FPS + frame counter (top bar)
            cv2.putText(display,
                        f"GRAY  {GRAY_W}x{GRAY_H}   FPS: {fps:4.1f}   frame #{frame_count}",
                        (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1,
                        cv2.LINE_AA)
            # Controls hint (bottom bar)
            cv2.putText(display, "C = color capture     Q = quit",
                        (8, WIN_H - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (160, 160, 160), 1,
                        cv2.LINE_AA)
            cv2.imshow("OV7675 Live", display)

        # ── Color capture frame ──
        elif frame_type == 'C':
            capturing = False
            img   = decode_color(data)
            fname = SAVE_DIR / f"capture_{datetime.now().strftime('%H%M%S')}.png"
            cv2.imwrite(str(fname), img)
            print(f"Saved: {fname}")

            # Show in second window (stays until next capture)
            preview = cv2.resize(img, (COLOR_W * 2, COLOR_H * 2),
                                 interpolation=cv2.INTER_LINEAR)
            cv2.putText(preview, str(fname.name),
                        (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 80), 2,
                        cv2.LINE_AA)
            cv2.imshow("Color Capture", preview)

    ser.close()
    cv2.destroyAllWindows()
    print("Done.")


if __name__ == "__main__":
    main()
