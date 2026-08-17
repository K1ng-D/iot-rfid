import { NextResponse } from "next/server";

import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CancelBody {
  sessionId?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CancelBody;

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,

          message: "Session ID tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    const sessionRef = doc(db, "registrationSessions", sessionId);

    const controlRef = doc(db, "system", "rfid-registration");

    await runTransaction(db, async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionRef);

      const controlSnapshot = await transaction.get(controlRef);

      if (!sessionSnapshot.exists()) {
        return;
      }

      if (sessionSnapshot.data().status === "waiting") {
        transaction.update(sessionRef, {
          status: "cancelled",

          cancelledAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });
      }

      if (
        controlSnapshot.exists() &&
        controlSnapshot.data().activeSessionId === sessionId
      ) {
        transaction.set(
          controlRef,
          {
            activeSessionId: null,

            updatedAt: serverTimestamp(),
          },
          {
            merge: true,
          },
        );
      }
    });

    return NextResponse.json({
      success: true,

      message: "Registrasi dibatalkan.",
    });
  } catch (error) {
    console.error("[CANCEL REGISTRATION]", error);

    return NextResponse.json(
      {
        success: false,

        message: "Gagal membatalkan registrasi.",
      },
      {
        status: 500,
      },
    );
  }
}
