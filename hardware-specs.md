# WellSense AIoT Hackathon — Hardware Specifications

All hardware specs sourced from official datasheets.
Each subteam receives one identical set of all devices listed below.

---

## 1. Arduino UNO Q

**SKU:** ABX00162 / ABX00173  
**Datasheet:** `hardware/UnoQ/ABX00162-ABX00173-datasheet.pdf`

### Processor

| Property | Value |
|----------|-------|
| MPU | Qualcomm QRB2210 (Dragonwing™) |
| MPU Cores | 4× ARM Cortex-A53 @ 2.0 GHz |
| MPU OS | Debian Linux |
| MPU RAM | 1–4 GB LPDDR4X |
| MPU Storage | 16–32 GB eMMC |
| MPU I/O Voltage | 1.8V |
| MCU | STM32U585 |
| MCU Core | ARM Cortex-M33 @ up to 160 MHz |
| MCU OS | Arduino / Zephyr |
| MCU I/O Voltage | 3.3V |

### Wireless

| Property | Value |
|----------|-------|
| Module | WCBN3536A |
| WiFi | 802.11 a/b/g/n/ac (Wi-Fi 5), dual-band 2.4/5 GHz |
| Bluetooth | BT 5.1 |

### Power

| Parameter | Min | Typical | Max |
|-----------|-----|---------|-----|
| USB-C input | 4.5V | 5V | 5.5V |
| DC IN (barrel) | 7V | — | 24V |
| 3.3V rail output | 3.1V | 3.3V | 3.5V |
| Operating temperature | −10°C | — | +60°C |

### Qwiic / I2C

| Property | Value |
|----------|-------|
| Connector | QWIIC1 → I²C4 (IC4) |
| Arduino variable | Wire1 |
| Voltage | 3.3V only |
| Max cable per segment | 1.2 m |

---

## 2. Modulino DISTANCE

**Chip:** VL53L4CDV0DH/1 (Time-of-Flight laser ranging)  
**Modulino I2C Address:** 0x29 | **Hardware I2C Address:** 0x29  
**Datasheet:** `hardware/PlugandMakeKit/AKX00069-datasheet.pdf` (p.21)

| Property | Value |
|----------|-------|
| Technology | Time-of-Flight (laser) |
| Supply voltage | 2.6V min, 3.5V max |
| Power (peak) | 40 mA |
| Power (active ranging) | 24 mA |
| Power (I2C standby) | 4 mA |
| Range | 0–1200 mm (0–120 cm) |
| Accuracy | ±7 mm (short range) to ±3% (longer range) |
| Resolution | 1 mm |
| Communication | I2C |

---

## 3. Modulino THERMO

**Chip:** HS3003 (capacitive humidity + temperature)  
**Modulino I2C Address:** 0x44 | **Hardware I2C Address:** 0x44  
**Datasheet:** `hardware/PlugandMakeKit/AKX00069-datasheet.pdf` (p.24)

| Property | Value |
|----------|-------|
| Supply voltage | 2.3V min, 5.5V max |
| Power consumption | 24.4 µA (14-bit, 3.3V supply) |
| Temperature range | −40°C to +125°C |
| Temperature accuracy | ±0.25°C |
| Humidity range | 0–100% RH |
| Humidity accuracy | ±2.8% RH |
| Resolution | 14-bit (both temp and humidity) |
| Communication | I2C |

---

## 4. Modulino MOVEMENT

**Chip:** LSM6DSOXTR (6-axis IMU)  
**Modulino I2C Address:** 0x6A | **Hardware I2C Address:** 0x6A (alt 0x7E via jumper)  
**Datasheet:** `hardware/PlugandMakeKit/AKX00069-datasheet.pdf` (p.17)

| Property | Value |
|----------|-------|
| Type | 6-axis IMU (3-axis accelerometer + 3-axis gyroscope) |
| Supply voltage | 1.71V min, 3.6V max |
| Power (accelerometer only) | 170 µA |
| Power (gyroscope) | 0.55 mA |
| Accelerometer range | ±2g / ±4g / ±8g / ±16g (selectable) |
| Accelerometer resolution | 0.061 mg/LSB (±2g) to 0.488 mg/LSB (±16g) |
| Accelerometer accuracy | ±20 mg (zero-g offset) |
| Gyroscope range | ±125 / ±250 / ±500 / ±1000 / ±2000 dps (selectable) |
| Gyroscope resolution | 4.375 mdps/LSB (±125 dps) to 70 mdps/LSB (±2000 dps) |
| Gyroscope accuracy | ±1 dps (zero-rate offset) |
| Max sample rate | 6664 Hz |
| Communication | I2C |

---

## 5. Modulino PIXELS

**Chip:** STM32C011F4 + 8× LC8822-2020 RGB LEDs  
**Modulino I2C Address:** 0x6C | **Hardware I2C Address:** 0x36  
**Datasheet:** `hardware/PlugandMakeKit/AKX00069-datasheet.pdf` (p.33)

| Property | Value |
|----------|-------|
| LEDs | 8× LC8822-2020 individually addressable RGB |
| Microcontroller | STM32C011F4 |
| Supply voltage | 2.0V min, 3.6V max |
| Power (max, all LEDs full white) | 33 mA × 8 LEDs + 3.4 mA MCU ≈ 267 mA |
| Brightness | 8-bit (0–255) per channel |
| ADC resolution | 12-bit |
| Communication | I2C |

---

## 6. Modulino BUZZER

**Chip:** STM32C011F4 + passive buzzer (PKLCS1212E4001)  
**Modulino I2C Address:** 0x3C | **Hardware I2C Address:** 0x1E  
**Datasheet:** `hardware/PlugandMakeKit/AKX00069-datasheet.pdf` (p.30)

| Property | Value |
|----------|-------|
| Actuator | 1× passive buzzer |
| Microcontroller | STM32C011F4 |
| Supply voltage | 2.0V min, 3.6V max |
| Power consumption | 6.4 mA |
| Frequency range | 31 Hz (NOTE_B0) to 4186 Hz (NOTE_C8) |
| ADC resolution | 12-bit (±2 LSB typical INL) |
| Communication | I2C |

---

## 7. Modulino KNOB

**Chip:** STM32C011F4 + Quadrature Rotary Encoder  
**Modulino I2C Address:** 0x76 | **Hardware I2C Address:** 0x3A  
**Datasheet:** `hardware/PlugandMakeKit/AKX00069-datasheet.pdf` (p.27)

| Property | Value |
|----------|-------|
| Sensor | Quadrature rotary encoder + SPST switch |
| Microcontroller | STM32C011F4 |
| Supply voltage | 2.0V min, 3.6V max |
| Power consumption | 3.4 mA |
| Range | 360° |
| Accuracy | Internal oscillator ±1% |
| ADC resolution | 12-bit |
| Communication | I2C, USART, SPI, I2S |

---

## 8. Modulino BUTTONS

**Chip:** STM32C011F4 + 3× SPST push buttons  
**Modulino I2C Address:** 0x7C | **Hardware I2C Address:** 0x3E  
**Datasheet:** `hardware/PlugandMakeKit/AKX00069-datasheet.pdf` (p.37)

| Property | Value |
|----------|-------|
| Buttons | 3× SPST push buttons + 3× yellow LEDs |
| Microcontroller | STM32C011F4 |
| Supply voltage | 2.0V min, 3.6V max |
| Power consumption | 2.5 mA × 3 buttons + 3.4 mA MCU |
| ADC accuracy | ±2 LSB typical INL |
| ADC resolution | 12-bit |
| Communication | I2C, USART, SPI, I2S |

---

## 9. Arduino Nano 33 BLE Sense

**SKU:** ABX00031  
**Datasheet:** `hardware/Nano33BLE/ABX00031-datasheet.pdf`

### Main Board

| Property | Value |
|----------|-------|
| Module | NINA B306 (Nordic nRF52480) |
| Processor | ARM Cortex-M4F @ 64 MHz (with FPU) |
| Flash / RAM | 1 MB Flash / 256 KB RAM |
| I/O voltage | 3.3V only — NOT 5V tolerant |
| Operating temperature | −40°C to +85°C |
| Power input | Micro-B USB or VIN header |
| Min USB voltage | 4.8V–4.96V |
| Board size | 40.64 × 17.78 mm |

### Bluetooth (NINA B306)

| Property | Value |
|----------|-------|
| Standard | Bluetooth 5 multiprotocol |
| Max speed | 2 Mbps |
| TX power | +8 dBm |
| RX sensitivity | −95 dBm |
| TX current | 4.8 mA (at 0 dBm) |
| RX current | 4.6 mA (at 1 Mbps) |
| Other protocols | IEEE 802.15.4, Thread, Zigbee |

### On-Board Sensor: LSM9DS1 — 9-axis IMU

| Property | Value |
|----------|-------|
| Accelerometer range | ±2 / ±4 / ±8 / ±16 g |
| Gyroscope range | ±245 / ±500 / ±2000 dps |
| Magnetometer range | ±4 / ±8 / ±12 / ±16 gauss |
| Resolution | 16-bit |
| Power | 2 mA |

### On-Board Sensor: LPS22HB — Barometer + Temperature

| Property | Value |
|----------|-------|
| Pressure range | 260–1260 hPa |
| Precision | 24-bit |
| Output rate | 1–75 Hz |
| Power | 12 µA |

### On-Board Sensor: HTS221 — Humidity + Temperature

| Property | Value |
|----------|-------|
| Humidity range | 0–100% RH |
| Humidity accuracy | ±3.5% RH (20–80% RH) |
| Humidity resolution | 0.004% rH/LSB |
| Temperature accuracy | ±0.5°C (15–40°C) |
| Resolution | 16-bit |
| Power | 2 µA |

### On-Board Sensor: APDS-9960 — Proximity / Light / RGB / Gesture

| Property | Value |
|----------|-------|
| Functions | Proximity, Ambient light, RGB color, Gesture |
| Light sensing | UV and IR blocking filters |
| Gestures | UP / DOWN / LEFT / RIGHT |
| Power | 798 µA |

### On-Board Sensor: MP34DT05 — Digital Microphone (MEMS)

| Property | Value |
|----------|-------|
| AOP | 122.5 dBSPL |
| SNR | 64 dB |
| Sensitivity | −26 dBFS ± 3 dB |
| Pattern | Omnidirectional |
| Power | 650 µA |

### On-Board Chip: ATECC608A — Crypto

| Property | Value |
|----------|-------|
| Function | Cryptographic co-processor |
| Key storage | Up to 16 keys / certificates |
| Algorithms | ECDH, SHA-256, HMAC, AES-128 |
| Power | 14 mA |

### Power Budget

| Component | Max current |
|-----------|-------------|
| NINA B306 (BLE) | 15 mA |
| LSM9DS1 (IMU) | 2 mA |
| LPS22HB (barometer) | 12 µA |
| HTS221 (humidity) | 2 µA |
| APDS-9960 (light/gesture) | 798 µA |
| MP34DT05 (microphone) | 650 µA |
| ATECC608A (crypto) | 14 mA |
| User application headroom | 958 mA |

---

## 10. OV7675 Camera Module (ArduCAM)

**Sensor Chip:** OV7675 (OmniVision Technologies)  
**Datasheet:** `hardware/ov7675/240-ov7675ds.pdf`, `hardware/ov7675/b0070.pdf`

### Image Sensor

| Property | Value |
|----------|-------|
| Technology | 1/9" CMOS, OmniPixel3-HS™ |
| Active array | 640 × 480 pixels (VGA) |
| Pixel size | 2.5 µm × 2.5 µm |
| Image area | 1640 µm × 1220 µm |
| Chip package size | 2815 × 2825 µm |
| Module board size | 30.5 × 30.5 mm |
| Lens size | 1/9" |
| Lens chief ray angle | 21° |

### Image Quality

| Property | Value |
|----------|-------|
| Sensitivity | 1800 mV/(Lux-sec) |
| S/N ratio | 38 dB |
| Dynamic range | 71 dB |
| Fixed pattern noise (FPN) | 1% of V peak-to-peak |
| Shutter | Rolling shutter |
| Max exposure interval | 510 × t_ROW |

### Output & Frame Rate

| Resolution | Size | Max Frame Rate |
|------------|------|----------------|
| VGA | 640 × 480 | 30 fps |
| QVGA | 320 × 240 | 60 fps |
| QQVGA | 160 × 120 | 240 fps |

**Data formats:** YUV4:2:2, Raw RGB, ITU656, RGB565  
**Output interface:** 8-bit parallel DVP (Digital Video Port)  
**Config interface:** SCCB / I2C (SCL, SDA)  
**Input clock:** 1.5–27 MHz (must be supplied externally via XCLK pin)

### Power

| Property | Value |
|----------|-------|
| Analog supply | 2.6–3.0V |
| Core supply | 1.5V DC ±5% (internal regulator) |
| I/O supply | 1.71–3.0V |
| Active power | 98 mW |
| Standby power | 60 µW |
| Operating temperature | −30°C to +70°C |
| Stable image temperature | 0°C to +50°C |

### Pins

| Pin | Name | Description |
|-----|------|-------------|
| 1 | VCC | 3.3V power |
| 2 | GND | Ground |
| 3 | SCL | SCCB clock (config) |
| 4 | SDA | SCCB data (config) |
| 5 | VSYNC | Frame sync output |
| 6 | HREF | Line/pixel valid output |
| 7 | PCLK | Pixel clock output |
| 8 | XCLK | Master clock input |
| 9–16 | D7–D0 | 8-bit pixel data output |
| 20 | PEN | Power enable |
| 21 | PDN | Power down |

### Built-in Image Processing

- Automatic Exposure Control (AEC)
- Automatic White Balance (AWB)
- Automatic Gain Control (AGC)
- Automatic Black Level Calibration (ABLC)
- Defect pixel correction
- Lens shading correction
- Black sun cancellation

---

## I2C Address Summary (Modulino modules)

| Module | Chip | Modulino Library Addr | Hardware Scan Addr |
|--------|------|-----------------------|--------------------|
| DISTANCE | VL53L4CDV0DH/1 | 0x29 | 0x29 |
| THERMO | HS3003 | 0x44 | 0x44 |
| MOVEMENT | LSM6DSOXTR | 0x6A | 0x6A (alt 0x7E) |
| PIXELS | 8× LC8822-2020 | 0x6C | 0x36 |
| BUZZER | PKLCS1212E4001 | 0x3C | 0x1E |
| KNOB | Quadrature encoder | 0x76 | 0x3A |
| BUTTONS | 3× SPST | 0x7C | 0x3E |

Always use the **Modulino Library Address** in code — not the hardware address.
