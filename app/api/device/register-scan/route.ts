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

/**
 * Internal Firestore document key.
 *
 * Ini bukan Device ID.
 * Tidak dikirim oleh ESP32.
 */
const READER_DOCUMENT = "registration-reader";

interface RegisterScanBody {
  uid?: unknown;

  type?: unknown;

  firmwareVersion?: unknown;

  wifiRssi?: unknown;

  uptimeSeconds?: unknown;
}

type RegistrationResult =
  | {
      type: "success";

      employeeName: string;
    }
  | {
      type: "no_active_session";
    }
  | {
      type: "duplicate";

      employeeName: string | null;
    }
  | {
      type: "invalid_session";
    }
  | {
      type: "employee_not_found";
    }
  | {
      type: "employee_already_has_card";
    };

export async function POST(request: Request) {
  try {
    // ========================================================
    // REQUEST BODY
    // ========================================================

    const body = (await request.json()) as RegisterScanBody;

    // ========================================================
    // RFID UID
    // ========================================================

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

    // ========================================================
    // REFERENCES
    // ========================================================

    const controlRef = doc(db, "system", "rfid-registration");

    const readerRef = doc(db, "devices", READER_DOCUMENT);

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
    // FIRESTORE TRANSACTION
    // ========================================================

    const result = await runTransaction<RegistrationResult>(
      db,
      async (transaction) => {
        // ==================================================
        // ACTIVE REGISTRATION CONTROL
        // ==================================================

        const controlSnapshot = await transaction.get(controlRef);

        const activeSessionId = controlSnapshot.exists()
          ? controlSnapshot.data().activeSessionId
          : null;

        // ==================================================
        // NO ACTIVE SESSION
        // ==================================================

        if (typeof activeSessionId !== "string" || !activeSessionId) {
          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

          transaction.set(logRef, {
            uid,

            readerType,

            action: "register",

            result: "warning",

            code: "NO_ACTIVE_SESSION",

            employeeId: null,

            employeeName: null,

            message: "Kartu dipindai tanpa sesi registrasi aktif.",

            createdAt: serverTimestamp(),
          });

          return {
            type: "no_active_session",
          };
        }

        // ==================================================
        // REGISTRATION SESSION
        // ==================================================

        const sessionRef = doc(db, "registrationSessions", activeSessionId);

        const sessionSnapshot = await transaction.get(sessionRef);

        // ==================================================
        // INVALID SESSION
        // ==================================================

        if (
          !sessionSnapshot.exists() ||
          sessionSnapshot.data().status !== "waiting"
        ) {
          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

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

        const sessionData = sessionSnapshot.data();

        const employeeId =
          typeof sessionData.employeeId === "string"
            ? sessionData.employeeId
            : "";

        // ==================================================
        // REFERENCES
        // ==================================================

        const employeeRef = doc(db, "employees", employeeId);

        const cardRef = doc(db, "rfidCards", uid);

        /*
         * Penting:
         * seluruh READ transaction dilakukan
         * sebelum WRITE berikutnya.
         */

        const employeeSnapshot = await transaction.get(employeeRef);

        const cardSnapshot = await transaction.get(cardRef);

        // ==================================================
        // EMPLOYEE NOT FOUND
        // ==================================================

        if (!employeeSnapshot.exists()) {
          transaction.set(readerRef, readerStatus, {
            merge: true,
          });

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

          transaction.set(logRef, {
            uid,

            readerType,

            action: "register",

            result: "error",

            code: "EMPLOYEE_NOT_FOUND",

            employeeId,

            employeeName: null,

            message: "Data karyawan untuk sesi registrasi tidak ditemukan.",

            createdAt: serverTimestamp(),
          });

          return {
            type: "employee_not_found",
          };
        }

        const employee = employeeSnapshot.data();

        // ==================================================
        // CARD ALREADY REGISTERED
        // ==================================================

        if (cardSnapshot.exists()) {
          const existingCard = cardSnapshot.data();

          const existingEmployeeName =
            typeof existingCard.employeeName === "string"
              ? existingCard.employeeName
              : null;

          const existingEmployeeId =
            typeof existingCard.employeeId === "string"
              ? existingCard.employeeId
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

            employeeId: existingEmployeeId,

            employeeName: existingEmployeeName,

            message: existingEmployeeName
              ? `Kartu RFID sudah terdaftar atas nama ${existingEmployeeName}.`
              : "Kartu RFID sudah terdaftar.",

            createdAt: serverTimestamp(),
          });

          return {
            type: "duplicate",

            employeeName: existingEmployeeName,
          };
        }

        // ==================================================
        // EMPLOYEE ALREADY HAS CARD
        // ==================================================

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

        // ==================================================
        // CREATE RFID CARD
        // ==================================================

        transaction.set(cardRef, {
          uid,

          employeeId: employeeSnapshot.id,

          employeeCode: employee.employeeCode ?? "",

          employeeName: employee.name ?? "",

          status: "active",

          registeredAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        // ==================================================
        // UPDATE EMPLOYEE
        // ==================================================

        transaction.update(employeeRef, {
          rfidUid: uid,

          updatedAt: serverTimestamp(),
        });

        // ==================================================
        // COMPLETE SESSION
        // ==================================================

        transaction.update(sessionRef, {
          status: "completed",

          uid,

          completedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        // ==================================================
        // CLEAR ACTIVE SESSION
        // ==================================================

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

        // ==================================================
        // UPDATE READER
        // ==================================================

        transaction.set(readerRef, readerStatus, {
          merge: true,
        });

        // ==================================================
        // CREATE LOG
        // ==================================================

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

        // ==================================================
        // SUCCESS
        // ==================================================

        return {
          type: "success",

          employeeName: employee.name ?? "",
        };
      },
    );

    // ========================================================
    // RESPONSE
    // ========================================================

    switch (result.type) {
      case "success":
        return NextResponse.json({
          success: true,

          code: "CARD_REGISTERED",

          message: `RFID berhasil didaftarkan untuk ${result.employeeName}.`,
        });

      case "no_active_session":
        return NextResponse.json(
          {
            success: false,

            code: "NO_ACTIVE_SESSION",

            message: "Tidak ada sesi registrasi RFID yang aktif.",
          },
          {
            status: 404,
          },
        );

      case "duplicate":
        return NextResponse.json(
          {
            success: false,

            code: "CARD_ALREADY_REGISTERED",

            message: result.employeeName
              ? `Kartu RFID sudah terdaftar atas nama ${result.employeeName}.`
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

            message: "Karyawan sudah memiliki kartu RFID.",
          },
          {
            status: 409,
          },
        );

      case "employee_not_found":
        return NextResponse.json(
          {
            success: false,

            code: "EMPLOYEE_NOT_FOUND",

            message: "Karyawan tidak ditemukan.",
          },
          {
            status: 404,
          },
        );

      case "invalid_session":
      default:
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
    }
  } catch (error) {
    console.error("[REGISTER SCAN]", error);

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
