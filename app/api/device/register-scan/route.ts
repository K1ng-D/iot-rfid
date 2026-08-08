import { NextResponse } from "next/server";

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import { authenticateDevice } from "@/lib/device-auth";

import {
  isValidRfidUid,
  normalizeRfidUid,
  sanitizeText,
  sanitizeWifiRssi,
} from "@/lib/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisterScanBody {
  uid?: unknown;

  firmwareVersion?: unknown;

  wifiRssi?: unknown;
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
    /*
     * =========================================
     * DEVICE AUTHENTICATION
     * =========================================
     */

    const auth = await authenticateDevice(request);

    if (!auth.ok) {
      return NextResponse.json(
        {
          success: false,

          code: auth.code,

          message: auth.message,
        },
        {
          status: auth.status,
        },
      );
    }

    /*
     * =========================================
     * REQUEST BODY
     * =========================================
     */

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

    const firmwareVersion = sanitizeText(body.firmwareVersion, 40);

    const wifiRssi = sanitizeWifiRssi(body.wifiRssi);

    /*
     * =========================================
     * FIRESTORE REFERENCES
     * =========================================
     */

    const controlRef = doc(db, "system", "rfid-registration");

    const deviceRef = doc(db, "devices", auth.deviceId);

    const logRef = doc(collection(db, "scanLogs"));

    /*
     * =========================================
     * TRANSACTION
     * =========================================
     */

    const result = await runTransaction<RegistrationResult>(
      db,
      async (transaction) => {
        const controlSnapshot = await transaction.get(controlRef);

        const activeSessionId = controlSnapshot.exists()
          ? controlSnapshot.data().activeSessionId
          : null;

        /*
         * Tidak ada sesi registrasi.
         */
        if (typeof activeSessionId !== "string" || !activeSessionId) {
          transaction.set(logRef, {
            uid,

            deviceId: auth.deviceId,

            deviceType: auth.device.type ?? "registration",

            action: "register",

            result: "warning",

            code: "NO_ACTIVE_SESSION",

            employeeId: null,

            employeeName: null,

            message: "Kartu dipindai tanpa sesi registrasi aktif.",

            createdAt: serverTimestamp(),
          });

          transaction.set(
            deviceRef,
            {
              firmwareVersion: firmwareVersion || null,

              wifiRssi,

              lastSeenAt: serverTimestamp(),

              updatedAt: serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          return {
            type: "no_active_session",
          };
        }

        /*
         * Ambil session.
         */
        const sessionRef = doc(db, "registrationSessions", activeSessionId);

        const sessionSnapshot = await transaction.get(sessionRef);

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

          transaction.set(logRef, {
            uid,

            deviceId: auth.deviceId,

            deviceType: auth.device.type ?? "registration",

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

        const employeeRef = doc(db, "employees", employeeId);

        const cardRef = doc(db, "rfidCards", uid);

        /*
         * Semua read harus dilakukan
         * sebelum write transaction.
         */
        const employeeSnapshot = await transaction.get(employeeRef);

        const cardSnapshot = await transaction.get(cardRef);

        /*
         * Employee tidak ditemukan.
         */
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

          transaction.set(logRef, {
            uid,

            deviceId: auth.deviceId,

            deviceType: auth.device.type ?? "registration",

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

        /*
         * UID sudah dimiliki kartu lain.
         */
        if (cardSnapshot.exists()) {
          transaction.set(logRef, {
            uid,

            deviceId: auth.deviceId,

            deviceType: auth.device.type ?? "registration",

            action: "register",

            result: "warning",

            code: "CARD_ALREADY_REGISTERED",

            employeeId: employeeSnapshot.id,

            employeeName: employee.name ?? null,

            message: "Kartu RFID sudah terdaftar.",

            createdAt: serverTimestamp(),
          });

          transaction.set(
            deviceRef,
            {
              firmwareVersion: firmwareVersion || null,

              wifiRssi,

              lastSeenAt: serverTimestamp(),

              updatedAt: serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          return {
            type: "duplicate",
          };
        }

        /*
         * Employee ternyata sudah punya
         * RFID lain.
         */
        if (typeof employee.rfidUid === "string" && employee.rfidUid) {
          transaction.set(logRef, {
            uid,

            deviceId: auth.deviceId,

            deviceType: auth.device.type ?? "registration",

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

        /*
         * =================================
         * REGISTRATION SUCCESS
         * =================================
         */

        transaction.set(cardRef, {
          uid,

          employeeId: employeeSnapshot.id,

          employeeCode: employee.employeeCode ?? "",

          employeeName: employee.name ?? "",

          status: "active",

          registeredByDevice: auth.deviceId,

          registeredAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        transaction.update(employeeRef, {
          rfidUid: uid,

          updatedAt: serverTimestamp(),
        });

        transaction.update(sessionRef, {
          status: "completed",

          uid,

          deviceId: auth.deviceId,

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

        transaction.set(
          deviceRef,
          {
            firmwareVersion: firmwareVersion || null,

            wifiRssi,

            lastSeenAt: serverTimestamp(),

            updatedAt: serverTimestamp(),
          },
          {
            merge: true,
          },
        );

        transaction.set(logRef, {
          uid,

          deviceId: auth.deviceId,

          deviceType: auth.device.type ?? "registration",

          action: "register",

          result: "success",

          code: "CARD_REGISTERED",

          employeeId: employeeSnapshot.id,

          employeeName: employee.name ?? null,

          message: "RFID berhasil didaftarkan.",

          createdAt: serverTimestamp(),
        });

        return {
          type: "success",

          employeeName: employee.name ?? "",
        };
      },
    );

    /*
     * =========================================
     * RESPONSE
     * =========================================
     */

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

            message: "Kartu RFID sudah terdaftar.",
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
