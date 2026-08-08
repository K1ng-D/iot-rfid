import { NextResponse } from "next/server";

import { collection, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { serializeFirestoreValue } from "@/lib/firestore-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "devices"));

    const devices = snapshot.docs.map((document) => {
      const data = document.data();

      /*
       * JANGAN pernah kirim secret
       * device ke frontend.
       */
      const { secret: _secret, ...safeData } = data;

      void _secret;

      return {
        id: document.id,

        ...(serializeFirestoreValue(safeData) as Record<string, unknown>),
      };
    });

    return NextResponse.json({
      success: true,

      devices,
    });
  } catch (error) {
    console.error("[DEVICES]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal mengambil data perangkat.",
      },
      {
        status: 500,
      },
    );
  }
}
