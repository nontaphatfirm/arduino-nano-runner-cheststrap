# Arduino Nano Runner Cheststrap — Hardware Guide for Beginners

> You are new to hardware. This guide explains everything you need to build the runner cheststrap sensor system, step by step — from "what is a Qwiic cable" to "how do I read the IMU."

---

## What You're Building

A wearable sensor system worn on the chest or torso of a runner:

| Thing to measure | Sensor | What it tells you |
|-----------------|--------|-------------------|
| Acceleration (XYZ) | LSM9DS1 IMU (built into Nano 33 BLE Sense) | Impact force, vertical bounce, trunk lean |
| Rotation (XYZ) | LSM9DS1 gyroscope | Roll, pitch, yaw |
| Magnetic heading | LSM9DS1 magnetometer | Absolute orientation reference |
| Sound / step rhythm | OJFF14 analog sound sensor → A7 | Ambient noise, step cadence via vibration |
| Live dashboard | Web Serial dashboard (browser) | Real-time charts + 3D position estimate |

Additional hardware available (on Arduino UNO Q via Qwiic):

| Module | Function |
|--------|----------|
| Modulino DISTANCE | Range measurement (ToF laser, 0–120 cm) |
| Modulino THERMO | Temperature + humidity |
| Modulino MOVEMENT | 6-axis IMU (secondary motion board) |
| Modulino PIXELS | 8× RGB LED status indicator |
| Modulino BUZZER | Audio feedback |
| Modulino KNOB | Rotary input |
| Modulino BUTTONS | 3× tactile buttons |

---

## The Main Board: Arduino Nano 33 BLE Sense Rev1

This is the board that goes on the runner. It:
- Reads all the built-in sensors (IMU, mic, etc.)
- Reads the OJFF14 sound sensor via analog pin A7
- Sends data over USB Serial at 115200 baud, 20 Hz
- Works with the Web Serial dashboard in Chrome / Edge

You **program** it by writing code in Arduino IDE on your laptop, then uploading via Micro USB cable.

```
Your Laptop ──[Micro USB]──→ Arduino Nano 33 BLE Sense ──[Serial]──→ dashboard.html
```

**Rev1 vs Rev2:** This project targets **Rev1** (original). The USB descriptor confirms it:
```
idProduct : 0x805A
bcdDevice : 0x0101 (Rev1)
```
Rev2 has a different IMU chip — set `SENSOR_BOARD_REV 2` in the sketch if using Rev2.

**I/O voltage:** 3.3V only. The analog pins are **not 5V tolerant**.

---

## The Hub: Arduino UNO Q

The UNO Q is a **small computer** (runs Debian Linux on a Qualcomm processor + an Arduino MCU). You program the Arduino MCU side from Arduino IDE via USB-C.

The Modulino modules connect to the UNO Q via Qwiic cables.

```
Your Laptop ──[USB-C]──→ Arduino UNO Q ──[Qwiic cables]──→ Modulino modules
                                        ──[WiFi]──────────→ browser dashboard
```

---

## The Connectors: Qwiic (Pronounced "Quick")

Qwiic is a connector standard that makes it impossible to plug in wrong:
- **Polarized** — only fits one way
- **4 wires in one cable:** power (3.3V), ground, I2C clock, I2C data
- **Daisy-chainable:** plug one module's output into the next

Cable colors:

| Color | Signal |
|-------|--------|
| Red | 3.3V |
| Black | GND |
| Yellow | SCL (clock) |
| Blue | SDA (data) |

**Critical:** All Qwiic devices run at **3.3V only**. Never connect a 5V device to a Qwiic port.

---

## I2C Addresses — The Most Confusing Part

Each Modulino module has **two** different I2C addresses:

| Module | Modulino Library Addr | Hardware Scan Addr |
|--------|----------------------|-------------------|
| DISTANCE | **0x29** | 0x29 |
| THERMO | **0x44** | 0x44 |
| MOVEMENT | **0x6A** | 0x6A |
| PIXELS | **0x6C** | 0x36 |
| BUZZER | **0x3C** | 0x1E |
| KNOB | **0x76** | 0x3A |
| BUTTONS | **0x7C** | 0x3E |

**Always use the Modulino Library Address in your code** — not the hardware address. Why? Each Modulino board has a small STM32 microcontroller that sits between I2C and the actual sensor. The library talks to the STM32 (at the Modulino address), which then talks to the sensor.

```cpp
// CORRECT — Modulino library address
ModulinoDistance distance;   // automatically uses 0x29
distance.begin();
```

---

## Main Sensor: LSM9DS1 (Built into Nano 33 BLE Sense)

The 9-axis IMU is the most important sensor for this project. It measures:

| Axis set | Sensor | Unit |
|----------|--------|------|
| AX, AY, AZ | Accelerometer | g (convert to m/s² × 9.80665) |
| GX, GY, GZ | Gyroscope | dps (convert to rad/s × π/180) |
| MX, MY, MZ | Magnetometer | microtesla |

**Required library for Rev1:** `Arduino_LSM9DS1`  
Install from Arduino Library Manager: Tools → Manage Libraries → search "LSM9DS1"

```cpp
#include <Arduino_LSM9DS1.h>

void setup() {
    IMU.begin();
}

void loop() {
    float ax, ay, az;
    if (IMU.accelerationAvailable()) {
        IMU.readAcceleration(ax, ay, az);
        // ax, ay, az are in g — multiply by 9.80665 for m/s²
    }

    float gx, gy, gz;
    if (IMU.gyroscopeAvailable()) {
        IMU.readGyroscope(gx, gy, gz);
        // gx, gy, gz are in dps — multiply by PI/180 for rad/s
    }
}
```

**Wait for `available()`** — never read before the sensor has new data. Streaming zeros before data is ready causes bad downstream results (false velocity/position drift).

---

## Sound Sensor: OJFF14 Wiring

The OJFF14 is a simple analog sound sensor.

| OJFF14 pin | Nano 33 BLE Sense |
|------------|-------------------|
| S (signal) | A7 |
| + (power) | 3V3 |
| − (ground) | GND |

**Use 3.3V supply** — the Nano analog pins are not 5V tolerant. If you power OJFF14 from 5V, add a voltage divider on the signal line:

```
S ──[10kΩ]──┬── A7
            [10kΩ]
             │
            GND
```

The sensor outputs a varying analog voltage proportional to sound amplitude. Read it with `analogRead(A7)`.

---

## Modulino DISTANCE — Range Sensing

Measures distance using an invisible laser (Time-of-Flight). The laser bounces off the target and the chip measures how long it takes.

Range: 0–1200 mm (0–120 cm). Accuracy: ±7 mm at short range.

```cpp
ModulinoDistance distance;
distance.begin();

if (distance.available()) {
    int cm = distance.get();   // returns cm as int
}
```

Limitations:
- Must point perpendicular to the target
- Dark surfaces read slightly farther than actual
- Strong sunlight (IR) can interfere

---

## Modulino THERMO — Temperature and Humidity

Measures ambient temperature (±0.25°C) and relative humidity (±2.8% RH).

```cpp
ModulinoThermo thermo;
thermo.begin();

float temp = thermo.getTemperature();  // °C
float hum  = thermo.getHumidity();    // %
```

Limitations:
- Takes 1–2 minutes to stabilize after moving between environments
- Reads +1–2°C too high if enclosed near other electronics
- Sample rate max ~2 Hz

---

## Modulino MOVEMENT — 6-axis IMU

A separate IMU (accelerometer + gyroscope) on a Qwiic board.

```cpp
ModulinoMovement movement;
movement.begin();

movement.update();           // MUST call before reading
float x = movement.getX();  // accel X in g
float y = movement.getY();  // accel Y in g
float z = movement.getZ();  // accel Z in g
```

**Always calibrate first** — raw readings at rest are not zero:

```cpp
float baseX, baseY, baseZ;

void calibrateSensor() {
    float sx = 0, sy = 0, sz = 0;
    for (int i = 0; i < 50; i++) {
        movement.update();
        sx += movement.getX();
        sy += movement.getY();
        sz += movement.getZ();
        delay(20);
    }
    baseX = sx / 50;
    baseY = sy / 50;
    baseZ = sz / 50;
}
```

---

## Modulino PIXELS — 8 RGB LEDs

```cpp
ModulinoPixels leds;
leds.begin();

leds.set(0, GREEN, 50);   // LED index 0–7, color, brightness 0–255
leds.show();              // ALWAYS call show() to apply changes
```

**Do not forget `leds.show()`** — without it, nothing changes on the hardware.

Maximum brightness (255) on all 8 LEDs draws ~267 mA. Keep brightness at 50–80 for normal use.

---

## Modulino BUZZER — Audio Alerts

```cpp
ModulinoBuzzer buzzer;
buzzer.begin();

buzzer.tone(880, 300);   // 880 Hz for 300 milliseconds
delay(500);
buzzer.tone(0, 10);      // stop
```

One tone at a time. Volume is fixed — cannot adjust loudness in code.

---

## Dashboard — Web Serial

Open `sensors-test/dashboard.html` in **Chrome** or **Edge** (not Firefox — Web Serial not supported).

1. Click **Connect Serial**
2. Select the Arduino port
3. Hold the sensor still
4. Click **Reset Tracking**
5. Move the sensor — watch the live charts and 3D position update

The dashboard communicates directly with the Nano 33 BLE Sense over USB Serial. No server required — it runs locally in the browser.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Reading IMU before `available()` returns true | Check `accelerationAvailable()` before `readAcceleration()` |
| Forgetting `leds.show()` | Always call it after every `leds.set()` |
| Forgetting `movement.update()` | Always call it before `getX()` / `getY()` |
| Powering OJFF14 from 5V into A7 directly | Use 3.3V supply or add a voltage divider |
| Using `Wire` instead of `Wire1` on UNO Q | Qwiic maps to `Wire1` on UNO Q |
| Using hardware I2C address in code | Always use Modulino library address |
| Reading 0 from IMU immediately on boot | Wait for `IMU.accelerationAvailable()` |
