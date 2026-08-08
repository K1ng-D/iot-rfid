import { NextResponse } from "next/server";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { authenticateDevice } from "@/lib/device-auth";

import { sanitizeText, sanitizeWifiRssi } from "@/lib/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HeartbeatBody {
  type?: unknown;

  firmwareVersion?: unknown;

  wifiRssi?: unknown;

  uptimeSeconds?: unknown;
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateDevice(request);

    if (!auth.ok) {
      return NextResponse.json(
        {
          success: false,

          code: auth.code,

          message: auth.message,
        },
        {
          status: auth.status,
        },
      );
    }

    const body = (await request.json()) as HeartbeatBody;

    const firmwareVersion = sanitizeText(body.firmwareVersion, 40);

    const wifiRssi = sanitizeWifiRssi(body.wifiRssi);

    const uptimeSeconds =
      typeof body.uptimeSeconds === "number" &&
      Number.isFinite(body.uptimeSeconds)
        ? Math.max(0, Math.floor(body.uptimeSeconds))
        : null;

    await setDoc(
      doc(db, "devices", auth.deviceId),
      {
        firmwareVersion: firmwareVersion || null,

        wifiRssi,

        uptimeSeconds,

        lastSeenAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );

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
