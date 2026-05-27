# Smart Pet Care — Hardware Guide for Beginners

> You are new to hardware. This guide explains everything you need to know to build the pet care system, step by step, from "what is a Qwiic cable" to "how do I read the food bowl level."

---

## What You're Building

A system that monitors your cat (Mango) at home while Nat is at rehab:

| Thing to monitor | Sensor you'll use | What it tells you |
|-----------------|-------------------|--------------------|
| Food bowl level | Modulino DISTANCE | How full the bowl is (cm from sensor to food surface) |
| Room temperature | Modulino THERMO | Is the room too hot/cold for the cat? |
| Cat activity | Modulino MOVEMENT | Did the cat move? Is it active or unusually still? |
| Visual check | Phone camera (WiFi) | Quick visual snapshot via app |
| Status light | Modulino PIXELS | Green/Yellow/Red LED visible in apartment |
| Temperature alert | Modulino BUZZER | Beep if room gets dangerously hot |

---

## The Brain: Arduino UNO Q

Think of the UNO Q as a **small computer** (like a Raspberry Pi but simpler). It:
- Reads all the sensors
- Decides what state the pet is in (OK / Hungry / Too Hot / etc.)
- Sends data to a dashboard via WiFi so Nat can check on a phone

You **program** it by writing code in Arduino IDE on your laptop, then uploading via USB-C cable.

```
Your Laptop ──[USB-C]──→ Arduino UNO Q ──[Qwiic cables]──→ All sensors
                                       ──[WiFi]──────────→ Dashboard
```

---

## The Connectors: Qwiic (Pronounced "Quick")

**This is the most important thing to understand physically.**

Every Modulino sensor has two identical Qwiic ports (a small 4-pin connector). You connect them in a chain:

```
UNO Q Qwiic port
    │
    └──[yellow-blue-red-black cable]──→ DISTANCE module
                                              │
                                              └──[cable]──→ THERMO module
                                                                │
                                                                └──[cable]──→ MOVEMENT module
                                                                                   │
                                                                                   └──[cable]──→ PIXELS
                                                                                                    │
                                                                                                    └──→ BUZZER
```

**Rules for Qwiic:**
1. **It's plug-and-play** — the connector is shaped so you can't put it in backwards
2. **Order doesn't matter** — you can connect them in any sequence
3. **3.3V only** — the cable carries 3.3V power. Never connect a 5V device here
4. **Max cable length: 1.2 m per segment** — keep cables short

**What the 4 wires do:**

| Wire color | Signal | What it does |
|-----------|--------|--------------|
| Yellow | SCL | Clock — times the data pulses |
| Blue | SDA | Data — actual information |
| Red | 3.3V | Power (from UNO Q to module) |
| Black | GND | Ground (return path for power) |

You don't need to worry about the individual wires — the connector handles it all.

---

## Sensor 1: Modulino DISTANCE

**What it is:** A laser rangefinder (Time-of-Flight). It shoots an invisible laser and measures how long it takes to bounce back — like a tiny bat using echolocation.

**What it measures:** Distance in **centimeters (cm)**

**How to use it for the food bowl:**

Mount the sensor **above the bowl, pointing straight down**:

```
   [DISTANCE sensor]
         │  laser pointing down
         ↓
   ══════════════  ← food surface (measured distance: e.g., 5 cm)
   ~~~~~~~~~~~~~~  ← more food here
   ══════════════  ← bottom of bowl (empty: e.g., 15 cm)
```

- Bowl **empty** → laser travels far (e.g., 15 cm)
- Bowl **full** → laser bounces back quickly (e.g., 3 cm)

**Convert distance to fill percentage:**
```cpp
int empty_cm = 15;  // measure this when bowl is empty
int full_cm  = 3;   // measure this when bowl is full
int fill_percent = (empty_cm - measured_cm) * 100 / (empty_cm - full_cm);
// fill_percent: 0 = empty, 100 = full
```

**How to code it:**
```cpp
#include "Arduino_Modulino.h"
ModulinoDistance distance;

void setup() {
    Modulino.begin();
    distance.begin();
}

void loop() {
    if (distance.available()) {
        int cm = distance.get();          // read distance in cm
        Serial.println(cm);               // print to Serial Monitor
    }
    delay(100);  // read ~10 times per second
}
```

**Limitations to know:**
- Works best pointed **straight down** at the food
- Dark-colored bowls may give slightly inaccurate readings (dark absorbs laser)
- Don't use in direct sunlight (outdoor IR noise)
- Practical range: 2–200 cm; most accurate 2–100 cm

---

## Sensor 2: Modulino THERMO

**What it is:** A combined temperature and humidity sensor. Measures the air around it.

**What it measures:**
- Temperature in **°C**
- Humidity in **%** (relative humidity)

**Why it matters for pet care:**
- Cats are comfortable in **18–26°C**
- Below 15°C → cat too cold
- Above 30°C → potentially dangerous (heat stress)

**How to code it:**
```cpp
#include "Arduino_Modulino.h"
ModulinoThermo thermo;

void setup() {
    Modulino.begin();
    thermo.begin();
}

void loop() {
    float temp = thermo.getTemperature();   // e.g., 24.5
    float hum  = thermo.getHumidity();     // e.g., 65.0

    Serial.print("Temp: ");
    Serial.print(temp);
    Serial.print(" C  Humidity: ");
    Serial.println(hum);

    delay(1000);  // read once per second (don't go faster — sensor is slow)
}
```

**Limitations to know:**
- **Slow to respond** — if you carry it from air-conditioned room to hot room, it takes 1–2 minutes to show the new temperature. This is normal for this type of sensor.
- Don't put it directly in sunlight or near a heat source (will read artificially high)
- Best placed in the middle of the room at cat height (~30 cm off floor)

---

## Sensor 3: Modulino MOVEMENT

**What it is:** A 6-axis IMU (Inertial Measurement Unit). Measures both acceleration and rotation. Think of it like the sensor inside your phone that knows if you're tilting it.

**What it measures:**
- `getX()`, `getY()`, `getZ()` → acceleration in each direction (in units of **g**, where 1g = gravity)
- `getRoll()`, `getPitch()`, `getYaw()` → how fast it's rotating (in degrees per second)

**How to use it for pet activity:**

Place the sensor somewhere the cat walks past or near their favorite spot. When the cat moves nearby (or the sensor is on a mat the cat steps on), the vibration will change the readings.

The simplest use: **detect if something moved nearby** by comparing current reading to a baseline.

```
Strategy: mount on a surface the cat interacts with
  → cat steps on mat → mat vibrates → sensor detects vibration
  → cat walks past → air movement causes tiny vibration
```

**CRITICAL: You must calibrate first**

When the sensor sits still, it doesn't read exactly 0 — it has a small drift. If you don't calibrate:
- The system will think the cat is moving when nothing is happening
- Roll/Pitch will slowly drift even when stationary

```cpp
// Always do this at startup — takes about 1 second
void calibrateSensor() {
    float sumX = 0, sumY = 0, sumZ = 0;
    for (int i = 0; i < 50; i++) {
        movement.update();
        sumX += movement.getX();
        sumY += movement.getY();
        sumZ += movement.getZ();
        delay(20);
    }
    baseX = sumX / 50;
    baseY = sumY / 50;
    baseZ = sumZ / 50;
    // now compare future readings against these baseline values
}
```

**How to detect motion:**
```cpp
movement.update();
float deltaX = abs(movement.getX() - baseX);
float deltaY = abs(movement.getY() - baseY);

// If movement exceeds threshold → cat activity detected
if (deltaX > 0.15 || deltaY > 0.15) {
    // cat (or something) moved!
    lastActivityTime = millis();
}
```

**Checking inactivity:**
```cpp
unsigned long inactiveMinutes = (millis() - lastActivityTime) / 60000;
if (inactiveMinutes > 60) {
    // cat hasn't triggered movement in 1 hour — check on them!
}
```

**Limitations to know:**
- Can't tell you **where** the cat is, only **if there was movement** near the sensor
- Gets confused by vibrations from other sources (AC unit, footsteps in the building)
- Gyro drifts over time (angle readings slowly shift) — stick to using accelerometer for pet tracking
- Can have two MOVEMENT modules on same chain but must change address on one (hardware jumper)

---

## Output 1: Modulino PIXELS (Status Lights)

**What it is:** 8 RGB LEDs you can set to any color and brightness. Great for a visible status indicator.

**Suggested status scheme for pet care:**

| State | Color | Pixels pattern |
|-------|-------|---------------|
| ALL OK | Green | All 8 green |
| HUNGRY (bowl < 30%) | Yellow | All 8 yellow |
| TOO HOT (temp > 30°C) | Red | Flashing red |
| INACTIVE WARNING | Purple | Slow breathing purple |
| SYSTEM OFFLINE | Off | All off |

**How to code it:**
```cpp
#include "Arduino_Modulino.h"
ModulinoPixels leds;

void setup() {
    Modulino.begin();
    leds.begin();
}

// Set all 8 LEDs to one color
void setAllColor(uint8_t r, uint8_t g, uint8_t b) {
    // The library uses named colors: RED, GREEN, BLUE, VIOLET, WHITE
    for (int i = 0; i < 8; i++) {
        leds.set(i, GREEN, 50);  // index, color, brightness(0-255)
    }
    leds.show();  // IMPORTANT: nothing shows until you call show()
}

// In your loop, update based on state
void updateStatusLight(String state) {
    for (int i = 0; i < 8; i++) {
        if (state == "OK")     leds.set(i, GREEN, 50);
        if (state == "HUNGRY") leds.set(i, VIOLET, 100);  // no yellow, use violet
        if (state == "HOT")    leds.set(i, RED, 100);
    }
    leds.show();
}
```

**Remember:** Always call `leds.show()` after `leds.set()` — otherwise nothing happens on the hardware.

---

## Output 2: Modulino BUZZER (Audio Alert)

**What it is:** A small speaker that can play tones at different frequencies.

**How to code it:**
```cpp
#include "Arduino_Modulino.h"
ModulinoBuzzer buzzer;

void setup() {
    Modulino.begin();
    buzzer.begin();
}

// Alert beep — 3 short beeps
void alertBeep() {
    for (int i = 0; i < 3; i++) {
        buzzer.tone(880, 200);   // 880 Hz for 200ms
        delay(300);
    }
    buzzer.tone(0, 10);          // stop
}

// In your loop:
if (temp > 30.0) {
    alertBeep();  // temperature alert
    delay(5000);  // wait 5 seconds before next alert
}
```

**Common frequencies:**
| Note | Frequency |
|------|-----------|
| Low beep (calm) | 440 Hz |
| Mid beep (notice) | 660 Hz |
| High beep (urgent) | 880–1000 Hz |
| Off | 0 Hz |

---

## Putting It All Together: A Working Sketch

Here's a minimal working program for the pet care system:

```cpp
#include "Arduino_Modulino.h"

// Declare all sensors and outputs
ModulinoDistance distance;
ModulinoThermo   thermo;
ModulinoMovement movement;
ModulinoPixels   leds;
ModulinoBuzzer   buzzer;

// Calibration baselines
float baseX, baseY, baseZ;

// Bowl calibration
const int BOWL_EMPTY_CM = 15;  // measure this with your bowl
const int BOWL_FULL_CM  = 3;   // measure this with full bowl

// Thresholds
const float TEMP_HOT   = 30.0;
const float TEMP_COLD  = 15.0;
const int   BOWL_WARN  = 30;   // % — warn when below 30%
const float MOTION_TH  = 0.15; // g — motion detection threshold
const long  INACT_MS   = 3600000; // 1 hour in milliseconds

unsigned long lastActivityTime = 0;

void calibrateSensor() {
    Serial.println("Calibrating... keep sensor still for 1 second");
    float sumX = 0, sumY = 0, sumZ = 0;
    for (int i = 0; i < 50; i++) {
        movement.update();
        sumX += movement.getX();
        sumY += movement.getY();
        sumZ += movement.getZ();
        delay(20);
    }
    baseX = sumX / 50;
    baseY = sumY / 50;
    baseZ = sumZ / 50;
    Serial.println("Calibration done!");
}

void setup() {
    Serial.begin(9600);
    Modulino.begin();

    distance.begin();
    thermo.begin();
    movement.begin();
    leds.begin();
    buzzer.begin();

    delay(2000);         // wait for sensors to stabilize
    calibrateSensor();

    lastActivityTime = millis();  // assume active at start
    Serial.println("Smart Pet Care ready.");
}

void loop() {
    // ── Read food bowl ─────────────────────────────────────────
    int bowl_pct = 100;
    if (distance.available()) {
        int cm = distance.get();
        bowl_pct = (BOWL_EMPTY_CM - cm) * 100 / (BOWL_EMPTY_CM - BOWL_FULL_CM);
        bowl_pct = constrain(bowl_pct, 0, 100);  // clamp 0–100
    }

    // ── Read temperature ───────────────────────────────────────
    float temp = thermo.getTemperature();
    float hum  = thermo.getHumidity();

    // ── Read movement (cat activity) ───────────────────────────
    movement.update();
    float dx = abs(movement.getX() - baseX);
    float dy = abs(movement.getY() - baseY);
    if (dx > MOTION_TH || dy > MOTION_TH) {
        lastActivityTime = millis();  // reset inactivity timer
    }
    long inactive_min = (millis() - lastActivityTime) / 60000;

    // ── Decide state ───────────────────────────────────────────
    String state = "OK";
    if (temp > TEMP_HOT)           state = "TOO_HOT";
    else if (bowl_pct < BOWL_WARN) state = "HUNGRY";
    else if (inactive_min > 60)    state = "INACTIVE";

    // ── Update LEDs ────────────────────────────────────────────
    for (int i = 0; i < 8; i++) {
        if (state == "OK")       leds.set(i, GREEN,  50);
        if (state == "HUNGRY")   leds.set(i, VIOLET, 100);
        if (state == "TOO_HOT")  leds.set(i, RED,    150);
        if (state == "INACTIVE") leds.set(i, BLUE,   80);
    }
    leds.show();

    // ── Buzzer alert for heat only ─────────────────────────────
    if (state == "TOO_HOT") {
        buzzer.tone(880, 300);
        delay(500);
        buzzer.tone(0, 10);
    }

    // ── Print to Serial Monitor ────────────────────────────────
    Serial.print("Bowl: "); Serial.print(bowl_pct); Serial.print("% | ");
    Serial.print("Temp: "); Serial.print(temp); Serial.print("C | ");
    Serial.print("Inactive: "); Serial.print(inactive_min); Serial.print("min | ");
    Serial.print("State: "); Serial.println(state);

    delay(500);  // update twice per second
}
```

---

## Step-by-Step: First Time Setup

### Step 1: Install Software
1. Download **Arduino IDE 2** from arduino.cc
2. Open Arduino IDE → Tools → Manage Libraries
3. Install: `Arduino_Modulino` (v0.7.0) and `MsgPack` (v0.4.2)

### Step 2: Connect Hardware

```
1. Plug Qwiic cable into UNO Q Qwiic port
2. Plug other end into DISTANCE module (either Qwiic port)
3. Plug another cable from DISTANCE second port → THERMO
4. Continue chain: THERMO → MOVEMENT → PIXELS → BUZZER
5. Connect UNO Q to laptop via USB-C
```

### Step 3: Test Each Sensor Individually

Don't try to run everything at once first. Test one sensor:

```cpp
// Test DISTANCE only
#include "Arduino_Modulino.h"
ModulinoDistance distance;
void setup() { Serial.begin(9600); Modulino.begin(); distance.begin(); }
void loop() {
    if (distance.available()) {
        Serial.println(distance.get());  // should print a number in cm
    }
    delay(100);
}
```

Open **Tools → Serial Monitor** (set to 9600 baud) — you should see numbers changing as you move your hand over the sensor.

### Step 4: Calibrate your bowl distances

1. Put DISTANCE sensor above the empty bowl, run sketch, note the cm value → that's `BOWL_EMPTY_CM`
2. Fill the bowl, note the cm value → that's `BOWL_FULL_CM`
3. Update the constants in your code

### Step 5: Find your MOVEMENT baseline

Run the movement code with `calibrateSensor()`. Check Serial Monitor — it should print "Calibration done!" then start showing near-zero values when still.

---

## Common Mistakes (and How to Fix Them)

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Forgot `leds.show()` | LEDs never light up | Add `leds.show()` after every `leds.set()` |
| Forgot `movement.update()` | Sensor always returns same value | Call `movement.update()` before reading |
| No calibration | False motion alerts constantly | Run `calibrateSensor()` in setup() |
| Distance sensor reads 0 | Module not initialized | Check `distance.begin()` is in setup() |
| Nothing works | All readings wrong/zero | Check Qwiic cables are fully clicked in |
| Two sensors read each other | Weird cross-talk | Different sensor types have different I2C addresses — this shouldn't happen |
| Thermo reads very wrong | Too close to electronics | Move it away from the UNO Q board (3.3V regulator generates heat) |

---

## What to Demo on Hackathon Day

The judges want to see the **full loop**:

```
1. Show bowl with food → Pixels GREEN, Serial shows "Bowl: 85%, State: OK"
2. Remove food → Pixels turn VIOLET, Serial shows "Bowl: 5%, State: HUNGRY"
3. Warm sensor with hand → Pixels turn RED, Buzzer beeps, "State: TOO_HOT"
4. Put sensor back to room temp → back to GREEN
5. Show dashboard on phone/laptop with live numbers
```

**Key phrase to say:** "The system gives Nat wellness awareness about Mango — it's a behavioral monitoring tool, not a veterinary diagnostic."

---

## Quick Reference Card

```
Modulino DISTANCE  → distance.get()           → int (cm)
Modulino THERMO    → thermo.getTemperature()  → float (°C)
                   → thermo.getHumidity()     → float (%)
Modulino MOVEMENT  → movement.update()        → call first!
                   → movement.getX/Y/Z()      → float (g)
Modulino PIXELS    → leds.set(i, COLOR, brightness)
                   → leds.show()              → REQUIRED to display
Modulino BUZZER    → buzzer.tone(hz, ms)      → tone(0,10) to stop
Modulino BUTTONS   → buttons.update()         → call first!
                   → buttons.isPressed(0/1/2) → bool

All modules:       → Modulino.begin()          → call once in setup()
                   → module.begin()            → call once per module
```
