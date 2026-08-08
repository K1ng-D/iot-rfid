import { NextResponse } from "next/server";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { sanitizeText, sanitizeWifiRssi } from "@/lib/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nama document Firestore ini HANYA internal database.
 *
 * ESP32 tidak mengetahui nilai ini.
 * Ini bukan Device ID dan bukan credential.
 */
const READER_DOCUMENT = "registration-reader";

interface HeartbeatBody {
  type?: unknown;

  firmwareVersion?: unknown;

  wifiRssi?: unknown;

  uptimeSeconds?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HeartbeatBody;

    // ========================================================
    // READER TYPE
    // ========================================================

    const readerType = sanitizeText(body.type, 40) || "registration";

    // ========================================================
    // FIRMWARE
    // ========================================================

    const firmwareVersion = sanitizeText(body.firmwareVersion, 40);

    // ========================================================
    // WIFI RSSI
    // ========================================================

    const wifiRssi = sanitizeWifiRssi(body.wifiRssi);

    // ========================================================
    // UPTIME
    // ========================================================

    const uptimeSeconds =
      typeof body.uptimeSeconds === "number" &&
      Number.isFinite(body.uptimeSeconds)
        ? Math.max(0, Math.floor(body.uptimeSeconds))
        : null;

    // ========================================================
    // FIRESTORE
    // ========================================================

    const readerRef = doc(db, "devices", READER_DOCUMENT);

    await setDoc(
      readerRef,
      {
        name: "Registration Reader",

        type: readerType,

        firmwareVersion: firmwareVersion || null,

        wifiRssi,

        uptimeSeconds,

        status: "online",

        lastSeenAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,

      code: "HEARTBEAT_ACCEPTED",

      message: "Heartbeat diterima.",
    });
  } catch (error) {
    console.error("[HEARTBEAT]", error);

    return NextResponse.json(
      {
        success: false,

        code: "SERVER_ERROR",

        message: "Gagal memproses heartbeat.",
      },
      {
        status: 500,
      },
    );
  }
}
