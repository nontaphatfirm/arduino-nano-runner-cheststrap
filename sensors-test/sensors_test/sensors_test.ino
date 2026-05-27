/*
 * Runner Form IMU Sensor Test — Arduino Nano 33 BLE Sense
 *
 * Streams newline-delimited JSON at 20 Hz for dashboard.html.
 * Inspired by Arduino-Nano33BLE-Sense-Rev1_to_Blender-MCP--main:
 *   - wait for real accel/gyro samples before streaming
 *   - keep latest values instead of dropping unavailable axes to zero
 *   - convert accel to m/s^2 and gyro to rad/s for downstream integration
 *
 * The dashboard estimates displacement from live accelerometer and gyroscope
 * input, with deadband and reset support for recalibration.
 *
 * OJFF14 analog sound sensor:
 *   S -> A7, + -> 3V3 for direct Nano 33 BLE analog input, - -> GND.
 *   The OpenJumper doc lists 5V operation. Nano 33 BLE analog inputs are not
 *   5V tolerant, so use 3V3 or a divider/level shifter if powering OJFF14 at 5V.
 *
 * Required library for Rev1:
 *   Arduino_LSM9DS1
 *
 * For Rev2, set SENSOR_BOARD_REV to 2 and install:
 *   Arduino_BMI270_BMM150
 */

#include <Arduino.h>

#define SENSOR_BOARD_REV 1

#if SENSOR_BOARD_REV == 2
  #include <Arduino_BMI270_BMM150.h>
  const char IMU_NAME[] = "BMI270 + BMM150 (Nano 33 BLE Sense Rev2)";
#elif SENSOR_BOARD_REV == 1
  #include <Arduino_LSM9DS1.h>
  const char IMU_NAME[] = "LSM9DS1 (Nano 33 BLE Sense Rev1)";
#else
  #error "SENSOR_BOARD_REV must be 1 or 2"
#endif

const unsigned long SEND_INTERVAL_MS = 50;
const unsigned long LOG_INTERVAL_MS = 1000;
const int SOUND_PIN = A7;
const float ADC_REF_VOLTS = 3.3f;
const int ADC_MAX = 4095;
const int SOUND_SAMPLES = 32;

bool imuReady = false;
bool gotAccel = false;
bool gotGyro = false;
bool gotMag = false;

unsigned long lastSendTime = 0;
unsigned long lastLogTime = 0;

static float axG = 0.0f;
static float ayG = 0.0f;
static float azG = 1.0f;
static float gxDps = 0.0f;
static float gyDps = 0.0f;
static float gzDps = 0.0f;
static float mxUT = 0.0f;
static float myUT = 0.0f;
static float mzUT = 0.0f;

int soundRaw = 0;
int soundPeak = 0;
float soundVolts = 0.0f;
float soundLevel = 0.0f;

void readSoundSensor() {
  int minRaw = ADC_MAX;
  int maxRaw = 0;
  long sumRaw = 0;

  for (int i = 0; i < SOUND_SAMPLES; i++) {
    int v = analogRead(SOUND_PIN);
    if (v < minRaw) minRaw = v;
    if (v > maxRaw) maxRaw = v;
    sumRaw += v;
    delayMicroseconds(120);
  }

  soundRaw = (int)(sumRaw / SOUND_SAMPLES);
  soundPeak = maxRaw - minRaw;
  soundVolts = soundRaw * ADC_REF_VOLTS / ADC_MAX;
  soundLevel = soundPeak / 900.0f;
  if (soundLevel > 1.0f) soundLevel = 1.0f;
}

void printInitPacket() {
  Serial.print(F("{\"type\":\"init\",\"board\":\""));
  Serial.print(IMU_NAME);
  Serial.print(F("\",\"rev\":"));
  Serial.print(SENSOR_BOARD_REV);
  Serial.print(F(",\"imu\":"));
  Serial.print(imuReady ? "true" : "false");
  Serial.print(F(",\"sound\":true"));
  Serial.println(F(",\"units\":{\"accel\":\"mps2\",\"gyro\":\"radps\",\"mag\":\"uT\",\"soundRaw\":\"adc\",\"soundPeak\":\"adc_pp\",\"soundVolts\":\"V\",\"soundLevel\":\"0to1\"}}"));
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) {
    // Allow Web Serial / Serial Monitor time to attach, but still run untethered.
  }

  analogReadResolution(12);
  imuReady = IMU.begin();
  printInitPacket();

  if (!imuReady) {
    Serial.println(F("{\"type\":\"log\",\"level\":\"error\",\"message\":\"IMU init failed. Check board revision and installed library.\"}"));
  }

  lastSendTime = millis();
}

void loop() {
  if (!imuReady) {
    unsigned long now = millis();
    if (now - lastLogTime >= LOG_INTERVAL_MS) {
      lastLogTime = now;
      Serial.println(F("{\"type\":\"log\",\"level\":\"error\",\"message\":\"IMU not ready; not streaming fake sensor data.\"}"));
    }
    return;
  }

  if (IMU.accelerationAvailable()) {
    IMU.readAcceleration(axG, ayG, azG);
    gotAccel = true;
  }
  if (IMU.gyroscopeAvailable()) {
    IMU.readGyroscope(gxDps, gyDps, gzDps);
    gotGyro = true;
  }
  if (IMU.magneticFieldAvailable()) {
    IMU.readMagneticField(mxUT, myUT, mzUT);
    gotMag = true;
  }

  if (!gotAccel || !gotGyro) {
    unsigned long now = millis();
    if (now - lastLogTime >= LOG_INTERVAL_MS) {
      lastLogTime = now;
      Serial.print(F("{\"type\":\"log\",\"level\":\"warn\",\"message\":\"Waiting for IMU samples\","));
      Serial.print(F("\"accel\":")); Serial.print(gotAccel ? "true" : "false");
      Serial.print(F(",\"gyro\":")); Serial.print(gotGyro ? "true" : "false");
      Serial.print(F(",\"mag\":")); Serial.print(gotMag ? "true" : "false");
      Serial.println(F("}"));
    }
    return;
  }

  unsigned long now = millis();
  if (now - lastSendTime < SEND_INTERVAL_MS) {
    return;
  }
  lastSendTime = now;

  const float ax = axG * 9.80665f;
  const float ay = ayG * 9.80665f;
  const float az = azG * 9.80665f;
  const float gx = gxDps * DEG_TO_RAD;
  const float gy = gyDps * DEG_TO_RAD;
  const float gz = gzDps * DEG_TO_RAD;
  readSoundSensor();

  Serial.print(F("{\"type\":\"data\",\"t\":")); Serial.print(now);
  Serial.print(F(",\"ax\":")); Serial.print(ax, 4);
  Serial.print(F(",\"ay\":")); Serial.print(ay, 4);
  Serial.print(F(",\"az\":")); Serial.print(az, 4);
  Serial.print(F(",\"gx\":")); Serial.print(gx, 5);
  Serial.print(F(",\"gy\":")); Serial.print(gy, 5);
  Serial.print(F(",\"gz\":")); Serial.print(gz, 5);
  Serial.print(F(",\"mx\":")); Serial.print(mxUT, 2);
  Serial.print(F(",\"my\":")); Serial.print(myUT, 2);
  Serial.print(F(",\"mz\":")); Serial.print(mzUT, 2);
  Serial.print(F(",\"magReady\":")); Serial.print(gotMag ? "true" : "false");
  Serial.print(F(",\"soundRaw\":")); Serial.print(soundRaw);
  Serial.print(F(",\"soundPeak\":")); Serial.print(soundPeak);
  Serial.print(F(",\"soundVolts\":")); Serial.print(soundVolts, 3);
  Serial.print(F(",\"soundLevel\":")); Serial.print(soundLevel, 3);
  Serial.println(F("}"));
}
