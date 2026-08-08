#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include <SPI.h>
#include <MFRC522.h>

#include <ArduinoJson.h>

/*
 * ============================================================
 * NEXTY RFID - REGISTRATION + ATTENDANCE READER
 * ============================================================
 *
 * Board:
 * ESP32 DevKit V1 30 Pin
 *
 * Hardware:
 * - RC522 RFID Reader
 * - Buzzer
 *
 * Backend:
 * Next.js + Firestore
 *
 * API:
 * https://iot-rfid-beige.vercel.app
 *
 * FLOW:
 *
 * Jika ada sesi registrasi aktif:
 *   RFID -> Registrasi kartu
 *
 * Jika tidak ada sesi registrasi:
 *   RFID terdaftar -> Absensi
 *
 * Scan pertama:
 *   ATTENDANCE_CHECK_IN
 *
 * Scan kedua:
 *   ATTENDANCE_CHECK_OUT
 *
 * Scan berikutnya:
 *   ATTENDANCE_ALREADY_COMPLETE
 *
 * ============================================================
 */

// ============================================================
// WIFI
// ============================================================

const char* WIFI_SSID = "gwe";
const char* WIFI_PASSWORD = "12345678";

// ============================================================
// API SERVER
// ============================================================

const char* API_BASE_URL =
  "https://iot-rfid-beige.vercel.app";

const char* FIRMWARE_VERSION =
  "1.3.0";

// ============================================================
// ESP32 DEVKIT V1 PIN
// ============================================================
//
// RC522:
//
// SDA / SS  -> GPIO 5
// SCK       -> GPIO 18
// MOSI      -> GPIO 23
// MISO      -> GPIO 19
// RST       -> GPIO 27
//
// Buzzer:
//
// SIGNAL    -> GPIO 26
//
// ============================================================

#define RFID_SS_PIN     5
#define RFID_RST_PIN    27

#define RFID_SCK_PIN    18
#define RFID_MISO_PIN   19
#define RFID_MOSI_PIN   23

#define BUZZER_PIN      26

// ============================================================
// CONFIG
// ============================================================

const bool BUZZER_ACTIVE_HIGH = true;

const bool ENABLE_HEARTBEAT = true;

/*
 * Mencegah kartu sama dikirim terlalu cepat.
 *
 * 3 detik cukup aman untuk menghindari
 * accidental double scan.
 */
const unsigned long CARD_COOLDOWN_MS =
  3000;

/*
 * WiFi reconnect setiap 5 detik.
 */
const unsigned long WIFI_RETRY_INTERVAL_MS =
  5000;

/*
 * Heartbeat ke server setiap 60 detik.
 */
const unsigned long HEARTBEAT_INTERVAL_MS =
  60000;

/*
 * HTTP timeout.
 */
const unsigned long HTTP_TIMEOUT_MS =
  10000;

/*
 * WiFi connection timeout.
 */
const unsigned long WIFI_CONNECT_TIMEOUT_MS =
  15000;

// ============================================================
// RFID OBJECT
// ============================================================

MFRC522 rfid(
  RFID_SS_PIN,
  RFID_RST_PIN
);

// ============================================================
// STATE
// ============================================================

unsigned long lastWiFiAttempt = 0;

unsigned long lastHeartbeat = 0;

unsigned long lastCardReadAt = 0;

String lastUid = "";

bool rfidReady = false;

// ============================================================
// BUZZER
// ============================================================

void buzzerWrite(bool state) {
  if (BUZZER_ACTIVE_HIGH) {
    digitalWrite(
      BUZZER_PIN,
      state ? HIGH : LOW
    );
  } else {
    digitalWrite(
      BUZZER_PIN,
      state ? LOW : HIGH
    );
  }
}

// ============================================================

void beep(unsigned int durationMs) {
  buzzerWrite(true);

  delay(durationMs);

  buzzerWrite(false);
}

// ============================================================
// SUCCESS
//
// BEEEEEEP
// ============================================================

void beepSuccess() {
  beep(400);
}

// ============================================================
// CHECK IN
//
// BEEP
// ============================================================

void beepCheckIn() {
  beep(250);
}

// ============================================================
// CHECK OUT
//
// BEEP BEEP
// ============================================================

void beepCheckOut() {
  beep(180);

  delay(100);

  beep(350);
}

// ============================================================
// WARNING
//
// BEEP BEEP
// ============================================================

void beepWarning() {
  beep(120);

  delay(100);

  beep(120);
}

// ============================================================
// ERROR
//
// BEEP BEEP BEEP
// ============================================================

void beepError() {
  beep(100);

  delay(80);

  beep(100);

  delay(80);

  beep(100);
}

// ============================================================
// BOOT READY
// ============================================================

void beepReady() {
  beep(100);
}

// ============================================================
// WIFI INFORMATION
// ============================================================

void printWiFiInformation() {
  if (
    WiFi.status() != WL_CONNECTED
  ) {
    return;
  }

  Serial.println();

  Serial.println(
    "--------------------------------------------"
  );

  Serial.println(
    "[WIFI] CONNECTION INFORMATION"
  );

  Serial.print(
    "[WIFI] SSID    : "
  );

  Serial.println(
    WiFi.SSID()
  );

  Serial.print(
    "[WIFI] IP      : "
  );

  Serial.println(
    WiFi.localIP()
  );

  Serial.print(
    "[WIFI] Gateway : "
  );

  Serial.println(
    WiFi.gatewayIP()
  );

  Serial.print(
    "[WIFI] RSSI    : "
  );

  Serial.print(
    WiFi.RSSI()
  );

  Serial.println(
    " dBm"
  );

  Serial.println(
    "--------------------------------------------"
  );

  Serial.println();
}

// ============================================================
// WIFI CONNECT
// ============================================================

bool connectWiFi() {
  if (
    WiFi.status() == WL_CONNECTED
  ) {
    return true;
  }

  Serial.println();

  Serial.println(
    "[WIFI] Connecting..."
  );

  Serial.print(
    "[WIFI] SSID: "
  );

  Serial.println(
    WIFI_SSID
  );

  WiFi.mode(
    WIFI_STA
  );

  WiFi.disconnect();

  delay(100);

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

  unsigned long startedAt =
    millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startedAt <
      WIFI_CONNECT_TIMEOUT_MS
  ) {
    delay(400);

    Serial.print(".");
  }

  Serial.println();

  // ==========================================================
  // CONNECTED
  // ==========================================================

  if (
    WiFi.status() == WL_CONNECTED
  ) {
    Serial.println(
      "[WIFI] Connected."
    );

    printWiFiInformation();

    return true;
  }

  // ==========================================================
  // FAILED
  // ==========================================================

  Serial.println(
    "[WIFI] Connection failed."
  );

  Serial.println(
    "[WIFI] Reconnect otomatis akan dicoba."
  );

  return false;
}

// ============================================================
// MAINTAIN WIFI
// ============================================================

void maintainWiFi() {
  if (
    WiFi.status() == WL_CONNECTED
  ) {
    return;
  }

  unsigned long now =
    millis();

  if (
    now - lastWiFiAttempt <
    WIFI_RETRY_INTERVAL_MS
  ) {
    return;
  }

  lastWiFiAttempt =
    now;

  Serial.println();

  Serial.println(
    "[WIFI] Connection lost."
  );

  Serial.println(
    "[WIFI] Reconnecting..."
  );

  connectWiFi();
}

// ============================================================
// GET RFID UID
// ============================================================

String getCardUid() {
  String uid = "";

  for (
    byte i = 0;
    i < rfid.uid.size;
    i++
  ) {
    if (
      rfid.uid.uidByte[i] <
      0x10
    ) {
      uid += "0";
    }

    uid += String(
      rfid.uid.uidByte[i],
      HEX
    );
  }

  uid.toUpperCase();

  return uid;
}

// ============================================================
// DUPLICATE LOCAL
// ============================================================

bool isLocalDuplicate(
  const String& uid
) {
  unsigned long now =
    millis();

  if (
    uid == lastUid &&
    now - lastCardReadAt <
      CARD_COOLDOWN_MS
  ) {
    return true;
  }

  lastUid =
    uid;

  lastCardReadAt =
    now;

  return false;
}

// ============================================================
// RFID HALT
// ============================================================

void haltCard() {
  rfid.PICC_HaltA();

  rfid.PCD_StopCrypto1();
}

// ============================================================
// HTTP INIT
// ============================================================

bool beginHttp(
  HTTPClient& http,
  WiFiClientSecure& client,
  const String& url
) {
  /*
   * Prototype:
   * HTTPS dipakai tetapi root CA belum diverifikasi.
   */

  client.setInsecure();

  client.setHandshakeTimeout(
    10
  );

  if (
    !http.begin(
      client,
      url
    )
  ) {
    Serial.println(
      "[HTTP] Failed to initialize."
    );

    return false;
  }

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "Accept",
    "application/json"
  );

  http.setTimeout(
    HTTP_TIMEOUT_MS
  );

  return true;
}

// ============================================================
// HANDLE SCAN RESPONSE
// ============================================================

void handleScanResponse(
  int httpCode,
  const String& responseBody
) {
  Serial.println();

  Serial.println(
    "============================================"
  );

  Serial.println(
    "[API] RFID RESPONSE"
  );

  Serial.print(
    "[API] HTTP    : "
  );

  Serial.println(
    httpCode
  );

  Serial.print(
    "[API] Response: "
  );

  if (
    responseBody.length() > 0
  ) {
    Serial.println(
      responseBody
    );
  } else {
    Serial.println(
      "(empty)"
    );
  }

  Serial.println(
    "============================================"
  );

  // ==========================================================
  // PARSE JSON
  // ==========================================================

  JsonDocument responseJson;

  String code = "";

  String message = "";

  String mode = "";

  String employeeName = "";

  String attendanceType = "";

  DeserializationError jsonError =
    deserializeJson(
      responseJson,
      responseBody
    );

  if (!jsonError) {
    code =
      responseJson["code"] |
      "";

    message =
      responseJson["message"] |
      "";

    mode =
      responseJson["mode"] |
      "";

    employeeName =
      responseJson["employeeName"] |
      "";

    attendanceType =
      responseJson["attendanceType"] |
      "";
  } else {
    Serial.print(
      "[JSON] Parse error: "
    );

    Serial.println(
      jsonError.c_str()
    );
  }

  // ==========================================================
  // REGISTRATION SUCCESS
  // ==========================================================

  if (
    code ==
    "CARD_REGISTERED"
  ) {
    Serial.println();

    Serial.println(
      "[RFID] REGISTRATION SUCCESS"
    );

    if (
      message.length() > 0
    ) {
      Serial.print(
        "[RFID] "
      );

      Serial.println(
        message
      );
    }

    beepSuccess();

    return;
  }

  // ==========================================================
  // ATTENDANCE CHECK IN
  // ==========================================================

  if (
    code ==
    "ATTENDANCE_CHECK_IN"
  ) {
    Serial.println();

    Serial.println(
      "[ATTENDANCE] CHECK IN SUCCESS"
    );

    if (
      employeeName.length() > 0
    ) {
      Serial.print(
        "[ATTENDANCE] Employee: "
      );

      Serial.println(
        employeeName
      );
    }

    if (
      message.length() > 0
    ) {
      Serial.print(
        "[ATTENDANCE] "
      );

      Serial.println(
        message
      );
    }

    /*
     * 1 beep untuk masuk.
     */
    beepCheckIn();

    return;
  }

  // ==========================================================
  // ATTENDANCE CHECK OUT
  // ==========================================================

  if (
    code ==
    "ATTENDANCE_CHECK_OUT"
  ) {
    Serial.println();

    Serial.println(
      "[ATTENDANCE] CHECK OUT SUCCESS"
    );

    if (
      employeeName.length() > 0
    ) {
      Serial.print(
        "[ATTENDANCE] Employee: "
      );

      Serial.println(
        employeeName
      );
    }

    if (
      message.length() > 0
    ) {
      Serial.print(
        "[ATTENDANCE] "
      );

      Serial.println(
        message
      );
    }

    /*
     * Pola khusus check out.
     */
    beepCheckOut();

    return;
  }

  // ==========================================================
  // ATTENDANCE COMPLETE
  // ==========================================================

  if (
    code ==
    "ATTENDANCE_ALREADY_COMPLETE"
  ) {
    Serial.println();

    Serial.println(
      "[ATTENDANCE] WARNING"
    );

    Serial.println(
      "[ATTENDANCE] Absensi hari ini sudah lengkap."
    );

    if (
      employeeName.length() > 0
    ) {
      Serial.print(
        "[ATTENDANCE] Employee: "
      );

      Serial.println(
        employeeName
      );
    }

    beepWarning();

    return;
  }

  // ==========================================================
  // CARD NOT REGISTERED
  // ==========================================================

  if (
    code ==
    "CARD_NOT_REGISTERED"
  ) {
    Serial.println();

    Serial.println(
      "[RFID] WARNING"
    );

    Serial.println(
      "[RFID] Kartu belum terdaftar."
    );

    beepWarning();

    return;
  }

  // ==========================================================
  // CARD ALREADY REGISTERED
  //
  // Terjadi apabila admin sedang membuka sesi
  // registrasi lalu kartu yang sudah terdaftar discan.
  // ==========================================================

  if (
    code ==
    "CARD_ALREADY_REGISTERED"
  ) {
    Serial.println();

    Serial.println(
      "[RFID] WARNING"
    );

    Serial.println(
      "[RFID] Kartu sudah digunakan."
    );

    if (
      message.length() > 0
    ) {
      Serial.print(
        "[RFID] "
      );

      Serial.println(
        message
      );
    }

    beepWarning();

    return;
  }

  // ==========================================================
  // EMPLOYEE ALREADY HAS CARD
  // ==========================================================

  if (
    code ==
    "EMPLOYEE_ALREADY_HAS_CARD"
  ) {
    Serial.println();

    Serial.println(
      "[RFID] WARNING"
    );

    Serial.println(
      "[RFID] Karyawan sudah memiliki RFID."
    );

    beepWarning();

    return;
  }

  // ==========================================================
  // EMPLOYEE INACTIVE
  // ==========================================================

  if (
    code ==
    "EMPLOYEE_INACTIVE"
  ) {
    Serial.println();

    Serial.println(
      "[ATTENDANCE] WARNING"
    );

    Serial.println(
      "[ATTENDANCE] Karyawan sedang tidak aktif."
    );

    if (
      employeeName.length() > 0
    ) {
      Serial.print(
        "[ATTENDANCE] Employee: "
      );

      Serial.println(
        employeeName
      );
    }

    beepWarning();

    return;
  }

  // ==========================================================
  // EMPLOYEE NOT FOUND
  // ==========================================================

  if (
    code ==
    "EMPLOYEE_NOT_FOUND"
  ) {
    Serial.println();

    Serial.println(
      "[RFID] ERROR"
    );

    Serial.println(
      "[RFID] Data karyawan tidak ditemukan."
    );

    beepError();

    return;
  }

  // ==========================================================
  // INVALID SESSION
  // ==========================================================

  if (
    code ==
    "INVALID_SESSION"
  ) {
    Serial.println();

    Serial.println(
      "[RFID] WARNING"
    );

    Serial.println(
      "[RFID] Sesi registrasi tidak valid."
    );

    beepWarning();

    return;
  }

  // ==========================================================
  // INVALID UID
  // ==========================================================

  if (
    code ==
    "INVALID_UID"
  ) {
    Serial.println();

    Serial.println(
      "[RFID] ERROR"
    );

    Serial.println(
      "[RFID] Format UID tidak valid."
    );

    beepError();

    return;
  }

  // ==========================================================
  // GENERIC SUCCESS
  // ==========================================================

  if (
    httpCode >= 200 &&
    httpCode < 300
  ) {
    Serial.println();

    Serial.println(
      "[API] SUCCESS"
    );

    if (
      mode.length() > 0
    ) {
      Serial.print(
        "[API] Mode: "
      );

      Serial.println(
        mode
      );
    }

    if (
      attendanceType.length() > 0
    ) {
      Serial.print(
        "[API] Attendance Type: "
      );

      Serial.println(
        attendanceType
      );
    }

    if (
      message.length() > 0
    ) {
      Serial.print(
        "[API] "
      );

      Serial.println(
        message
      );
    }

    beepSuccess();

    return;
  }

  // ==========================================================
  // SERVER ERROR
  // ==========================================================

  if (
    httpCode >= 500
  ) {
    Serial.println();

    Serial.println(
      "[API] SERVER ERROR"
    );

    if (
      message.length() > 0
    ) {
      Serial.println(
        message
      );
    }

    beepError();

    return;
  }

  // ==========================================================
  // UNKNOWN RESPONSE
  // ==========================================================

  Serial.println();

  Serial.println(
    "[API] Unexpected response."
  );

  if (
    code.length() > 0
  ) {
    Serial.print(
      "[API] Code: "
    );

    Serial.println(
      code
    );
  }

  if (
    message.length() > 0
  ) {
    Serial.print(
      "[API] Message: "
    );

    Serial.println(
      message
    );
  }

  beepError();
}

// ============================================================
// SEND RFID SCAN
// ============================================================

void sendCardToServer(
  const String& uid
) {
  // ==========================================================
  // WIFI CHECK
  // ==========================================================

  if (
    WiFi.status() != WL_CONNECTED
  ) {
    Serial.println();

    Serial.println(
      "[RFID] ERROR"
    );

    Serial.println(
      "[RFID] WiFi offline."
    );

    Serial.println(
      "[RFID] UID tidak dikirim ke server."
    );

    beepError();

    return;
  }

  // ==========================================================
  // URL
  // ==========================================================

  String url =
    String(
      API_BASE_URL
    ) +
    "/api/device/register-scan";

  WiFiClientSecure client;

  HTTPClient http;

  if (
    !beginHttp(
      http,
      client,
      url
    )
  ) {
    beepError();

    return;
  }

  // ==========================================================
  // JSON
  // ==========================================================

  JsonDocument payload;

  payload["uid"] =
    uid;

  /*
   * type sekarang lebih tepat kita sebut
   * hybrid karena reader bisa dipakai:
   *
   * - registration
   * - attendance
   *
   * Namun backend kita masih kompatibel
   * jika type tetap registration.
   */

  payload["type"] =
    "registration";

  payload["firmwareVersion"] =
    FIRMWARE_VERSION;

  payload["wifiRssi"] =
    WiFi.RSSI();

  payload["uptimeSeconds"] =
    millis() /
    1000UL;

  String requestBody = "";

  serializeJson(
    payload,
    requestBody
  );

  // ==========================================================
  // DEBUG
  // ==========================================================

  Serial.println();

  Serial.println(
    "[API] Sending RFID scan..."
  );

  Serial.print(
    "[API] POST : "
  );

  Serial.println(
    url
  );

  Serial.print(
    "[API] JSON : "
  );

  Serial.println(
    requestBody
  );

  // ==========================================================
  // REQUEST
  // ==========================================================

  int httpCode =
    http.POST(
      requestBody
    );

  // ==========================================================
  // NETWORK ERROR
  // ==========================================================

  if (
    httpCode <= 0
  ) {
    Serial.println();

    Serial.print(
      "[API] Connection error: "
    );

    Serial.println(
      http.errorToString(
        httpCode
      )
    );

    beepError();

    http.end();

    return;
  }

  // ==========================================================
  // RESPONSE
  // ==========================================================

  String responseBody =
    http.getString();

  handleScanResponse(
    httpCode,
    responseBody
  );

  http.end();
}

// ============================================================
// HEARTBEAT
// ============================================================

void sendHeartbeat() {
  if (
    !ENABLE_HEARTBEAT
  ) {
    return;
  }

  if (
    WiFi.status() != WL_CONNECTED
  ) {
    return;
  }

  String url =
    String(
      API_BASE_URL
    ) +
    "/api/device/heartbeat";

  WiFiClientSecure client;

  HTTPClient http;

  if (
    !beginHttp(
      http,
      client,
      url
    )
  ) {
    Serial.println(
      "[HEARTBEAT] HTTP init failed."
    );

    return;
  }

  // ==========================================================
  // JSON PAYLOAD
  // ==========================================================

  JsonDocument payload;

  payload["type"] =
    "registration";

  payload["firmwareVersion"] =
    FIRMWARE_VERSION;

  payload["wifiRssi"] =
    WiFi.RSSI();

  payload["uptimeSeconds"] =
    millis() /
    1000UL;

  String requestBody = "";

  serializeJson(
    payload,
    requestBody
  );

  // ==========================================================
  // SEND
  // ==========================================================

  Serial.println();

  Serial.println(
    "[HEARTBEAT] Sending..."
  );

  Serial.print(
    "[HEARTBEAT] POST : "
  );

  Serial.println(
    url
  );

  int httpCode =
    http.POST(
      requestBody
    );

  Serial.print(
    "[HEARTBEAT] HTTP : "
  );

  Serial.println(
    httpCode
  );

  // ==========================================================
  // RESPONSE
  // ==========================================================

  if (
    httpCode > 0
  ) {
    String responseBody =
      http.getString();

    if (
      responseBody.length() > 0
    ) {
      Serial.print(
        "[HEARTBEAT] Response: "
      );

      Serial.println(
        responseBody
      );
    }

    if (
      httpCode >= 200 &&
      httpCode < 300
    ) {
      Serial.println(
        "[HEARTBEAT] Accepted."
      );
    } else {
      Serial.println(
        "[HEARTBEAT] Rejected."
      );
    }
  } else {
    Serial.print(
      "[HEARTBEAT] Connection error: "
    );

    Serial.println(
      http.errorToString(
        httpCode
      )
    );
  }

  http.end();
}

// ============================================================
// RFID INITIALIZATION
// ============================================================

void initializeRFID() {
  Serial.println();

  Serial.println(
    "[RFID] Initializing SPI..."
  );

  SPI.begin(
    RFID_SCK_PIN,
    RFID_MISO_PIN,
    RFID_MOSI_PIN,
    RFID_SS_PIN
  );

  delay(50);

  Serial.println(
    "[RFID] Initializing RC522..."
  );

  rfid.PCD_Init();

  delay(100);

  /*
   * Maksimalkan antenna gain.
   */
  rfid.PCD_SetAntennaGain(
    MFRC522::RxGain_max
  );

  byte version =
    rfid.PCD_ReadRegister(
      MFRC522::VersionReg
    );

  Serial.print(
    "[RFID] Version register: 0x"
  );

  Serial.println(
    version,
    HEX
  );

  // ==========================================================
  // ERROR
  // ==========================================================

  if (
    version == 0x00 ||
    version == 0xFF
  ) {
    Serial.println();

    Serial.println(
      "[RFID] RC522 NOT DETECTED!"
    );

    Serial.println(
      "[RFID] Periksa wiring."
    );

    Serial.println(
      "[RFID] 3.3V -> 3.3V"
    );

    Serial.println(
      "[RFID] GND  -> GND"
    );

    Serial.println(
      "[RFID] SDA  -> GPIO 5"
    );

    Serial.println(
      "[RFID] SCK  -> GPIO 18"
    );

    Serial.println(
      "[RFID] MOSI -> GPIO 23"
    );

    Serial.println(
      "[RFID] MISO -> GPIO 19"
    );

    Serial.println(
      "[RFID] RST  -> GPIO 27"
    );

    rfidReady =
      false;

    beepError();

    return;
  }

  // ==========================================================
  // READY
  // ==========================================================

  rfidReady =
    true;

  Serial.println(
    "[RFID] RC522 ready."
  );

  beepReady();
}

// ============================================================
// SYSTEM INFORMATION
// ============================================================

void printSystemInformation() {
  Serial.println();

  Serial.println(
    "============================================"
  );

  Serial.println(
    "        NEXTY RFID ATTENDANCE SYSTEM"
  );

  Serial.println(
    "============================================"
  );

  Serial.println(
    "Mode       : Registration + Attendance"
  );

  Serial.print(
    "Firmware   : "
  );

  Serial.println(
    FIRMWARE_VERSION
  );

  Serial.print(
    "API Server : "
  );

  Serial.println(
    API_BASE_URL
  );

  Serial.println(
    "--------------------------------------------"
  );

  Serial.println(
    "RC522 Wiring"
  );

  Serial.print(
    "SDA / SS   : GPIO "
  );

  Serial.println(
    RFID_SS_PIN
  );

  Serial.print(
    "SCK        : GPIO "
  );

  Serial.println(
    RFID_SCK_PIN
  );

  Serial.print(
    "MOSI       : GPIO "
  );

  Serial.println(
    RFID_MOSI_PIN
  );

  Serial.print(
    "MISO       : GPIO "
  );

  Serial.println(
    RFID_MISO_PIN
  );

  Serial.print(
    "RST        : GPIO "
  );

  Serial.println(
    RFID_RST_PIN
  );

  Serial.print(
    "Buzzer     : GPIO "
  );

  Serial.println(
    BUZZER_PIN
  );

  Serial.println(
    "============================================"
  );

  Serial.println();
}

// ============================================================
// SETUP
// ============================================================

void setup() {
  // ==========================================================
  // SERIAL
  // ==========================================================

  Serial.begin(
    115200
  );

  delay(700);

  printSystemInformation();

  // ==========================================================
  // BUZZER
  // ==========================================================

  pinMode(
    BUZZER_PIN,
    OUTPUT
  );

  buzzerWrite(
    false
  );

  // ==========================================================
  // RFID
  // ==========================================================

  initializeRFID();

  // ==========================================================
  // WIFI
  // ==========================================================

  Serial.println();

  Serial.println(
    "[SYSTEM] Connecting WiFi..."
  );

  bool wifiConnected =
    connectWiFi();

  // ==========================================================
  // FIRST HEARTBEAT
  // ==========================================================

  if (
    wifiConnected &&
    ENABLE_HEARTBEAT
  ) {
    Serial.println(
      "[SYSTEM] Sending initial heartbeat..."
    );

    sendHeartbeat();

    lastHeartbeat =
      millis();
  }

  // ==========================================================
  // READY
  // ==========================================================

  Serial.println();

  Serial.println(
    "============================================"
  );

  if (
    rfidReady
  ) {
    Serial.println(
      "[SYSTEM] READY"
    );

    Serial.println(
      "[SYSTEM] Tempelkan kartu RFID."
    );

    Serial.println();

    Serial.println(
      "[SYSTEM] Flow:"
    );

    Serial.println(
      "[SYSTEM] Registration session ON -> Register"
    );

    Serial.println(
      "[SYSTEM] Registration session OFF -> Attendance"
    );
  } else {
    Serial.println(
      "[SYSTEM] RFID NOT READY"
    );

    Serial.println(
      "[SYSTEM] Periksa RC522."
    );
  }

  Serial.println(
    "============================================"
  );

  Serial.println();
}

// ============================================================
// LOOP
// ============================================================

void loop() {
  // ==========================================================
  // WIFI
  // ==========================================================

  maintainWiFi();

  // ==========================================================
  // HEARTBEAT
  // ==========================================================

  if (
    ENABLE_HEARTBEAT &&
    WiFi.status() == WL_CONNECTED
  ) {
    unsigned long now =
      millis();

    if (
      now - lastHeartbeat >=
      HEARTBEAT_INTERVAL_MS
    ) {
      lastHeartbeat =
        now;

      sendHeartbeat();
    }
  }

  // ==========================================================
  // RFID READY
  // ==========================================================

  if (
    !rfidReady
  ) {
    delay(500);

    return;
  }

  // ==========================================================
  // NEW CARD
  // ==========================================================

  if (
    !rfid.PICC_IsNewCardPresent()
  ) {
    delay(10);

    return;
  }

  // ==========================================================
  // READ CARD
  // ==========================================================

  if (
    !rfid.PICC_ReadCardSerial()
  ) {
    delay(10);

    return;
  }

  // ==========================================================
  // UID
  // ==========================================================

  String uid =
    getCardUid();

  Serial.println();

  Serial.println(
    "============================================"
  );

  Serial.println(
    "[RFID] CARD DETECTED"
  );

  Serial.print(
    "[RFID] UID       : "
  );

  Serial.println(
    uid
  );

  Serial.print(
    "[RFID] UID Size  : "
  );

  Serial.print(
    rfid.uid.size
  );

  Serial.println(
    " byte"
  );

  if (
    WiFi.status() == WL_CONNECTED
  ) {
    Serial.print(
      "[RFID] WiFi RSSI : "
    );

    Serial.print(
      WiFi.RSSI()
    );

    Serial.println(
      " dBm"
    );
  }

  Serial.println(
    "============================================"
  );

  // ==========================================================
  // LOCAL DUPLICATE
  // ==========================================================

  if (
    isLocalDuplicate(
      uid
    )
  ) {
    Serial.println();

    Serial.println(
      "[RFID] Duplicate lokal diabaikan."
    );

    haltCard();

    delay(50);

    return;
  }

  // ==========================================================
  // SEND
  // ==========================================================

  sendCardToServer(
    uid
  );

  // ==========================================================
  // HALT CARD
  // ==========================================================

  haltCard();

  Serial.println();

  Serial.println(
    "[SYSTEM] Ready for next card."
  );

  Serial.println();
}