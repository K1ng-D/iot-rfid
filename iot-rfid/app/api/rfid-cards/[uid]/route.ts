import { NextResponse } from "next/server";

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import { isValidRfidUid, normalizeRfidUid } from "@/lib/rfid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// TYPES
// ============================================================

type CardStatus = "active" | "inactive";

interface UpdateCardBody {
  status?: CardStatus;
}

// ============================================================
// HELPERS
// ============================================================

function isValidStatus(value: unknown): value is CardStatus {
  return value === "active" || value === "inactive";
}

// ============================================================
// PATCH
// ACTIVE / INACTIVE RFID CARD
// ============================================================

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      uid: string;
    }>;
  },
) {
  try {
    // ========================================================
    // UID
    // ========================================================

    const { uid: rawUid } = await params;

    const uid = normalizeRfidUid(rawUid);

    if (!isValidRfidUid(uid)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_UID",
          message: "Format UID kartu RFID tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // BODY
    // ========================================================

    let body: UpdateCardBody;

    try {
      body = (await request.json()) as UpdateCardBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_JSON",
          message: "Body request tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidStatus(body.status)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_STATUS",
          message: "Status kartu harus active atau inactive.",
        },
        {
          status: 400,
        },
      );
    }

    const nextStatus = body.status;

    // ========================================================
    // REFERENCES
    // ========================================================

    const cardRef = doc(db, "rfidCards", uid);

    const logRef = doc(collection(db, "scanLogs"));

    // ========================================================
    // TRANSACTION
    // ========================================================

    const result = await runTransaction(db, async (transaction) => {
      // ====================================================
      // READ CARD
      // ====================================================

      const cardSnapshot = await transaction.get(cardRef);

      if (!cardSnapshot.exists()) {
        return {
          type: "not_found" as const,
        };
      }

      const card = cardSnapshot.data();

      const employeeId =
        typeof card.employeeId === "string" ? card.employeeId : "";

      const employeeName =
        typeof card.employeeName === "string" ? card.employeeName : "";

      const employeeCode =
        typeof card.employeeCode === "string" ? card.employeeCode : "";

      const currentStatus: CardStatus =
        card.status === "inactive" ? "inactive" : "active";

      // ====================================================
      // ALREADY SAME STATUS
      // ====================================================

      if (currentStatus === nextStatus) {
        return {
          type: "unchanged" as const,
          employeeId,
          employeeName,
          employeeCode,
          status: currentStatus,
        };
      }

      /*
       * Semua read sudah selesai.
       * Setelah ini baru melakukan write.
       */

      // ====================================================
      // UPDATE CARD
      // ====================================================

      transaction.update(cardRef, {
        status: nextStatus,

        updatedAt: serverTimestamp(),
      });

      // ====================================================
      // AUDIT LOG
      // ====================================================

      transaction.set(logRef, {
        uid,

        readerType: "registration",

        action: nextStatus === "active" ? "activate_card" : "deactivate_card",

        result: "success",

        code: nextStatus === "active" ? "CARD_ACTIVATED" : "CARD_DEACTIVATED",

        employeeId: employeeId || null,

        employeeName: employeeName || null,

        employeeCode: employeeCode || null,

        message:
          nextStatus === "active"
            ? employeeName
              ? `Kartu RFID milik ${employeeName} diaktifkan.`
              : "Kartu RFID berhasil diaktifkan."
            : employeeName
              ? `Kartu RFID milik ${employeeName} dinonaktifkan.`
              : "Kartu RFID berhasil dinonaktifkan.",

        createdAt: serverTimestamp(),
      });

      return {
        type: "success" as const,

        employeeId,

        employeeName,

        employeeCode,

        status: nextStatus,
      };
    });

    // ========================================================
    // NOT FOUND
    // ========================================================

    if (result.type === "not_found") {
      return NextResponse.json(
        {
          success: false,
          code: "CARD_NOT_FOUND",
          message: "Kartu RFID tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // UNCHANGED
    // ========================================================

    if (result.type === "unchanged") {
      return NextResponse.json({
        success: true,

        code:
          result.status === "active"
            ? "CARD_ALREADY_ACTIVE"
            : "CARD_ALREADY_INACTIVE",

        status: result.status,

        message:
          result.status === "active"
            ? "Kartu RFID sudah dalam kondisi aktif."
            : "Kartu RFID sudah dalam kondisi nonaktif.",
      });
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    return NextResponse.json({
      success: true,

      code: result.status === "active" ? "CARD_ACTIVATED" : "CARD_DEACTIVATED",

      status: result.status,

      employeeId: result.employeeId,

      employeeCode: result.employeeCode,

      message:
        result.status === "active"
          ? result.employeeName
            ? `Kartu RFID ${result.employeeName} berhasil diaktifkan.`
            : "Kartu RFID berhasil diaktifkan."
          : result.employeeName
            ? `Kartu RFID ${result.employeeName} berhasil dinonaktifkan.`
            : "Kartu RFID berhasil dinonaktifkan.",
    });
  } catch (error) {
    console.error("[RFID CARD PATCH]", error);

    return NextResponse.json(
      {
        success: false,
        code: "SERVER_ERROR",
        message: "Gagal memperbarui status kartu RFID.",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// DELETE
// UNLINK RFID CARD
// ============================================================

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      uid: string;
    }>;
  },
) {
  try {
    // ========================================================
    // UID
    // ========================================================

    const { uid: rawUid } = await params;

    const uid = normalizeRfidUid(rawUid);

    if (!isValidRfidUid(uid)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_UID",
          message: "Format UID kartu RFID tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    // ========================================================
    // REFERENCES
    // ========================================================

    const cardRef = doc(db, "rfidCards", uid);

    const logRef = doc(collection(db, "scanLogs"));

    // ========================================================
    // TRANSACTION
    // ========================================================

    const result = await runTransaction(db, async (transaction) => {
      // ================================================
      // READ CARD
      // ================================================

      const cardSnapshot = await transaction.get(cardRef);

      if (!cardSnapshot.exists()) {
        return {
          type: "not_found" as const,
        };
      }

      const card = cardSnapshot.data();

      const employeeId =
        typeof card.employeeId === "string" ? card.employeeId : "";

      const employeeName =
        typeof card.employeeName === "string" ? card.employeeName : "";

      const employeeCode =
        typeof card.employeeCode === "string" ? card.employeeCode : "";

      // ================================================
      // READ EMPLOYEE
      // ================================================

      const employeeRef = employeeId ? doc(db, "employees", employeeId) : null;

      const employeeSnapshot = employeeRef
        ? await transaction.get(employeeRef)
        : null;

      /*
       * Semua read selesai.
       * Setelah ini baru melakukan write.
       */

      // ================================================
      // REMOVE RFID FROM EMPLOYEE
      // ================================================

      if (employeeRef && employeeSnapshot?.exists()) {
        const employee = employeeSnapshot.data();

        /*
         * Jangan menghapus UID jika employee
         * sudah menunjuk kartu RFID yang berbeda.
         */

        if (employee.rfidUid === uid) {
          transaction.update(employeeRef, {
            rfidUid: null,

            updatedAt: serverTimestamp(),
          });
        }
      }

      // ================================================
      // DELETE CARD
      // ================================================

      transaction.delete(cardRef);

      // ================================================
      // LOG
      // ================================================

      transaction.set(logRef, {
        uid,

        readerType: "registration",

        action: "unregister",

        result: "success",

        code: "CARD_UNLINKED",

        employeeId: employeeId || null,

        employeeName: employeeName || null,

        employeeCode: employeeCode || null,

        message: employeeName
          ? `Kartu RFID dilepas dari ${employeeName}.`
          : "Kartu RFID berhasil dilepas.",

        createdAt: serverTimestamp(),
      });

      return {
        type: "success" as const,

        employeeId,

        employeeName,

        employeeCode,
      };
    });

    // ========================================================
    // NOT FOUND
    // ========================================================

    if (result.type === "not_found") {
      return NextResponse.json(
        {
          success: false,
          code: "CARD_NOT_FOUND",

          message: "Kartu RFID tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    return NextResponse.json({
      success: true,

      code: "CARD_UNLINKED",

      employeeId: result.employeeId,

      employeeCode: result.employeeCode,

      message: result.employeeName
        ? `Kartu RFID berhasil dilepas dari ${result.employeeName}.`
        : "Kartu RFID berhasil dilepas.",
    });
  } catch (error) {
    console.error("[RFID CARD DELETE]", error);

    return NextResponse.json(
      {
        success: false,
        code: "SERVER_ERROR",
        message: "Gagal melepas kartu RFID.",
      },
      {
        status: 500,
      },
    );
  }
}
