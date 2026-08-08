import { NextResponse } from "next/server";

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegistrationBody {
  employeeId?: unknown;
}

class RegistrationError extends Error {
  status: number;

  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);

    this.name = "RegistrationError";

    this.status = status;

    this.code = code;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegistrationBody;

    const employeeId =
      typeof body.employeeId === "string" ? body.employeeId.trim() : "";

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,

          code: "INVALID_EMPLOYEE",

          message: "Pilih karyawan terlebih dahulu.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // REFERENCES
    // ========================================================

    const employeeRef = doc(db, "employees", employeeId);

    const controlRef = doc(db, "system", "rfid-registration");

    const sessionRef = doc(collection(db, "registrationSessions"));

    // ========================================================
    // TRANSACTION
    // ========================================================

    await runTransaction(db, async (transaction) => {
      // ====================================================
      // EMPLOYEE
      // ====================================================

      const employeeSnapshot = await transaction.get(employeeRef);

      if (!employeeSnapshot.exists()) {
        throw new RegistrationError(
          404,
          "EMPLOYEE_NOT_FOUND",
          "Karyawan tidak ditemukan.",
        );
      }

      const employee = employeeSnapshot.data();

      // ====================================================
      // EMPLOYEE ALREADY HAS RFID
      // ====================================================

      if (typeof employee.rfidUid === "string" && employee.rfidUid) {
        throw new RegistrationError(
          409,
          "EMPLOYEE_ALREADY_HAS_CARD",
          "Karyawan sudah memiliki kartu RFID.",
        );
      }

      // ====================================================
      // EMPLOYEE STATUS
      // ====================================================

      if (employee.status !== "active") {
        throw new RegistrationError(
          409,
          "EMPLOYEE_INACTIVE",
          "Karyawan sedang tidak aktif.",
        );
      }

      // ====================================================
      // CHECK CURRENT SESSION
      // ====================================================

      const controlSnapshot = await transaction.get(controlRef);

      if (controlSnapshot.exists()) {
        const activeSessionId = controlSnapshot.data().activeSessionId;

        if (typeof activeSessionId === "string" && activeSessionId) {
          const activeSessionRef = doc(
            db,
            "registrationSessions",
            activeSessionId,
          );

          const activeSessionSnapshot = await transaction.get(activeSessionRef);

          if (
            activeSessionSnapshot.exists() &&
            activeSessionSnapshot.data().status === "waiting"
          ) {
            throw new RegistrationError(
              409,
              "ACTIVE_SESSION_EXISTS",
              "Masih terdapat sesi registrasi RFID yang aktif.",
            );
          }
        }
      }

      // ====================================================
      // CREATE SESSION
      // ====================================================

      transaction.set(sessionRef, {
        employeeId: employeeSnapshot.id,

        employeeCode: employee.employeeCode ?? "",

        employeeName: employee.name ?? "",

        status: "waiting",

        uid: null,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),

        completedAt: null,

        cancelledAt: null,
      });

      // ====================================================
      // SET ACTIVE SESSION
      // ====================================================

      transaction.set(
        controlRef,
        {
          activeSessionId: sessionRef.id,

          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        code: "REGISTRATION_STARTED",

        message: "Sesi registrasi berhasil dimulai.",

        sessionId: sessionRef.id,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof RegistrationError) {
      return NextResponse.json(
        {
          success: false,

          code: error.code,

          message: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    console.error("[START REGISTRATION]", error);

    return NextResponse.json(
      {
        success: false,

        code: "SERVER_ERROR",

        message: "Gagal memulai registrasi RFID.",
      },
      {
        status: 500,
      },
    );
  }
}
