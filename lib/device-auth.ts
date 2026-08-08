import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

interface DeviceData {
  deviceId?: string;
  name?: string;
  type?: string;
  secret?: string;
  enabled?: boolean;
}

interface DeviceAuthSuccess {
  ok: true;

  deviceId: string;

  device: DeviceData;
}

interface DeviceAuthError {
  ok: false;

  status: number;

  code: string;

  message: string;
}

export type DeviceAuthResult = DeviceAuthSuccess | DeviceAuthError;

export async function authenticateDevice(
  request: Request,
): Promise<DeviceAuthResult> {
  const deviceId = request.headers.get("x-device-id")?.trim() ?? "";

  const deviceSecret = request.headers.get("x-device-secret")?.trim() ?? "";

  if (!deviceId || !deviceSecret) {
    return {
      ok: false,

      status: 401,

      code: "MISSING_DEVICE_CREDENTIALS",

      message: "Device ID atau device secret tidak dikirim.",
    };
  }

  try {
    const deviceRef = doc(db, "devices", deviceId);

    const deviceSnapshot = await getDoc(deviceRef);

    if (!deviceSnapshot.exists()) {
      return {
        ok: false,

        status: 401,

        code: "INVALID_DEVICE",

        message: "Perangkat tidak terdaftar.",
      };
    }

    const device = deviceSnapshot.data() as DeviceData;

    if (device.enabled === false) {
      return {
        ok: false,

        status: 403,

        code: "DEVICE_DISABLED",

        message: "Perangkat sedang dinonaktifkan.",
      };
    }

    if (typeof device.secret !== "string" || device.secret !== deviceSecret) {
      return {
        ok: false,

        status: 403,

        code: "UNAUTHORIZED_DEVICE",

        message: "Device secret tidak valid.",
      };
    }

    return {
      ok: true,

      deviceId,

      device,
    };
  } catch (error) {
    console.error("[DEVICE AUTH]", error);

    return {
      ok: false,

      status: 500,

      code: "DEVICE_AUTH_ERROR",

      message: "Gagal memverifikasi perangkat.",
    };
  }
}
