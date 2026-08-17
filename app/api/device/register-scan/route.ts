import { NextResponse } from "next/server";

import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  isValidRfidUid,
  normalizeRfidUid,
  sanitizeText,
  sanitizeWifiRssi,
} from "@/lib/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// READER
// ============================================================

const READER_DOCUMENT = "registration-reader";

// ============================================================
// SETTINGS
// ============================================================

const ATTENDANCE_SETTINGS_DOCUMENT = "attendance-settings";

// ============================================================
// DEFAULT ATTENDANCE SETTINGS
// ============================================================

const DEFAULT_ATTENDANCE_SETTINGS = {
  checkInOpen: "06:00",

  workStart: "09:00",

  lateStart: "09:16",

  checkInClose: "12:00",

  checkOutOpen: "15:00",

  normalCheckOut: "17:00",

  minimumWorkDurationMinutes: 300,

  timezone: "Asia/Jakarta",
};

// ============================================================
// REQUEST
// ============================================================

interface RegisterScanBody {
  uid?: unknown;

  type?: unknown;

  firmwareVersion?: unknown;

  wifiRssi?: unknown;

  uptimeSeconds?: unknown;
}

// ============================================================
// ATTENDANCE SETTINGS
// ============================================================

interface AttendanceRules {
  checkInOpen: string;

  workStart: string;

  lateStart: string;

  checkInClose: string;

  checkOutOpen: string;

  normalCheckOut: string;

  checkInOpenMinutes: number;

  workStartMinutes: number;

  lateStartMinutes: number;

  checkInCloseMinutes: number;

  checkOutOpenMinutes: number;

  normalCheckOutMinutes: number;

  minimumWorkDurationMinutes: number;

  minimumWorkDurationMs: number;

  timezone: string;
}

// ============================================================
// ATTENDANCE TYPES
// ============================================================

type CheckInStatus = "early" | "on_time" | "late";

type CheckOutStatus = "early" | "normal";

type CheckOutBlockedReason = "before_checkout_window" | "minimum_duration";

// ============================================================
// SCAN RESULT
// ============================================================

type ScanResult =
  | {
      type: "registration_success";

      employeeName: string;
    }
  | {
      type: "card_already_registered";

      employeeName: string | null;
    }
  | {
      type: "employee_already_has_card";
    }
  | {
      type: "employee_not_found";
    }
  | {
      type: "invalid_session";
    }
  | {
      type: "card_not_registered";
    }
  | {
      type: "card_inactive";

      employeeName: string | null;
    }
  | {
      type: "employee_inactive";

      employeeName: string;
    }
  | {
      type: "check_in_too_early";

      employeeName: string;
    }
  | {
      type: "check_in_closed";

      employeeName: string;
    }
  | {
      type: "attendance_check_in";

      employeeName: string;

      checkInStatus: CheckInStatus;

      lateMinutes: number;
    }
  | {
      type: "check_out_too_early";

      employeeName: string;

      reason: CheckOutBlockedReason;

      remainingMinutes: number;
    }
  | {
      type: "attendance_check_out";

      employeeName: string;

      checkOutStatus: CheckOutStatus;

      workDurationMinutes: number;
    }
  | {
      type: "attendance_complete";

      employeeName: string;
    };

// ============================================================
// SETTINGS HELPERS
// ============================================================

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

// ============================================================

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

// ============================================================

function createAttendanceRules(
  data?: Record<string, unknown>,
): AttendanceRules {
  const checkInOpen = isValidTime(data?.checkInOpen)
    ? data.checkInOpen
    : DEFAULT_ATTENDANCE_SETTINGS.checkInOpen;

  const workStart = isValidTime(data?.workStart)
    ? data.workStart
    : DEFAULT_ATTENDANCE_SETTINGS.workStart;

  const lateStart = isValidTime(data?.lateStart)
    ? data.lateStart
    : DEFAULT_ATTENDANCE_SETTINGS.lateStart;

  const checkInClose = isValidTime(data?.checkInClose)
    ? data.checkInClose
    : DEFAULT_ATTENDANCE_SETTINGS.checkInClose;

  const checkOutOpen = isValidTime(data?.checkOutOpen)
    ? data.checkOutOpen
    : DEFAULT_ATTENDANCE_SETTINGS.checkOutOpen;

  const normalCheckOut = isValidTime(data?.normalCheckOut)
    ? data.normalCheckOut
    : DEFAULT_ATTENDANCE_SETTINGS.normalCheckOut;

  let minimumWorkDurationMinutes =
    typeof data?.minimumWorkDurationMinutes === "number" &&
    Number.isFinite(data.minimumWorkDurationMinutes)
      ? Math.floor(data.minimumWorkDurationMinutes)
      : DEFAULT_ATTENDANCE_SETTINGS.minimumWorkDurationMinutes;

  if (minimumWorkDurationMinutes < 60 || minimumWorkDurationMinutes > 720) {
    minimumWorkDurationMinutes =
      DEFAULT_ATTENDANCE_SETTINGS.minimumWorkDurationMinutes;
  }

  const checkInOpenMinutes = timeToMinutes(checkInOpen);

  const workStartMinutes = timeToMinutes(workStart);

  const lateStartMinutes = timeToMinutes(lateStart);

  const checkInCloseMinutes = timeToMinutes(checkInClose);

  const checkOutOpenMinutes = timeToMinutes(checkOutOpen);

  const normalCheckOutMinutes = timeToMinutes(normalCheckOut);

  /*
   * Safety validation.
   *
   * Walaupun API settings sudah melakukan validasi,
   * backend scan tetap memverifikasi supaya data Firestore
   * yang berubah manual tidak merusak business rule.
   */

  const validCheckInFlow =
    checkInOpenMinutes <= workStartMinutes &&
    workStartMinutes <= lateStartMinutes &&
    lateStartMinutes <= checkInCloseMinutes;

  const validCheckOutFlow = checkOutOpenMinutes <= normalCheckOutMinutes;

  if (!validCheckInFlow || !validCheckOutFlow) {
    return createAttendanceRules();
  }

  return {
    checkInOpen,

    workStart,

    lateStart,

    checkInClose,

    checkOutOpen,

    normalCheckOut,

    checkInOpenMinutes,

    workStartMinutes,

    lateStartMinutes,

    checkInCloseMinutes,

    checkOutOpenMinutes,

    normalCheckOutMinutes,

    minimumWorkDurationMinutes,

    minimumWorkDurationMs: minimumWorkDurationMinutes * 60 * 1000,

    timezone: "Asia/Jakarta",
  };
}

// ============================================================
// LOAD SETTINGS
// ============================================================

async function loadAttendanceRules() {
  try {
    const settingsRef = doc(db, "system", ATTENDANCE_SETTINGS_DOCUMENT);

    const snapshot = await getDoc(settingsRef);

    if (!snapshot.exists()) {
      return createAttendanceRules();
    }

    return createAttendanceRules(snapshot.data());
  } catch (error) {
    /*
     * Scan tidak boleh mati hanya karena setting
     * tidak bisa dibaca.
     *
     * Gunakan default sebagai fallback.
     */

    console.error("[ATTENDANCE SETTINGS FALLBACK]", error);

    return createAttendanceRules();
  }
}

// ============================================================
// JAKARTA TIME
// ============================================================

interface JakartaDateTime {
  year: string;

  month: string;

  day: string;

  hour: number;

  minute: number;
}

function getJakartaDateTime(date: Date = new Date()): JakartaDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

    hour: "2-digit",

    minute: "2-digit",

    hourCycle: "h23",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";

  const month = parts.find((part) => part.type === "month")?.value ?? "";

  const day = parts.find((part) => part.type === "day")?.value ?? "";

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  return {
    year,

    month,

    day,

    hour,

    minute,
  };
}

// ============================================================
// DATE KEY
// ============================================================

function getJakartaDateKey(date: Date = new Date()) {
  const jakarta = getJakartaDateTime(date);

  return `${jakarta.year}-${jakarta.month}-${jakarta.day}`;
}

// ============================================================
// MINUTES FROM MIDNIGHT
// ============================================================

function getMinutesOfDay(date: Date = new Date()) {
  const jakarta = getJakartaDateTime(date);

  return jakarta.hour * 60 + jakarta.minute;
}

// ============================================================
// CHECK-IN CLASSIFICATION
// ============================================================

function getCheckInStatus(
  minutesOfDay: number,
  rules: AttendanceRules,
): CheckInStatus {
  if (minutesOfDay < rules.workStartMinutes) {
    return "early";
  }

  if (minutesOfDay < rules.lateStartMinutes) {
    return "on_time";
  }

  return "late";
}

// ============================================================
// LATE MINUTES
// ============================================================

function calculateLateMinutes(minutesOfDay: number, rules: AttendanceRules) {
  if (minutesOfDay < rules.lateStartMinutes) {
    return 0;
  }

  return Math.max(0, minutesOfDay - rules.workStartMinutes);
}

// ============================================================
// DURATION FORMAT
// ============================================================

function formatDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));

  const hours = Math.floor(safeMinutes / 60);

  const minutes = safeMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}j`;
  }

  return `${hours}j ${minutes}m`;
}

// ============================================================
// HUMAN DURATION
// ============================================================

function formatDurationLong(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));

  const hours = Math.floor(safeMinutes / 60);

  const minutes = safeMinutes % 60;

  if (hours === 0) {
    return `${minutes} menit`;
  }

  if (minutes === 0) {
    return `${hours} jam`;
  }

  return `${hours} jam ${minutes} menit`;
}

// ============================================================
// FIRESTORE TIMESTAMP -> MILLISECONDS
// ============================================================

function getTimestampMillis(value: unknown): number | null {
  if (!value) {
    return null;
  }

  // Firestore Timestamp

  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const toMillis = (
      value as {
        toMillis?: unknown;
      }
    ).toMillis;

    if (typeof toMillis === "function") {
      try {
        const millis = (toMillis as () => number).call(value);

        return Number.isFinite(millis) ? millis : null;
      } catch {
        return null;
      }
    }
  }

  // Legacy ISO string fallback

  if (typeof value === "string") {
    const millis = new Date(value).getTime();

    return Number.isFinite(millis) ? millis : null;
  }

  return null;
}

// ============================================================
// POST
// ============================================================

export async function POST(request: Request) {
  try {
    // ========================================================
    // REQUEST BODY
    // ========================================================

    const body = (await request.json()) as RegisterScanBody;

    const uid = normalizeRfidUid(body.uid);

    if (!isValidRfidUid(uid)) {
      return NextResponse.json(
        {
          success: false,

          code: "INVALID_UID",

          message: "Format UID RFID tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // LOAD ATTENDANCE RULES
    // ========================================================

    /*
     * Setiap request scan membaca setting terbaru.
     *
     * Artinya perubahan dari halaman /settings
     * langsung berlaku pada scan berikutnya.
     */

    const attendanceRules = await loadAttendanceRules();

    // ========================================================
    // CURRENT SCAN TIME
    // ========================================================

    const scanDate = new Date();

    const scanTimeMinutes = getMinutesOfDay(scanDate);

    const dateKey = getJakartaDateKey(scanDate);

    // ========================================================
    // READER INFORMATION
    // ========================================================

    const readerType = sanitizeText(body.type, 40) || "registration";

    const firmwareVersion = sanitizeText(body.firmwareVersion, 40);

    const wifiRssi = sanitizeWifiRssi(body.wifiRssi);

    const uptimeSeconds =
      typeof body.uptimeSeconds === "number" &&
      Number.isFinite(body.uptimeSeconds)
        ? Math.max(0, Math.floor(body.uptimeSeconds))
        : null;

    // ========================================================
    // BASE REFERENCES
    // ========================================================

    const controlRef = doc(db, "system", "rfid-registration");

    const readerRef = doc(db, "devices", READER_DOCUMENT);

    const cardRef = doc(db, "rfidCards", uid);

    const logRef = doc(collection(db, "scanLogs"));

    // ========================================================
    // READER STATUS
    // ========================================================

    const readerStatus = {
      name: "Registration Reader",

      type: readerType,

      firmwareVersion: firmwareVersion || null,

      wifiRssi,

      uptimeSeconds,

      status: "online",

      lastSeenAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    };

    // ========================================================
    // TRANSACTION
    // ========================================================

    const result = await runTransaction<ScanResult>(db, async (transaction) => {
      // ==================================================
      // CHECK ACTIVE REGISTRATION SESSION
      // ==================================================

      const controlSnapshot = await transaction.get(controlRef);

      const activeSessionId = controlSnapshot.exists()
        ? controlSnapshot.data().activeSessionId
        : null;

      // ==================================================
      // MODE 1:
      // REGISTRATION
      // ==================================================

      if (typeof activeSessionId === "string" && activeSessionId) {
        const sessionRef = doc(db, "registrationSessions", activeSessionId);

        const sessionSnapshot = await transaction.get(sessionRef);

        // ===============================================
        // INVALID SESSION
        // ===============================================

        if (
          !sessionSnapshot.exists() ||
          sessionSnapshot.data().status !== "waiting"
        ) {
          transaction.set(
            controlRef,
            {
              activeSessionId: null,

              updatedAt: serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

          transaction.set(logRef, {
            uid,

            readerType,

            action: "register",

            result: "error",

            code: "INVALID_SESSION",

            employeeId: null,

            employeeName: null,

            message: "Sesi registrasi tidak valid.",

            createdAt: serverTimestamp(),
          });

          return {
            type: "invalid_session",
          };
        }

        const session = sessionSnapshot.data();

        const employeeId =
          typeof session.employeeId === "string" ? session.employeeId : "";

        const employeeRef = doc(db, "employees", employeeId);

        /*
         * Semua READ sebelum WRITE.
         */

        const employeeSnapshot = await transaction.get(employeeRef);

        const cardSnapshot = await transaction.get(cardRef);

        // ===============================================
        // EMPLOYEE NOT FOUND
        // ===============================================

        if (!employeeSnapshot.exists()) {
          transaction.update(sessionRef, {
            status: "failed",

            updatedAt: serverTimestamp(),
          });

          transaction.set(
            controlRef,
            {
              activeSessionId: null,

              lastSessionId: sessionRef.id,

              updatedAt: serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

          transaction.set(logRef, {
            uid,

            readerType,

            action: "register",

            result: "error",

            code: "EMPLOYEE_NOT_FOUND",

            employeeId,

            employeeName: null,

            message: "Data karyawan tidak ditemukan.",

            createdAt: serverTimestamp(),
          });

          return {
            type: "employee_not_found",
          };
        }

        const employee = employeeSnapshot.data();

        // ===============================================
        // CARD ALREADY REGISTERED
        // ===============================================

        if (cardSnapshot.exists()) {
          const existingCard = cardSnapshot.data();

          const existingEmployeeName =
            typeof existingCard.employeeName === "string"
              ? existingCard.employeeName
              : null;

          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

          transaction.set(logRef, {
            uid,

            readerType,

            action: "register",

            result: "warning",

            code: "CARD_ALREADY_REGISTERED",

            employeeId: existingCard.employeeId ?? null,

            employeeName: existingEmployeeName,

            message: existingEmployeeName
              ? `Kartu sudah terdaftar atas nama ${existingEmployeeName}.`
              : "Kartu RFID sudah terdaftar.",

            createdAt: serverTimestamp(),
          });

          return {
            type: "card_already_registered",

            employeeName: existingEmployeeName,
          };
        }

        // ===============================================
        // EMPLOYEE ALREADY HAS CARD
        // ===============================================

        if (typeof employee.rfidUid === "string" && employee.rfidUid) {
          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

          transaction.set(logRef, {
            uid,

            readerType,

            action: "register",

            result: "warning",

            code: "EMPLOYEE_ALREADY_HAS_CARD",

            employeeId: employeeSnapshot.id,

            employeeName: employee.name ?? null,

            message: "Karyawan sudah memiliki kartu RFID.",

            createdAt: serverTimestamp(),
          });

          return {
            type: "employee_already_has_card",
          };
        }

        // ===============================================
        // CREATE RFID CARD
        // ===============================================

        transaction.set(cardRef, {
          uid,

          employeeId: employeeSnapshot.id,

          employeeCode: employee.employeeCode ?? "",

          employeeName: employee.name ?? "",

          status: "active",

          registeredAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        // ===============================================
        // UPDATE EMPLOYEE
        // ===============================================

        transaction.update(employeeRef, {
          rfidUid: uid,

          updatedAt: serverTimestamp(),
        });

        // ===============================================
        // COMPLETE SESSION
        // ===============================================

        transaction.update(sessionRef, {
          status: "completed",

          uid,

          completedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        transaction.set(
          controlRef,
          {
            activeSessionId: null,

            lastSessionId: sessionRef.id,

            updatedAt: serverTimestamp(),
          },
          {
            merge: true,
          },
        );

        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "register",

          result: "success",

          code: "CARD_REGISTERED",

          employeeId: employeeSnapshot.id,

          employeeName: employee.name ?? null,

          message: "RFID berhasil didaftarkan.",

          createdAt: serverTimestamp(),
        });

        return {
          type: "registration_success",

          employeeName: employee.name ?? "",
        };
      }

      // ==================================================
      // MODE 2:
      // ATTENDANCE
      // ==================================================

      const cardSnapshot = await transaction.get(cardRef);

      // ==================================================
      // CARD NOT REGISTERED
      // ==================================================

      if (!cardSnapshot.exists()) {
        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "attendance",

          result: "warning",

          code: "CARD_NOT_REGISTERED",

          employeeId: null,

          employeeName: null,

          message: "Kartu RFID belum terdaftar.",

          createdAt: serverTimestamp(),
        });

        return {
          type: "card_not_registered",
        };
      }

      // ==================================================
      // CARD DATA
      // ==================================================

      const card = cardSnapshot.data();

      const employeeId =
        typeof card.employeeId === "string" ? card.employeeId : "";

      const cardEmployeeName =
        typeof card.employeeName === "string" ? card.employeeName : null;

      // ==================================================
      // CARD INACTIVE
      // ==================================================

      if (card.status === "inactive") {
        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "attendance",

          result: "warning",

          code: "CARD_INACTIVE",

          employeeId: employeeId || null,

          employeeName: cardEmployeeName,

          message: cardEmployeeName
            ? `Kartu RFID milik ${cardEmployeeName} sedang nonaktif.`
            : "Kartu RFID sedang nonaktif.",

          createdAt: serverTimestamp(),
        });

        return {
          type: "card_inactive",

          employeeName: cardEmployeeName,
        };
      }

      const employeeRef = doc(db, "employees", employeeId);

      const attendanceId = `${dateKey}_${employeeId}`;

      const attendanceRef = doc(db, "attendanceRecords", attendanceId);

      /*
       * Semua READ dilakukan sebelum WRITE.
       */

      const employeeSnapshot = await transaction.get(employeeRef);

      const attendanceSnapshot = await transaction.get(attendanceRef);

      // ==================================================
      // EMPLOYEE NOT FOUND
      // ==================================================

      if (!employeeSnapshot.exists()) {
        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "attendance",

          result: "error",

          code: "EMPLOYEE_NOT_FOUND",

          employeeId,

          employeeName: card.employeeName ?? null,

          message: "Kartu terdaftar tetapi data karyawan tidak ditemukan.",

          createdAt: serverTimestamp(),
        });

        return {
          type: "employee_not_found",
        };
      }

      const employee = employeeSnapshot.data();

      const employeeName =
        typeof employee.name === "string" ? employee.name : "";

      // ==================================================
      // EMPLOYEE INACTIVE
      // ==================================================

      if (employee.status !== "active") {
        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "attendance",

          result: "warning",

          code: "EMPLOYEE_INACTIVE",

          employeeId: employeeSnapshot.id,

          employeeName,

          message: "Karyawan sedang tidak aktif.",

          createdAt: serverTimestamp(),
        });

        return {
          type: "employee_inactive",

          employeeName,
        };
      }

      // ==================================================
      // FIRST SCAN TODAY
      // ==================================================

      if (!attendanceSnapshot.exists()) {
        // ================================================
        // CHECK-IN NOT OPEN
        // ================================================

        if (scanTimeMinutes < attendanceRules.checkInOpenMinutes) {
          const message = `Check-in belum dibuka. Check-in dimulai pukul ${attendanceRules.checkInOpen} WIB.`;

          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

          transaction.set(logRef, {
            uid,

            readerType,

            action: "check_in",

            result: "warning",

            code: "CHECK_IN_TOO_EARLY",

            employeeId: employeeSnapshot.id,

            employeeName,

            message,

            createdAt: serverTimestamp(),
          });

          return {
            type: "check_in_too_early",

            employeeName,
          };
        }

        // ================================================
        // CHECK-IN CLOSED
        //
        // Jika setting 12:00:
        // 12:00:00 - 12:00:59 masih diterima
        // 12:01+ ditolak.
        // ================================================

        if (scanTimeMinutes > attendanceRules.checkInCloseMinutes) {
          const message = `Waktu check-in telah berakhir. Check-in hanya sampai pukul ${attendanceRules.checkInClose} WIB.`;

          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

          transaction.set(logRef, {
            uid,

            readerType,

            action: "check_in",

            result: "warning",

            code: "CHECK_IN_TIME_CLOSED",

            employeeId: employeeSnapshot.id,

            employeeName,

            message,

            createdAt: serverTimestamp(),
          });

          return {
            type: "check_in_closed",

            employeeName,
          };
        }

        // ================================================
        // CHECK-IN STATUS
        // ================================================

        const checkInStatus = getCheckInStatus(
          scanTimeMinutes,
          attendanceRules,
        );

        const lateMinutes = calculateLateMinutes(
          scanTimeMinutes,
          attendanceRules,
        );

        let checkInMessage = `${employeeName} berhasil absen masuk.`;

        if (checkInStatus === "early") {
          checkInMessage = `${employeeName} berhasil absen masuk lebih awal.`;
        }

        if (checkInStatus === "on_time") {
          checkInMessage = `${employeeName} berhasil absen masuk tepat waktu.`;
        }

        if (checkInStatus === "late") {
          checkInMessage = `${employeeName} berhasil absen masuk. Terlambat ${formatDuration(
            lateMinutes,
          )}.`;
        }

        // ================================================
        // CREATE ATTENDANCE
        // ================================================

        transaction.set(attendanceRef, {
          dateKey,

          employeeId: employeeSnapshot.id,

          employeeCode: employee.employeeCode ?? "",

          employeeName,

          department: employee.department ?? "",

          position: employee.position ?? "",

          rfidUid: uid,

          status: "checked_in",

          checkInAt: serverTimestamp(),

          checkInStatus,

          lateMinutes,

          checkOutAt: null,

          checkOutStatus: null,

          workDurationMinutes: null,

          createdAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "check_in",

          result: "success",

          code: "ATTENDANCE_CHECK_IN",

          employeeId: employeeSnapshot.id,

          employeeName,

          checkInStatus,

          lateMinutes,

          message: checkInMessage,

          createdAt: serverTimestamp(),
        });

        return {
          type: "attendance_check_in",

          employeeName,

          checkInStatus,

          lateMinutes,
        };
      }

      // ==================================================
      // ATTENDANCE EXISTS
      // ==================================================

      const attendance = attendanceSnapshot.data();

      // ==================================================
      // ALREADY COMPLETE
      // ==================================================

      if (attendance.checkOutAt) {
        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "attendance",

          result: "warning",

          code: "ATTENDANCE_ALREADY_COMPLETE",

          employeeId: employeeSnapshot.id,

          employeeName,

          message: `Absensi ${employeeName} hari ini sudah lengkap.`,

          createdAt: serverTimestamp(),
        });

        return {
          type: "attendance_complete",

          employeeName,
        };
      }

      // ==================================================
      // CHECK-IN TIMESTAMP
      // ==================================================

      const checkInMillis = getTimestampMillis(attendance.checkInAt);

      if (checkInMillis === null) {
        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "check_out",

          result: "warning",

          code: "CHECK_OUT_TOO_EARLY",

          employeeId: employeeSnapshot.id,

          employeeName,

          message:
            "Anda sudah melakukan absen masuk. Waktu check-in belum dapat divalidasi untuk check-out.",

          createdAt: serverTimestamp(),
        });

        return {
          type: "check_out_too_early",

          employeeName,

          reason: "minimum_duration",

          remainingMinutes: attendanceRules.minimumWorkDurationMinutes,
        };
      }

      // ==================================================
      // WORK DURATION
      // ==================================================

      const currentMillis = scanDate.getTime();

      const elapsedMillis = Math.max(0, currentMillis - checkInMillis);

      const workDurationMinutes = Math.floor(elapsedMillis / 60_000);

      const minimumCheckoutMillis =
        checkInMillis + attendanceRules.minimumWorkDurationMs;

      // ==================================================
      // RULE 1:
      // CHECKOUT WINDOW
      // ==================================================

      if (scanTimeMinutes < attendanceRules.checkOutOpenMinutes) {
        const message = `Anda sudah melakukan absen masuk. Check-out baru dapat dilakukan mulai pukul ${attendanceRules.checkOutOpen} WIB dan minimal ${formatDurationLong(
          attendanceRules.minimumWorkDurationMinutes,
        )} setelah check-in.`;

        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "check_out",

          result: "warning",

          code: "CHECK_OUT_TOO_EARLY",

          employeeId: employeeSnapshot.id,

          employeeName,

          message,

          createdAt: serverTimestamp(),
        });

        return {
          type: "check_out_too_early",

          employeeName,

          reason: "before_checkout_window",

          remainingMinutes: 0,
        };
      }

      // ==================================================
      // RULE 2:
      // MINIMUM WORK DURATION
      // ==================================================

      if (currentMillis < minimumCheckoutMillis) {
        const remainingMinutes = Math.max(
          1,
          Math.ceil((minimumCheckoutMillis - currentMillis) / 60_000),
        );

        const message = `Durasi kerja belum mencapai ${formatDurationLong(
          attendanceRules.minimumWorkDurationMinutes,
        )}. Check-out dapat dilakukan dalam ${formatDuration(
          remainingMinutes,
        )} lagi.`;

        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "check_out",

          result: "warning",

          code: "CHECK_OUT_TOO_EARLY",

          employeeId: employeeSnapshot.id,

          employeeName,

          remainingMinutes,

          message,

          createdAt: serverTimestamp(),
        });

        return {
          type: "check_out_too_early",

          employeeName,

          reason: "minimum_duration",

          remainingMinutes,
        };
      }

      // ==================================================
      // CHECKOUT STATUS
      // ==================================================

      const checkOutStatus: CheckOutStatus =
        scanTimeMinutes < attendanceRules.normalCheckOutMinutes
          ? "early"
          : "normal";

      // ==================================================
      // COMPLETE ATTENDANCE
      // ==================================================

      transaction.update(attendanceRef, {
        status: "completed",

        checkOutAt: serverTimestamp(),

        checkOutStatus,

        workDurationMinutes,

        updatedAt: serverTimestamp(),
      });

      transaction.set(readerRef, readerStatus, {
        merge: true,
      });

      const checkOutMessage =
        checkOutStatus === "early"
          ? `${employeeName} berhasil absen pulang lebih awal.`
          : `${employeeName} berhasil absen pulang.`;

      transaction.set(logRef, {
        uid,

        readerType,

        action: "check_out",

        result: "success",

        code: "ATTENDANCE_CHECK_OUT",

        employeeId: employeeSnapshot.id,

        employeeName,

        checkOutStatus,

        workDurationMinutes,

        message: checkOutMessage,

        createdAt: serverTimestamp(),
      });

      return {
        type: "attendance_check_out",

        employeeName,

        checkOutStatus,

        workDurationMinutes,
      };
    });

    // ========================================================
    // HTTP RESPONSES
    // ========================================================

    switch (result.type) {
      // ======================================================
      // REGISTRATION SUCCESS
      // ======================================================

      case "registration_success":
        return NextResponse.json({
          success: true,

          code: "CARD_REGISTERED",

          mode: "registration",

          message: `RFID berhasil didaftarkan untuk ${result.employeeName}.`,
        });

      // ======================================================
      // CARD ALREADY REGISTERED
      // ======================================================

      case "card_already_registered":
        return NextResponse.json(
          {
            success: false,

            code: "CARD_ALREADY_REGISTERED",

            mode: "registration",

            message: result.employeeName
              ? `Kartu sudah terdaftar atas nama ${result.employeeName}.`
              : "Kartu RFID sudah terdaftar.",
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // EMPLOYEE ALREADY HAS CARD
      // ======================================================

      case "employee_already_has_card":
        return NextResponse.json(
          {
            success: false,

            code: "EMPLOYEE_ALREADY_HAS_CARD",

            mode: "registration",

            message: "Karyawan sudah memiliki kartu RFID.",
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // INVALID SESSION
      // ======================================================

      case "invalid_session":
        return NextResponse.json(
          {
            success: false,

            code: "INVALID_SESSION",

            message: "Sesi registrasi tidak valid.",
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // CHECK-IN TOO EARLY
      // ======================================================

      case "check_in_too_early":
        return NextResponse.json(
          {
            success: false,

            code: "CHECK_IN_TOO_EARLY",

            mode: "attendance",

            employeeName: result.employeeName,

            message: `Check-in belum dibuka. Check-in dimulai pukul ${attendanceRules.checkInOpen} WIB.`,
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // CHECK-IN CLOSED
      // ======================================================

      case "check_in_closed":
        return NextResponse.json(
          {
            success: false,

            code: "CHECK_IN_TIME_CLOSED",

            mode: "attendance",

            employeeName: result.employeeName,

            message: `Waktu check-in telah berakhir. Check-in hanya sampai pukul ${attendanceRules.checkInClose} WIB.`,
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // CHECK-IN SUCCESS
      // ======================================================

      case "attendance_check_in": {
        let message = `${result.employeeName} berhasil absen masuk.`;

        if (result.checkInStatus === "early") {
          message = `${result.employeeName} berhasil absen masuk lebih awal.`;
        }

        if (result.checkInStatus === "on_time") {
          message = `${result.employeeName} berhasil absen masuk tepat waktu.`;
        }

        if (result.checkInStatus === "late") {
          message = `${result.employeeName} berhasil absen masuk. Terlambat ${formatDuration(
            result.lateMinutes,
          )}.`;
        }

        return NextResponse.json({
          success: true,

          code: "ATTENDANCE_CHECK_IN",

          mode: "attendance",

          attendanceType: "check_in",

          checkInStatus: result.checkInStatus,

          lateMinutes: result.lateMinutes,

          employeeName: result.employeeName,

          message,
        });
      }

      // ======================================================
      // CHECKOUT BLOCKED
      // ======================================================

      case "check_out_too_early": {
        let message =
          "Anda sudah melakukan absen masuk. Belum masuk waktu absen pulang.";

        if (result.reason === "before_checkout_window") {
          message = `Anda sudah melakukan absen masuk. Check-out baru dapat dilakukan mulai pukul ${attendanceRules.checkOutOpen} WIB dan minimal ${formatDurationLong(
            attendanceRules.minimumWorkDurationMinutes,
          )} setelah check-in.`;
        }

        if (
          result.reason === "minimum_duration" &&
          result.remainingMinutes > 0
        ) {
          message = `Durasi kerja belum mencapai ${formatDurationLong(
            attendanceRules.minimumWorkDurationMinutes,
          )}. Check-out dapat dilakukan dalam ${formatDuration(
            result.remainingMinutes,
          )} lagi.`;
        }

        return NextResponse.json(
          {
            success: false,

            code: "CHECK_OUT_TOO_EARLY",

            mode: "attendance",

            attendanceType: "check_out",

            employeeName: result.employeeName,

            reason: result.reason,

            remainingMinutes: result.remainingMinutes,

            message,
          },
          {
            status: 409,
          },
        );
      }

      // ======================================================
      // CHECKOUT SUCCESS
      // ======================================================

      case "attendance_check_out":
        return NextResponse.json({
          success: true,

          code: "ATTENDANCE_CHECK_OUT",

          mode: "attendance",

          attendanceType: "check_out",

          checkOutStatus: result.checkOutStatus,

          workDurationMinutes: result.workDurationMinutes,

          employeeName: result.employeeName,

          message:
            result.checkOutStatus === "early"
              ? `${result.employeeName} berhasil absen pulang lebih awal.`
              : `${result.employeeName} berhasil absen pulang.`,
        });

      // ======================================================
      // ATTENDANCE COMPLETED
      // ======================================================

      case "attendance_complete":
        return NextResponse.json(
          {
            success: false,

            code: "ATTENDANCE_ALREADY_COMPLETE",

            mode: "attendance",

            employeeName: result.employeeName,

            message: `Absensi ${result.employeeName} hari ini sudah lengkap.`,
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // CARD NOT REGISTERED
      // ======================================================

      case "card_not_registered":
        return NextResponse.json(
          {
            success: false,

            code: "CARD_NOT_REGISTERED",

            mode: "attendance",

            message: "Kartu RFID belum terdaftar.",
          },
          {
            status: 404,
          },
        );

      // ======================================================
      // CARD INACTIVE
      // ======================================================

      case "card_inactive":
        return NextResponse.json(
          {
            success: false,

            code: "CARD_INACTIVE",

            mode: "attendance",

            employeeName: result.employeeName,

            message: result.employeeName
              ? `Kartu RFID milik ${result.employeeName} sedang nonaktif.`
              : "Kartu RFID sedang nonaktif.",
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // EMPLOYEE INACTIVE
      // ======================================================

      case "employee_inactive":
        return NextResponse.json(
          {
            success: false,

            code: "EMPLOYEE_INACTIVE",

            mode: "attendance",

            employeeName: result.employeeName,

            message: "Karyawan sedang tidak aktif.",
          },
          {
            status: 409,
          },
        );

      // ======================================================
      // EMPLOYEE NOT FOUND
      // ======================================================

      case "employee_not_found":
        return NextResponse.json(
          {
            success: false,

            code: "EMPLOYEE_NOT_FOUND",

            message: "Data karyawan tidak ditemukan.",
          },
          {
            status: 404,
          },
        );

      // ======================================================
      // UNKNOWN
      // ======================================================

      default:
        return NextResponse.json(
          {
            success: false,

            code: "UNKNOWN_SCAN_RESULT",

            message: "Hasil scan tidak dikenali.",
          },
          {
            status: 500,
          },
        );
    }
  } catch (error) {
    console.error("[RFID SCAN]", error);

    return NextResponse.json(
      {
        success: false,

        code: "SERVER_ERROR",

        message: "Terjadi kesalahan pada server.",
      },
      {
        status: 500,
      },
    );
  }
}
