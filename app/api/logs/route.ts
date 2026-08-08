import { NextResponse } from "next/server";

import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { firestoreDocumentToJson } from "@/lib/firestore-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logsQuery = query(
      collection(db, "scanLogs"),

      orderBy("createdAt", "desc"),

      limit(100),
    );

    const snapshot = await getDocs(logsQuery);

    const logs = snapshot.docs
      .map((document) => firestoreDocumentToJson(document))
      .filter(Boolean);

    return NextResponse.json({
      success: true,

      logs,
    });
  } catch (error) {
    console.error("[LOGS]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal mengambil riwayat RFID.",
      },
      {
        status: 500,
      },
    );
  }
}
