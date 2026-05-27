/*
 * OV7675 Viewer — Arduino Nano 33 BLE (pull-based protocol)
 *
 * Both stream and color buffers are heap-allocated only during use,
 * keeping static RAM low (~46 KB globals, leaving ~216 KB for heap).
 *
 *   'r' → QQVGA RGB565 frame  (38,400 bytes)  — Python displays as grayscale
 *   'c' → QVGA  RGB565 frame  (153,600 bytes) — Python displays as color + saves
 *
 * Board  : Arduino Nano 33 BLE
 * Library: Arduino_OV767X (Library Manager)
 */

#include <Arduino_OV767X.h>

const int STREAM_W = 160, STREAM_H = 120;
const int COLOR_W  = 320, COLOR_H  = 240;

const uint32_t STREAM_BYTES = (uint32_t)STREAM_W * STREAM_H * 2;  // 38,400 B
const uint32_t COLOR_BYTES  = (uint32_t)COLOR_W  * COLOR_H  * 2;  // 153,600 B

// Try fps from highest to lowest — stops at first success
bool initCamera(int res, int fmt) {
  int candidates[] = {30, 15, 10, 5, 1};
  for (int fps : candidates) {
    if (Camera.begin(res, fmt, fps)) return true;
  }
  return false;
}

// Send N zero bytes — keeps Python byte-aligned when malloc fails
void sendZeros(uint32_t n) {
  const uint8_t z = 0;
  for (uint32_t i = 0; i < n; i++) Serial.write(z);
  Serial.flush();
}

// --- Stream one grayscale frame (heap-allocated, freed immediately) ---
void sendStream() {
  byte* buf = (byte*)malloc(STREAM_BYTES);
  if (!buf) { sendZeros(STREAM_BYTES); return; }
  Camera.readFrame(buf);
  Serial.write(buf, STREAM_BYTES);
  free(buf);
}

// --- Capture one color frame ---
void captureColor() {
  byte* buf = (byte*)malloc(COLOR_BYTES);
  if (!buf) { sendZeros(COLOR_BYTES); return; }

  Camera.end();
  delay(100);

  if (Camera.begin(QVGA, RGB565, 1)) {
    Camera.readFrame(buf);
  } else {
    memset(buf, 0, COLOR_BYTES);
  }

  Serial.write(buf, COLOR_BYTES);
  Serial.flush();

  free(buf);
  Camera.end();
  delay(100);
  initCamera(QQVGA, RGB565);
}

// --- Setup ---
void setup() {
  Serial.begin(921600);
  while (!Serial);

  if (!initCamera(QQVGA, RGB565)) {
    pinMode(LED_BUILTIN, OUTPUT);
    while (true) {
      digitalWrite(LED_BUILTIN, HIGH); delay(200);
      digitalWrite(LED_BUILTIN, LOW);  delay(200);
    }
  }

  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
}

// --- Loop ---
void loop() {
  if (!Serial.available()) return;

  switch ((char)Serial.read()) {
    case 'r': sendStream();    break;
    case 'c':
    case 'C': captureColor();  break;
  }
}
