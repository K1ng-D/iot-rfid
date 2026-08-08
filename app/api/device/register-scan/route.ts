import { NextResponse } from "next/server";

import {
  collection,
  doc,
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

const READER_DOCUMENT = "registration-reader";

interface RegisterScanBody {
  uid?: unknown;

  type?: unknown;

  firmwareVersion?: unknown;

  wifiRssi?: unknown;

  uptimeSeconds?: unknown;
}

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
      type: "employee_inactive";

      employeeName: string;
    }
  | {
      type: "attendance_check_in";

      employeeName: string;
    }
  | {
      type: "attendance_check_out";

      employeeName: string;
    }
  | {
      type: "attendance_complete";

      employeeName: string;
    };

function getJakartaDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;

  const month = parts.find((part) => part.type === "month")?.value;

  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

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

    const dateKey = getJakartaDateKey();

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

        // =================================================
        // INVALID REGISTRATION SESSION
        // =================================================

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
         * Semua READ transaction dilakukan
         * sebelum WRITE.
         */

        const employeeSnapshot = await transaction.get(employeeRef);

        const cardSnapshot = await transaction.get(cardRef);

        // =================================================
        // EMPLOYEE NOT FOUND
        // =================================================

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

        // =================================================
        // CARD ALREADY REGISTERED
        // =================================================

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

        // =================================================
        // EMPLOYEE ALREADY HAS CARD
        // =================================================

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

        // =================================================
        // CREATE RFID CARD
        // =================================================

        transaction.set(cardRef, {
          uid,

          employeeId: employeeSnapshot.id,

          employeeCode: employee.employeeCode ?? "",

          employeeName: employee.name ?? "",

          status: "active",

          registeredAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        // =================================================
        // UPDATE EMPLOYEE
        // =================================================

        transaction.update(employeeRef, {
          rfidUid: uid,

          updatedAt: serverTimestamp(),
        });

        // =================================================
        // COMPLETE SESSION
        // =================================================

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
      //
      // MODE 2:
      // ATTENDANCE
      //
      // Tidak ada registration session.
      //
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

      const employeeRef = doc(db, "employees", employeeId);

      const attendanceId = `${dateKey}_${employeeId}`;

      const attendanceRef = doc(db, "attendanceRecords", attendanceId);

      /*
       * Semua reads dahulu.
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
      //
      // CHECK IN
      // ==================================================

      if (!attendanceSnapshot.exists()) {
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

          checkOutAt: null,

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

          message: `${employeeName} berhasil absen masuk.`,

          createdAt: serverTimestamp(),
        });

        return {
          type: "attendance_check_in",

          employeeName,
        };
      }

      // ==================================================
      // ATTENDANCE ALREADY EXISTS
      // ==================================================

      const attendance = attendanceSnapshot.data();

      // ==================================================
      // SECOND SCAN
      //
      // CHECK OUT
      // ==================================================

      if (!attendance.checkOutAt) {
        transaction.update(attendanceRef, {
          status: "completed",

          checkOutAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        transaction.set(logRef, {
          uid,

          readerType,

          action: "check_out",

          result: "success",

          code: "ATTENDANCE_CHECK_OUT",

          employeeId: employeeSnapshot.id,

          employeeName,

          message: `${employeeName} berhasil absen pulang.`,

          createdAt: serverTimestamp(),
        });

        return {
          type: "attendance_check_out",

          employeeName,
        };
      }

      // ==================================================
      // ATTENDANCE ALREADY COMPLETE
      // ==================================================

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
    });

    // ========================================================
    // HTTP RESPONSES
    // ========================================================

    switch (result.type) {
      // ======================================================
      // REGISTRATION
      // ======================================================

      case "registration_success":
        return NextResponse.json({
          success: true,

          code: "CARD_REGISTERED",

          mode: "registration",

          message: `RFID berhasil didaftarkan untuk ${result.employeeName}.`,
        });

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
      // ATTENDANCE CHECK IN
      // ======================================================

      case "attendance_check_in":
        return NextResponse.json({
          success: true,

          code: "ATTENDANCE_CHECK_IN",

          mode: "attendance",

          attendanceType: "check_in",

          employeeName: result.employeeName,

          message: `${result.employeeName} berhasil absen masuk.`,
        });

      // ======================================================
      // ATTENDANCE CHECK OUT
      // ======================================================

      case "attendance_check_out":
        return NextResponse.json({
          success: true,

          code: "ATTENDANCE_CHECK_OUT",

          mode: "attendance",

          attendanceType: "check_out",

          employeeName: result.employeeName,

          message: `${result.employeeName} berhasil absen pulang.`,
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
