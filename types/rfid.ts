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
  id: string;

  deviceId: string;

  name: string;

  type: string;

  enabled: boolean;

  firmwareVersion: string | null;

  wifiRssi: number | null;

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

  deviceId: string | null;

  createdAt: string | null;

  completedAt: string | null;

  cancelledAt?: string | null;
}

export interface ScanLog {
  id: string;

  uid: string;

  deviceId: string;

  deviceType: string;

  action: string;

  result: "success" | "warning" | "error";

  code: string;

  employeeId: string | null;

  employeeName: string | null;

  message: string;

  createdAt: string | null;
}
