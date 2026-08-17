import { NextResponse } from "next/server";

import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { serializeFirestoreValue } from "@/lib/firestore-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READER_DOCUMENT = "registration-reader";

export async function GET() {
  try {
    const readerRef = doc(db, "devices", READER_DOCUMENT);

    const snapshot = await getDoc(readerRef);

    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,

        devices: [],
      });
    }

    const data = snapshot.data();

    const reader = {
      /*
       * Internal React key.
       * Tidak ditampilkan sebagai Device ID.
       */
      id: "registration-reader",

      ...(serializeFirestoreValue(data) as Record<string, unknown>),
    };

    return NextResponse.json({
      success: true,

      devices: [reader],
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
