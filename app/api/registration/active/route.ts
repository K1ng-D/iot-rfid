import { NextResponse } from "next/server";

import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { firestoreDocumentToJson } from "@/lib/firestore-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const controlRef = doc(db, "system", "rfid-registration");

    const controlSnapshot = await getDoc(controlRef);

    if (!controlSnapshot.exists()) {
      return NextResponse.json({
        success: true,

        session: null,
      });
    }

    const activeSessionId = controlSnapshot.data().activeSessionId;

    if (typeof activeSessionId !== "string" || !activeSessionId) {
      return NextResponse.json({
        success: true,

        session: null,
      });
    }

    const sessionSnapshot = await getDoc(
      doc(db, "registrationSessions", activeSessionId),
    );

    if (!sessionSnapshot.exists()) {
      return NextResponse.json({
        success: true,

        session: null,
      });
    }

    return NextResponse.json({
      success: true,

      session: firestoreDocumentToJson(sessionSnapshot),
    });
  } catch (error) {
    console.error("[ACTIVE REGISTRATION]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal membaca sesi registrasi.",
      },
      {
        status: 500,
      },
    );
  }
}
