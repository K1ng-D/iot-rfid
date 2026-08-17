import { NextResponse } from "next/server";

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import { sanitizeText } from "@/lib/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface UpdateEmployeeBody {
  name?: unknown;

  department?: unknown;

  position?: unknown;

  status?: unknown;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const body = (await request.json()) as UpdateEmployeeBody;

    const employeeRef = doc(db, "employees", id);

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

    const name = sanitizeText(body.name, 100);

    if (name.length < 2) {
      return NextResponse.json(
        {
          success: false,

          message: "Nama karyawan minimal 2 karakter.",
        },
        {
          status: 400,
        },
      );
    }

    const department = sanitizeText(body.department, 100);

    const position = sanitizeText(body.position, 100);

    const status = body.status === "inactive" ? "inactive" : "active";

    await updateDoc(employeeRef, {
      name,

      department,

      position,

      status,

      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,

      message: "Data karyawan berhasil diperbarui.",
    });
  } catch (error) {
    console.error("[UPDATE EMPLOYEE]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal memperbarui data karyawan.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const employeeRef = doc(db, "employees", id);

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

    const employeeData = employeeSnapshot.data();

    const batch = writeBatch(db);

    const rfidUid =
      typeof employeeData.rfidUid === "string" ? employeeData.rfidUid : "";

    if (rfidUid) {
      batch.delete(doc(db, "rfidCards", rfidUid));
    }

    /*
     * Kalau employee sedang berada
     * pada sesi registrasi, batalkan.
     */
    const controlRef = doc(db, "system", "rfid-registration");

    const controlSnapshot = await getDoc(controlRef);

    if (controlSnapshot.exists()) {
      const activeSessionId = controlSnapshot.data().activeSessionId;

      if (typeof activeSessionId === "string" && activeSessionId) {
        const sessionRef = doc(db, "registrationSessions", activeSessionId);

        const sessionSnapshot = await getDoc(sessionRef);

        if (
          sessionSnapshot.exists() &&
          sessionSnapshot.data().employeeId === id
        ) {
          batch.update(sessionRef, {
            status: "cancelled",

            cancelledAt: serverTimestamp(),

            updatedAt: serverTimestamp(),
          });

          batch.set(
            controlRef,
            {
              activeSessionId: null,

              updatedAt: serverTimestamp(),
            },
            {
              merge: true,
            },
          );
        }
      }
    }

    batch.delete(employeeRef);

    await batch.commit();

    return NextResponse.json({
      success: true,

      message: "Karyawan berhasil dihapus.",
    });
  } catch (error) {
    console.error("[DELETE EMPLOYEE]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal menghapus karyawan.",
      },
      {
        status: 500,
      },
    );
  }
}
