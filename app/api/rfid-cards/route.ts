import { NextResponse } from "next/server";

import { collection, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// HELPERS
// ============================================================

function timestampToIso(value: unknown) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      const date = (
        value as {
          toDate: () => Date;
        }
      ).toDate();

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      return null;
    }
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    return null;
  }

  if (typeof value === "string") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

// ============================================================
// GET RFID CARDS
// ============================================================

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "rfidCards"));

    const cards = snapshot.docs
      .map((document) => {
        const data = document.data();

        const registeredAt = data.registeredAt ?? data.createdAt ?? null;

        return {
          id: document.id,

          uid:
            typeof data.uid === "string" && data.uid.trim()
              ? data.uid
              : document.id,

          employeeId:
            typeof data.employeeId === "string" ? data.employeeId : "",

          employeeCode:
            typeof data.employeeCode === "string" ? data.employeeCode : "",

          employeeName:
            typeof data.employeeName === "string" ? data.employeeName : "",

          status:
            data.status === "inactive"
              ? ("inactive" as const)
              : ("active" as const),

          registeredAt: timestampToIso(registeredAt),

          updatedAt: timestampToIso(data.updatedAt),
        };
      })
      .sort((a, b) => {
        const timeA = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;

        const timeB = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;

        return timeB - timeA;
      });

    return NextResponse.json({
      success: true,

      cards,
    });
  } catch (error) {
    console.error("[RFID CARDS GET]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal mengambil data kartu RFID.",
      },
      {
        status: 500,
      },
    );
  }
}
