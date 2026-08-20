import { NextResponse } from "next/server";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import { firestoreDocumentToJson } from "@/lib/firestore-json";

import { isValidDateKey } from "@/lib/attendance-permission";

import { sanitizeText } from "@/lib/rfid";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

// ============================================================
// TYPES
// ============================================================

interface CreatePermissionBody {
  employeeId?: unknown;

  dateKey?: unknown;

  type?: unknown;

  reason?: unknown;
}

// ============================================================
// GET ALL PERMISSIONS
// ============================================================

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "attendancePermissions"));

    const permissions = snapshot.docs
      .map((document) => firestoreDocumentToJson(document))
      .filter(Boolean);

    return NextResponse.json({
      success: true,

      permissions,
    });
  } catch (error) {
    console.error("[GET ATTENDANCE PERMISSIONS]", error);

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error ? error.message : "Gagal mengambil data izin.",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// CREATE PERMISSION
// ============================================================

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePermissionBody;

    // ========================================================
    // INPUT
    // ========================================================

    const employeeId = sanitizeText(body.employeeId, 120);

    const dateKey = sanitizeText(body.dateKey, 10);

    const reason = sanitizeText(body.reason, 300);

    const type =
      body.type === "absent" ? "absent" : body.type === "late" ? "late" : null;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,

          message: "Karyawan wajib dipilih.",
        },
        {
          status: 400,
        },
      );
    }

    if (!dateKey) {
      return NextResponse.json(
        {
          success: false,

          message: "Tanggal izin wajib dipilih.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidDateKey(dateKey)) {
      return NextResponse.json(
        {
          success: false,

          message: "Tanggal izin tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    if (!type) {
      return NextResponse.json(
        {
          success: false,

          message: "Jenis izin tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    if (reason.length < 3) {
      return NextResponse.json(
        {
          success: false,

          message: "Alasan izin minimal 3 karakter.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // CHECK EMPLOYEE
    // ========================================================

    const employeeRef = doc(db, "employees", employeeId);

    const employeeSnapshot = await getDoc(employeeRef);

    if (!employeeSnapshot.exists()) {
      return NextResponse.json(
        {
          success: false,

          message: "Karyawan tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    const employee = employeeSnapshot.data();

    if (employee.status === "inactive") {
      return NextResponse.json(
        {
          success: false,

          message: "Karyawan nonaktif tidak dapat dicatat izinnya.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // DUPLICATE CHECK
    // ========================================================

    const permissionSnapshot = await getDocs(
      collection(db, "attendancePermissions"),
    );

    const duplicatePermission = permissionSnapshot.docs.find((document) => {
      const permission = document.data();

      return (
        permission.employeeId === employeeId && permission.dateKey === dateKey
      );
    });

    if (duplicatePermission) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Karyawan sudah memiliki catatan izin pada tanggal tersebut.",
        },
        {
          status: 409,
        },
      );
    }

    // ========================================================
    // EMPLOYEE SNAPSHOT
    // ========================================================

    const employeeCode =
      typeof employee.employeeCode === "string" ? employee.employeeCode : "-";

    const employeeName =
      typeof employee.name === "string" ? employee.name : "-";

    const department =
      typeof employee.department === "string" ? employee.department : "-";

    const position =
      typeof employee.position === "string" ? employee.position : "-";

    // ========================================================
    // CREATE DOCUMENT
    // ========================================================

    const permissionRef = doc(collection(db, "attendancePermissions"));

    await setDoc(permissionRef, {
      employeeId,

      employeeCode,

      employeeName,

      department,

      position,

      dateKey,

      type,

      reason,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success: true,

        message: "Izin karyawan berhasil dicatat.",

        permission: {
          id: permissionRef.id,

          employeeId,

          employeeCode,

          employeeName,

          department,

          position,

          dateKey,

          type,

          reason,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("[CREATE ATTENDANCE PERMISSION]", error);

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Gagal mencatat izin karyawan.",
      },
      {
        status: 500,
      },
    );
  }
}
