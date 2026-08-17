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

// ============================================================
// RFID CARD
// ============================================================

export interface RfidCard {
  id: string;

  uid: string;

  employeeId: string;

  employeeCode: string;

  employeeName: string;

  /*
   * active:
   * Kartu aktif dan dapat digunakan.
   *
   * inactive:
   * Kartu tetap tersimpan tetapi tidak aktif.
   *
   * Untuk sekarang fitur inactive belum kita aktifkan
   * di backend attendance.
   */
  status: "active" | "inactive";

  /*
   * Waktu pertama kali kartu dipasangkan
   * dengan karyawan.
   */
  registeredAt: string | null;

  /*
   * Waktu terakhir data kartu diperbarui.
   */
  updatedAt: string | null;
}

// ============================================================
// ATTENDANCE SETTINGS
// ============================================================

export interface AttendanceSettings {
  checkInOpen: string;

  workStart: string;

  lateStart: string;

  checkInClose: string;

  checkOutOpen: string;

  normalCheckOut: string;

  minimumWorkDurationMinutes: number;

  timezone: string;

  updatedAt: string | null;
}

// ============================================================
// RFID DEVICE
// ============================================================

export interface RfidDevice {
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

// ============================================================
// REGISTRATION SESSION
// ============================================================

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

// ============================================================
// SCAN LOG
// ============================================================

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

  /*
   * Attendance metadata.
   *
   * Optional karena log registrasi dan log lama
   * tidak memiliki field-field ini.
   */

  checkInStatus?: "early" | "on_time" | "late" | null;

  lateMinutes?: number | null;

  checkOutStatus?: "early" | "normal" | null;

  workDurationMinutes?: number | null;

  remainingMinutes?: number | null;

  createdAt: string | null;
}

// ============================================================
// ATTENDANCE
// ============================================================

export interface AttendanceRecord {
  id: string;

  dateKey: string;

  employeeId: string;

  employeeCode: string;

  employeeName: string;

  department: string;

  position: string;

  rfidUid: string;

  /*
   * checked_in:
   * Sudah absen masuk tetapi belum absen pulang.
   *
   * completed:
   * Sudah check-in dan check-out.
   */

  status: "checked_in" | "completed";

  // ==========================================================
  // CHECK IN
  // ==========================================================

  checkInAt: string | null;

  /*
   * early:
   * 06:00 - 08:59
   *
   * on_time:
   * 09:00 - 09:15
   *
   * late:
   * 09:16 - 12:00
   *
   * Optional untuk kompatibilitas dengan
   * attendanceRecords lama.
   */

  checkInStatus?: "early" | "on_time" | "late" | null;

  /*
   * Jumlah menit keterlambatan dihitung
   * dari pukul 09:00.
   *
   * Contoh:
   *
   * 09:20 -> 20
   * 10:20 -> 80
   */

  lateMinutes?: number | null;

  // ==========================================================
  // CHECK OUT
  // ==========================================================

  checkOutAt: string | null;

  /*
   * early:
   * Check-out antara 15:00 - 16:59
   * setelah memenuhi minimum 5 jam kerja.
   *
   * normal:
   * Check-out mulai 17:00.
   */

  checkOutStatus?: "early" | "normal" | null;

  /*
   * Durasi kerja dalam menit.
   *
   * Contoh:
   *
   * 300 -> 5 jam
   * 380 -> 6 jam 20 menit
   */

  workDurationMinutes?: number | null;

  // ==========================================================
  // TIMESTAMPS
  // ==========================================================

  createdAt: string | null;

  updatedAt: string | null;
}
