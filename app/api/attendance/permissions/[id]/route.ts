import { NextResponse } from "next/server";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { isValidDateKey } from "@/lib/attendance-permission";

import { db } from "@/lib/firebase";

import { sanitizeText } from "@/lib/rfid";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface UpdatePermissionBody {
  employeeId?: unknown;

  dateKey?: unknown;

  type?: unknown;

  reason?: unknown;
}

// ============================================================
// UPDATE
// ============================================================

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const body = (await request.json()) as UpdatePermissionBody;

    const employeeId = sanitizeText(body.employeeId, 120);

    const dateKey = sanitizeText(body.dateKey, 10);

    const reason = sanitizeText(body.reason, 300);

    const type =
      body.type === "late" ? "late" : body.type === "absent" ? "absent" : null;

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
    // PERMISSION
    // ========================================================

    const permissionRef = doc(db, "attendancePermissions", id);

    const permissionSnapshot = await getDoc(permissionRef);

    if (!permissionSnapshot.exists()) {
      return NextResponse.json(
        {
          success: false,

          message: "Catatan izin tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // EMPLOYEE
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

    // ========================================================
    // DUPLICATE CHECK
    // ========================================================

    const duplicateQuery = query(
      collection(db, "attendancePermissions"),

      where("employeeId", "==", employeeId),

      where("dateKey", "==", dateKey),
    );

    const duplicateSnapshot = await getDocs(duplicateQuery);

    const hasOtherPermission = duplicateSnapshot.docs.some(
      (document) => document.id !== id,
    );

    if (hasOtherPermission) {
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
    // UPDATE
    // ========================================================

    await updateDoc(permissionRef, {
      employeeId,

      employeeCode:
        typeof employee.employeeCode === "string" ? employee.employeeCode : "-",

      employeeName: typeof employee.name === "string" ? employee.name : "-",

      department:
        typeof employee.department === "string" ? employee.department : "-",

      position: typeof employee.position === "string" ? employee.position : "-",

      dateKey,

      type,

      reason,

      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,

      message: "Catatan izin berhasil diperbarui.",
    });
  } catch (error) {
    console.error("[UPDATE ATTENDANCE PERMISSION]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal memperbarui catatan izin.",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// DELETE
// ============================================================

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const permissionRef = doc(db, "attendancePermissions", id);

    const permissionSnapshot = await getDoc(permissionRef);

    if (!permissionSnapshot.exists()) {
      return NextResponse.json(
        {
          success: false,

          message: "Catatan izin tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    await deleteDoc(permissionRef);

    return NextResponse.json({
      success: true,

      message: "Catatan izin berhasil dihapus.",
    });
  } catch (error) {
    console.error("[DELETE ATTENDANCE PERMISSION]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal menghapus catatan izin.",
      },
      {
        status: 500,
      },
    );
  }
}
