import { NextResponse } from "next/server";

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import { firestoreDocumentToJson } from "@/lib/firestore-json";

import { sanitizeText } from "@/lib/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateEmployeeBody {
  name?: unknown;

  department?: unknown;

  position?: unknown;

  status?: unknown;
}

export async function GET() {
  try {
    const employeesQuery = query(
      collection(db, "employees"),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(employeesQuery);

    const employees = snapshot.docs
      .map((document) => firestoreDocumentToJson(document))
      .filter(Boolean);

    return NextResponse.json({
      success: true,

      employees,
    });
  } catch (error) {
    console.error("[GET EMPLOYEES]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal mengambil data karyawan.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateEmployeeBody;

    const name = sanitizeText(body.name, 100);

    const department = sanitizeText(body.department, 100);

    const position = sanitizeText(body.position, 100);

    const status = body.status === "inactive" ? "inactive" : "active";

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

    const employeeRef = doc(collection(db, "employees"));

    const employeeCode = `EMP-${employeeRef.id.slice(0, 6).toUpperCase()}`;

    await setDoc(employeeRef, {
      employeeCode,

      name,

      department,

      position,

      status,

      rfidUid: null,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,

        message: "Karyawan berhasil ditambahkan.",

        employee: {
          id: employeeRef.id,

          employeeCode,

          name,

          department,

          position,

          status,

          rfidUid: null,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("[CREATE EMPLOYEE]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal menambahkan karyawan.",
      },
      {
        status: 500,
      },
    );
  }
}
