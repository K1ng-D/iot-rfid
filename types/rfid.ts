export interface Employee {
  id: string;

  employeeCode: string;

  name: string;

  department: string;

  position: string;

  status: "active" | "inactive";

  rfidUid: string | null;

  createdAt: string | null;

  updatedAt: string | null;
}

export interface RfidDevice {
  /**
   * Hanya digunakan sebagai internal React key.
   * BUKAN Device ID dari ESP32.
   */
  id: string;

  name: string;

  type: string;

  firmwareVersion: string | null;

  wifiRssi: number | null;

  uptimeSeconds?: number | null;

  status?: string | null;

  lastSeenAt: string | null;

  createdAt?: string | null;

  updatedAt?: string | null;
}

export interface RegistrationSession {
  id: string;

  employeeId: string;

  employeeCode: string;

  employeeName: string;

  status: "waiting" | "completed" | "cancelled" | "failed";

  uid: string | null;

  createdAt: string | null;

  updatedAt?: string | null;

  completedAt: string | null;

  cancelledAt?: string | null;
}

export interface ScanLog {
  id: string;

  uid: string;

  readerType?: string | null;

  action: string;

  result: "success" | "warning" | "error";

  code: string;

  employeeId: string | null;

  employeeName: string | null;

  message: string;

  createdAt: string | null;
}
