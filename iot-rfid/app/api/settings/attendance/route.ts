import { NextResponse } from "next/server";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// CONFIG
// ============================================================

const SETTINGS_DOCUMENT = "attendance-settings";

// ============================================================
// TYPES
// ============================================================

interface AttendanceSettingsPayload {
  checkInOpen?: unknown;

  workStart?: unknown;

  lateStart?: unknown;

  checkInClose?: unknown;

  checkOutOpen?: unknown;

  normalCheckOut?: unknown;

  minimumWorkDurationMinutes?: unknown;
}

// ============================================================
// DEFAULT SETTINGS
// ============================================================

const DEFAULT_SETTINGS = {
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
// HELPERS
// ============================================================

function timestampToIso(value: unknown) {
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDate = (
      value as {
        toDate?: unknown;
      }
    ).toDate;

    if (typeof toDate === "function") {
      try {
        const date = (toDate as () => Date).call(value);

        if (!Number.isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

// ============================================================

function isValidTime(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

// ============================================================

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);

  return hour * 60 + minute;
}

// ============================================================
// GET SETTINGS
// ============================================================

export async function GET() {
  try {
    const settingsRef = doc(db, "system", SETTINGS_DOCUMENT);

    const snapshot = await getDoc(settingsRef);

    // ========================================================
    // DEFAULT
    // ========================================================

    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,

        settings: {
          ...DEFAULT_SETTINGS,

          updatedAt: null,
        },
      });
    }

    const data = snapshot.data();

    return NextResponse.json({
      success: true,

      settings: {
        checkInOpen: isValidTime(data.checkInOpen)
          ? data.checkInOpen
          : DEFAULT_SETTINGS.checkInOpen,

        workStart: isValidTime(data.workStart)
          ? data.workStart
          : DEFAULT_SETTINGS.workStart,

        lateStart: isValidTime(data.lateStart)
          ? data.lateStart
          : DEFAULT_SETTINGS.lateStart,

        checkInClose: isValidTime(data.checkInClose)
          ? data.checkInClose
          : DEFAULT_SETTINGS.checkInClose,

        checkOutOpen: isValidTime(data.checkOutOpen)
          ? data.checkOutOpen
          : DEFAULT_SETTINGS.checkOutOpen,

        normalCheckOut: isValidTime(data.normalCheckOut)
          ? data.normalCheckOut
          : DEFAULT_SETTINGS.normalCheckOut,

        minimumWorkDurationMinutes:
          typeof data.minimumWorkDurationMinutes === "number" &&
          Number.isFinite(data.minimumWorkDurationMinutes)
            ? data.minimumWorkDurationMinutes
            : DEFAULT_SETTINGS.minimumWorkDurationMinutes,

        timezone: "Asia/Jakarta",

        updatedAt: timestampToIso(data.updatedAt),
      },
    });
  } catch (error) {
    console.error("[ATTENDANCE SETTINGS GET]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal mengambil pengaturan absensi.",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// PATCH SETTINGS
// ============================================================

export async function PATCH(request: Request) {
  try {
    let body: AttendanceSettingsPayload;

    try {
      body = (await request.json()) as AttendanceSettingsPayload;
    } catch {
      return NextResponse.json(
        {
          success: false,

          message: "Body request tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // VALIDATE TIME
    // ========================================================

    if (
      !isValidTime(body.checkInOpen) ||
      !isValidTime(body.workStart) ||
      !isValidTime(body.lateStart) ||
      !isValidTime(body.checkInClose) ||
      !isValidTime(body.checkOutOpen) ||
      !isValidTime(body.normalCheckOut)
    ) {
      return NextResponse.json(
        {
          success: false,

          message: "Format waktu tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // MINUTES
    // ========================================================

    const checkInOpenMinutes = timeToMinutes(body.checkInOpen);

    const workStartMinutes = timeToMinutes(body.workStart);

    const lateStartMinutes = timeToMinutes(body.lateStart);

    const checkInCloseMinutes = timeToMinutes(body.checkInClose);

    const checkOutOpenMinutes = timeToMinutes(body.checkOutOpen);

    const normalCheckOutMinutes = timeToMinutes(body.normalCheckOut);

    // ========================================================
    // VALIDATE CHECK-IN FLOW
    // ========================================================

    if (
      !(
        checkInOpenMinutes <= workStartMinutes &&
        workStartMinutes <= lateStartMinutes &&
        lateStartMinutes <= checkInCloseMinutes
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Urutan waktu check-in tidak valid. Pastikan waktu buka ≤ jam kerja ≤ batas terlambat ≤ waktu tutup.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // VALIDATE CHECKOUT FLOW
    // ========================================================

    if (checkOutOpenMinutes > normalCheckOutMinutes) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Jam check-out dibuka tidak boleh lebih lambat dari jam pulang normal.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // MINIMUM WORK
    // ========================================================

    const minimumWorkDurationMinutes =
      typeof body.minimumWorkDurationMinutes === "number" &&
      Number.isFinite(body.minimumWorkDurationMinutes)
        ? Math.floor(body.minimumWorkDurationMinutes)
        : NaN;

    if (
      !Number.isFinite(minimumWorkDurationMinutes) ||
      minimumWorkDurationMinutes < 60 ||
      minimumWorkDurationMinutes > 720
    ) {
      return NextResponse.json(
        {
          success: false,

          message: "Minimum durasi kerja harus antara 60 sampai 720 menit.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // SAVE
    // ========================================================

    const settingsRef = doc(db, "system", SETTINGS_DOCUMENT);

    await setDoc(
      settingsRef,
      {
        checkInOpen: body.checkInOpen,

        workStart: body.workStart,

        lateStart: body.lateStart,

        checkInClose: body.checkInClose,

        checkOutOpen: body.checkOutOpen,

        normalCheckOut: body.normalCheckOut,

        minimumWorkDurationMinutes,

        timezone: "Asia/Jakarta",

        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    return NextResponse.json({
      success: true,

      message: "Pengaturan absensi berhasil disimpan.",
    });
  } catch (error) {
    console.error("[ATTENDANCE SETTINGS PATCH]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal menyimpan pengaturan absensi.",
      },
      {
        status: 500,
      },
    );
  }
}
