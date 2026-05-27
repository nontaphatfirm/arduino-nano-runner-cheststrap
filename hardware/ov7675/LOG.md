# OV7675 + Arduino Nano 33 BLE Rev1 — Field Notes

**Date:** 2026-05-26  
**Session:** WellSense AIoT Hackathon — Smart Pet Care subteam  
**Goal:** Live grayscale stream + on-demand colour capture over USB to MacBook

---

## Hardware Identification

| Item | Value |
|------|-------|
| Board | Arduino Nano 33 BLE **Rev1** |
| USB Vendor ID | `0x2341` (Arduino) |
| USB Product ID | `0x805A` → Rev1 confirmed (Rev2 would be `0x8087`) |
| bcdDevice | `0x0101` (firmware v1.01) |
| MCU | nRF52840 (Cortex-M4 @ 64 MHz) |
| RAM | 256 KB SRAM |
| Camera | OV7675 (from Arduino Tiny Machine Learning Kit) |
| Camera interface | Parallel DVP (8-bit data + PCLK/HREF/VSYNC) |
| Library | `Arduino_OV767X` |

---

## Library Compatibility Warning

```
WARNING: library Arduino_OV767X claims to run on mbed architecture(s)
and may be incompatible with your current board which runs on mbed_nano architecture(s).
```

**Safe to ignore.** The library declares `mbed` as its target but `mbed_nano` is a
compatible subset. The library functions correctly on Nano 33 BLE Rev1.

---

## Camera Interface — Why It's Slow

The nRF52840 **has no DCMI (Digital Camera Interface) peripheral**.  
The `Arduino_OV767X` library works around this by repurposing the **I2S peripheral**
to clock in parallel camera data. This is a software workaround — not native hardware
capture — and is the root cause of the low frame rate.

For comparison, STM32-based designs (like the NeuriCam paper prototype) use DMA-driven
DCMI and achieve 15 fps at QQVGA. The nRF52840 I2S approach cannot match this.

---

## Frame Rate — Findings

### Supported `fps` values (QQVGA RGB565)

| `fps` param | `Camera.begin()` result | Actual FPS observed |
|-------------|------------------------|---------------------|
| 30 | **FAIL** (GRAYSCALE) / untested (RGB565 w/ new sketch) | — |
| 15 | FAIL | — |
| 10 | FAIL | — |
| **5** | **SUCCESS** | **~2.5 FPS** |
| 1 | SUCCESS | ~0.6 FPS |

- `fps=1` makes `Camera.readFrame()` wait up to **~1 second** for VSYNC → 0.6 FPS actual.
- `fps=5` reduces VSYNC wait to ~200 ms. Combined with I2S capture time (~200 ms),
  actual frame time ≈ 400 ms → **2.5 FPS**.
- `fps=30` with `GRAYSCALE` format causes `Camera.begin()` to return `false` (LED blinks).
  RGB565 at fps=30 may work but was not confirmed in this session.
- Higher fps values (10, 15) were all rejected by the library for QQVGA RGB565.

### Bottleneck stack

```
Camera.readFrame() [I2S capture, ~200 ms]
  + VSYNC wait      [~200 ms at fps=5]
  + USB transfer    [38,400 bytes over USB CDC ≈ negligible]
  + Python display  [cv2 ops ≈ negligible]
─────────────────────────────────────────
≈ 400 ms/frame = 2.5 FPS  (hardware ceiling for this setup)
```

**USB is NOT the bottleneck.** Nano 33 BLE uses native USB (nRF52840 USB hardware),
so `Serial.begin(921600)` baud rate is irrelevant — data flows at USB Full Speed
(~1 MB/s). The `Camera.readFrame()` I2S capture is the actual limit.

---

## Pixel Format Decision

| Format | Bytes/frame (QQVGA) | `fps=5` works? | Notes |
|--------|--------------------|--------------:|-------|
| `GRAYSCALE` | 19,200 | No (Camera.begin fails above fps=1) | Fastest data, but fps=1 only |
| `RGB565` | 38,400 | **Yes** | Standard format; Python converts to grey for display |

**Decision:** Use `RGB565` for streaming even though we display in greyscale.
`RGB565` supports `fps=5` while `GRAYSCALE` is limited to `fps=1`.
Python converts: `RGB565 → BGR → GRAY → BGR` (display) using OpenCV.

---

## Colour / White Balance — Findings

### Raw OV7675 channel balance (estimated from captures)

| Channel | Raw mean (approx) | Characteristic |
|---------|------------------|----------------|
| Blue | ~52 | Very deficient — requires ~2× amplification |
| Green | ~141 | Dominant — Bayer RGGB has 2 green photosites |
| Red | ~106 | Moderate |

### Corrections tried

| Attempt | Method | Result |
|---------|--------|--------|
| None | Raw output | Heavy green cast (G >> R >> B) |
| Gray world (full, no cap) | Scale each channel to equal mean | **Best result** — B=104, G=106, R=106. Blue clips ~11% in bright highlights only |
| Gray world + 1.3× cap on B | Prevent blue clipping | Blue under-amplified → R > B >> G → **pink/magenta cast** |
| Gray world + 1.3× cap + G×0.88 | Additional Bayer correction | Made pink cast worse (G too low) |

### Final approach: simple gray world, no cap

```python
avg = (avg_b + avg_g + avg_r) / 3.0
img[:,:,0] *= avg / avg_b   # B ×~1.9 (clips ~11% of highlights)
img[:,:,1] *= avg / avg_g   # G ×~0.7
img[:,:,2] *= avg / avg_r   # R ×~0.9
```

**Post-correction channel means: B≈104, G≈106, R≈106** — near-neutral balance.  
The 11% blue highlight clipping is unavoidable given the sensor's extreme blue deficit.
It only affects blown-out highlights and is a known OV7675 hardware characteristic.

### Why the "green" remained in some images

After correct white balance, residual green in certain areas (bamboo curtains, plants)
is **real scene colour**, not a camera artefact. The OV7675's colour balance was correct;
the scene content was genuinely green-brown.

---

## Memory Layout (final sketch)

```
Flash  : 95,408 / 983,040 bytes  (9%)   — no concern
SRAM globals: ~46 KB / 256 KB   (18%)   — safe
Heap available: ~210 KB
  └─ stream malloc  38,400 B  (used per 'r' frame, freed immediately)
  └─ color malloc  153,600 B  (used per 'c' capture, freed immediately)
  └─ never both at once → ~56 KB headroom
```

**Key decision:** Both frame buffers are heap-allocated per-use and freed immediately.
Keeping them as static globals caused 32% static RAM usage and left only 23 KB
headroom after color capture malloc — dangerously tight.

---

## Protocol Design

**Pull-based (Python requests each frame)** — chosen over push-based streaming.

Push-based (Arduino streams continuously) was implemented first but abandoned because:
- `ser.reset_input_buffer()` on partial reads discarded the start of the next frame's data
- Subsequent `read(5)` landed mid-frame → frame sync permanently lost → vertical stripes
- Manifested as severe vertical stripe corruption after ~80+ frames

Pull-based guarantees byte alignment: Python sends `'r'` → Arduino sends exactly
`STREAM_BYTES` bytes → Python reads exactly `STREAM_BYTES` bytes. No sync possible drift.

| Command | Arduino sends | Bytes |
|---------|--------------|-------|
| `'r'` | QQVGA RGB565 frame | 38,400 |
| `'c'` | QVGA RGB565 frame | 153,600 |

Arduino always sends the full payload even on failure (zeros), so Python never
loses byte alignment regardless of camera errors.

---

## Upload Gotcha

`SAM-BA operation failed` during upload = **serial port still held open by Python viewer**.

Fix: press **Q** in viewer window first, then upload.  
If still failing: **double-press reset** → LED breathes → select new port → upload within 8 s.

---

## Known Limitations

| Limitation | Impact | Notes |
|-----------|--------|-------|
| No DCMI on nRF52840 | Hard FPS ceiling ~2.5 FPS | I2S workaround in library |
| fps=5 is highest accepted (RGB565 QQVGA) | Can't go above 2.5 FPS without library changes | fps=10/15/30 all rejected |
| Blue channel clips ~11% highlights | Cyan halos on very bright areas | Unavoidable given ~2× blue gain needed |
| OV7675 no hardware AWB | Manual gray world WB in Python | Correction applied post-capture |
| QVGA colour capture requires 153 KB malloc | Slow (~2-3 s for capture) | malloc + Camera.end/begin + readFrame |
| `while (!Serial)` blocks until USB opened | Board appears unresponsive until viewer starts | Normal behaviour for native USB |
