import { NextResponse } from "next/server";

import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { firestoreDocumentToJson } from "@/lib/firestore-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const sessionSnapshot = await getDoc(doc(db, "registrationSessions", id));

    if (!sessionSnapshot.exists()) {
      return NextResponse.json(
        {
          success: false,

          message: "Sesi registrasi tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,

      session: firestoreDocumentToJson(sessionSnapshot),
    });
  } catch (error) {
    console.error("[REGISTRATION SESSION]", error);

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
