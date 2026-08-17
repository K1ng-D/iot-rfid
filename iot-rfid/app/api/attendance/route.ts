import { NextResponse } from "next/server";

import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { firestoreDocumentToJson } from "@/lib/firestore-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const attendanceQuery = query(
      collection(db, "attendanceRecords"),

      orderBy("updatedAt", "desc"),

      limit(200),
    );

    const snapshot = await getDocs(attendanceQuery);

    const attendance = snapshot.docs
      .map((document) => firestoreDocumentToJson(document))
      .filter(Boolean);

    return NextResponse.json({
      success: true,

      attendance,
    });
  } catch (error) {
    console.error("[GET ATTENDANCE]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal mengambil data absensi.",
      },
      {
        status: 500,
      },
    );
  }
}
