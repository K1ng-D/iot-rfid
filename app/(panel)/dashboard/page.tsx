"use client";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Clock3,
  Cpu,
  CreditCard,
  Radio,
  ScanLine,
  Users,
  Wifi,
} from "lucide-react";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AttendanceRecord,
  Employee,
  RfidDevice,
  ScanLog,
} from "@/types/rfid";

// ============================================================
// CONFIG
// ============================================================

const DEVICE_ONLINE_THRESHOLD = 130_000;

const PRIMARY_READER_ID = "registration-reader";

// ============================================================
// DATE / TIME HELPERS
// ============================================================

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

// ============================================================

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

// ============================================================

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Belum pernah terhubung";
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Waktu tidak diketahui";
  }

  const difference = Math.max(0, Date.now() - timestamp);

  const seconds = Math.floor(difference / 1000);

  if (seconds < 10) {
    return "Baru saja";
  }

  if (seconds < 60) {
    return `${seconds} detik lalu`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} jam lalu`;
  }

  const days = Math.floor(hours / 24);

  return `${days} hari lalu`;
}

// ============================================================

function getTodayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;

  const month = parts.find((part) => part.type === "month")?.value;

  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

// ============================================================
// DEVICE HELPERS
// ============================================================

function isDeviceOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) {
    return false;
  }

  const timestamp = new Date(lastSeenAt).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp < DEVICE_ONLINE_THRESHOLD;
}

// ============================================================

function wifiLabel(rssi: number | null) {
  if (rssi === null) {
    return "Tidak diketahui";
  }

  if (rssi >= -55) {
    return "Sangat baik";
  }

  if (rssi >= -67) {
    return "Baik";
  }

  if (rssi >= -75) {
    return "Cukup";
  }

  return "Lemah";
}

// ============================================================

function wifiPercentage(rssi: number | null) {
  if (rssi === null) {
    return 0;
  }

  if (rssi >= -50) {
    return 100;
  }

  if (rssi <= -100) {
    return 0;
  }

  return Math.round(2 * (rssi + 100));
}

// ============================================================

function formatUptime(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "-";
  }

  const days = Math.floor(seconds / 86400);

  const hours = Math.floor((seconds % 86400) / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days} hari ${hours} jam`;
  }

  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }

  return `${minutes} menit`;
}

// ============================================================
// ATTENDANCE FALLBACK
// ============================================================

function isLateAttendance(attendance: AttendanceRecord) {
  if (attendance.checkInStatus) {
    return attendance.checkInStatus === "late";
  }

  if (!attendance.checkInAt) {
    return false;
  }

  const date = new Date(attendance.checkInAt);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);

  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return false;
  }

  return hour * 60 + minute >= 9 * 60 + 16;
}

// ============================================================
// ACTIVITY LABEL
// ============================================================

function getActivityLabel(log: ScanLog) {
  switch (log.code) {
    case "CARD_REGISTERED":
      return "Kartu RFID berhasil didaftarkan";

    case "ATTENDANCE_CHECK_IN":
      return "Berhasil melakukan check-in";

    case "ATTENDANCE_CHECK_OUT":
      return "Berhasil melakukan check-out";

    case "CHECK_OUT_TOO_EARLY":
      return "Check-out belum dapat dilakukan";

    case "CHECK_IN_TOO_EARLY":
      return "Check-in belum dibuka";

    case "CHECK_IN_TIME_CLOSED":
      return "Waktu check-in telah berakhir";

    case "CARD_NOT_REGISTERED":
      return "Kartu RFID belum terdaftar";

    case "ATTENDANCE_ALREADY_COMPLETE":
      return "Absensi hari ini sudah selesai";

    case "EMPLOYEE_INACTIVE":
      return "Karyawan sedang tidak aktif";

    case "CARD_ALREADY_REGISTERED":
      return "Kartu RFID sudah terdaftar";

    default:
      return log.message || log.code || "Aktivitas RFID";
  }
}

// ============================================================
// API TYPES
// ============================================================

interface EmployeesResponse {
  success?: boolean;

  employees?: Employee[];

  message?: string;
}

interface DevicesResponse {
  success?: boolean;

  devices?: RfidDevice[];

  message?: string;
}

interface LogsResponse {
  success?: boolean;

  logs?: ScanLog[];

  message?: string;
}

interface AttendanceResponse {
  success?: boolean;

  attendance?: AttendanceRecord[];

  message?: string;
}

// ============================================================
// FETCH
// ============================================================

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "GET",

    cache: "no-store",

    signal,

    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================
// PAGE
// ============================================================

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [devices, setDevices] = useState<RfidDevice[]>([]);

  const [logs, setLogs] = useState<ScanLog[]>([]);

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [connectionError, setConnectionError] = useState(false);

  const [partialError, setPartialError] = useState(false);

  /*
   * Mencegah dua polling
   * berjalan bersamaan.
   */
  const requestRunningRef = useRef(false);

  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (requestRunningRef.current) {
      return;
    }

    requestRunningRef.current = true;

    setRefreshing(true);

    try {
      const results = await Promise.allSettled([
        fetchJson<EmployeesResponse>("/api/employees", signal),

        fetchJson<DevicesResponse>("/api/devices", signal),

        fetchJson<LogsResponse>("/api/logs", signal),

        fetchJson<AttendanceResponse>("/api/attendance", signal),
      ]);

      // ================================================
      // EMPLOYEES
      // ================================================

      const employeesResult = results[0];

      if (employeesResult.status === "fulfilled") {
        setEmployees(employeesResult.value.employees ?? []);
      } else {
        const reason = employeesResult.reason;

        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          console.warn("[DASHBOARD] Employees request gagal:", reason);
        }
      }

      // ================================================
      // DEVICES
      // ================================================

      const devicesResult = results[1];

      if (devicesResult.status === "fulfilled") {
        setDevices(devicesResult.value.devices ?? []);
      } else {
        const reason = devicesResult.reason;

        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          console.warn("[DASHBOARD] Devices request gagal:", reason);
        }
      }

      // ================================================
      // LOGS
      // ================================================

      const logsResult = results[2];

      if (logsResult.status === "fulfilled") {
        setLogs(logsResult.value.logs ?? []);
      } else {
        const reason = logsResult.reason;

        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          console.warn("[DASHBOARD] Logs request gagal:", reason);
        }
      }

      // ================================================
      // ATTENDANCE
      // ================================================

      const attendanceResult = results[3];

      if (attendanceResult.status === "fulfilled") {
        setAttendance(attendanceResult.value.attendance ?? []);
      } else {
        const reason = attendanceResult.reason;

        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          console.warn("[DASHBOARD] Attendance request gagal:", reason);
        }
      }

      // ================================================
      // CONNECTION STATUS
      // ================================================

      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;

      setConnectionError(failedCount === results.length);

      setPartialError(failedCount > 0 && failedCount < results.length);
    } finally {
      setLoading(false);

      setRefreshing(false);

      requestRunningRef.current = false;
    }
  }, []);

  // ==========================================================
  // INITIAL LOAD + POLLING
  // ==========================================================

  useEffect(() => {
    const controller = new AbortController();

    void loadData(controller.signal);

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadData();
    }, 5000);

    return () => {
      controller.abort();

      window.clearInterval(interval);

      requestRunningRef.current = false;
    };
  }, [loadData]);

  // ==========================================================
  // TODAY
  // ==========================================================

  const todayKey = getTodayKey();

  const todayAttendance = useMemo(
    () => attendance.filter((item) => item.dateKey === todayKey),
    [attendance, todayKey],
  );

  // ==========================================================
  // REGISTERED RFID
  // ==========================================================

  const registeredCount = useMemo(
    () => employees.filter((employee) => Boolean(employee.rfidUid)).length,
    [employees],
  );

  // ==========================================================
  // ONLINE READERS
  // ==========================================================

  const onlineDevices = useMemo(
    () => devices.filter((device) => isDeviceOnline(device.lastSeenAt)).length,
    [devices],
  );

  // ==========================================================
  // LATE TODAY
  // ==========================================================

  const lateToday = useMemo(
    () => todayAttendance.filter((item) => isLateAttendance(item)).length,
    [todayAttendance],
  );

  // ==========================================================
  // STILL INSIDE
  // ==========================================================

  const stillInside = useMemo(
    () => todayAttendance.filter((item) => item.status === "checked_in").length,
    [todayAttendance],
  );

  // ==========================================================
  // SUCCESS SCANS
  // ==========================================================

  const successScans = useMemo(
    () => logs.filter((log) => log.result === "success").length,
    [logs],
  );

  // ==========================================================
  // PRIMARY READER
  // ==========================================================

  const primaryDevice = useMemo(
    () =>
      devices.find((device) => device.id === PRIMARY_READER_ID) ??
      devices.find((device) =>
        device.type?.toLowerCase().includes("registration"),
      ) ??
      devices[0] ??
      null,
    [devices],
  );

  const primaryOnline = primaryDevice
    ? isDeviceOnline(primaryDevice.lastSeenAt)
    : false;

  // ==========================================================
  // CARDS
  // ==========================================================

  const cards = [
    {
      title: "Total Karyawan",

      value: employees.length,

      description: `${registeredCount} memiliki RFID`,

      icon: Users,

      variant: "primary",
    },

    {
      title: "Hadir Hari Ini",

      value: todayAttendance.length,

      description: `${
        employees.length > 0
          ? Math.max(employees.length - todayAttendance.length, 0)
          : 0
      } belum tercatat`,

      icon: CalendarCheck2,

      variant: "success",
    },

    {
      title: "Terlambat",

      value: lateToday,

      description: "Terlambat mulai 09:16",

      icon: Clock3,

      variant: "warning",
    },

    {
      title: "Belum Pulang",

      value: stillInside,

      description: "Masih berstatus check-in",

      icon: Activity,

      variant: "blue",
    },

    {
      title: "RFID Terdaftar",

      value: registeredCount,

      description: `${Math.max(
        employees.length - registeredCount,
        0,
      )} belum memiliki kartu`,

      icon: BadgeCheck,

      variant: "blue",
    },

    {
      title: "Reader Online",

      value: `${onlineDevices}/${devices.length}`,

      description: `${successScans} scan berhasil tercatat`,

      icon: Cpu,

      variant: onlineDevices > 0 ? "success" : "danger",
    },
  ];

  // ==========================================================
  // QUICK ACTIONS
  // ==========================================================

  const quickActions = [
    {
      title: "Tambah Karyawan",

      description: "Tambahkan data karyawan baru",

      href: "/employees",

      icon: Users,
    },

    {
      title: "Registrasi RFID",

      description: "Pasangkan kartu dengan karyawan",

      href: "/registration",

      icon: CreditCard,
    },

    {
      title: "Lihat Absensi",

      description: "Pantau check-in dan check-out",

      href: "/attendance",

      icon: CalendarCheck2,
    },

    {
      title: "Status Reader",

      description: "Periksa koneksi perangkat",

      href: "/devices",

      icon: Radio,
    },
  ];

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* ===================================================== */}
      {/* INTRO */}
      {/* ===================================================== */}

      <section className="mb-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
              Pantau absensi, registrasi kartu, reader, dan aktivitas RFID dari
              satu tempat.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* CONNECTION */}

            <div className="flex items-center gap-2">
              <span
                className={[
                  "size-2 rounded-full",

                  connectionError
                    ? "bg-[#ef4444]"
                    : partialError
                      ? "bg-[#f59e0b]"
                      : "bg-[#10b981]",
                ].join(" ")}
              />

              <span
                className={[
                  "text-xs font-bold",

                  connectionError
                    ? "text-[#dc2626]"
                    : partialError
                      ? "text-[#b77900]"
                      : "text-[#7b8b9f]",
                ].join(" ")}
              >
                {connectionError
                  ? "API tidak terhubung"
                  : partialError
                    ? "Sebagian data gagal"
                    : refreshing
                      ? "Memperbarui..."
                      : "Data terhubung"}
              </span>
            </div>

            {/* REFRESH */}

            
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* STATISTICS */}
      {/* ===================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card, index) => {
          const Icon = card.icon;

          const primaryCard = index === 0;

          let iconClass = "bg-[#eaf4ff] text-[#007BFF]";

          let dotClass = "bg-[#007BFF]";

          if (card.variant === "success") {
            iconClass = "bg-[#e9f9f1] text-[#10b981]";

            dotClass = "bg-[#10b981]";
          }

          if (card.variant === "warning") {
            iconClass = "bg-[#fff7e5] text-[#f59e0b]";

            dotClass = "bg-[#f59e0b]";
          }

          if (card.variant === "danger") {
            iconClass = "bg-[#fff0f0] text-[#ef4444]";

            dotClass = "bg-[#ef4444]";
          }

          return (
            <article
              key={card.title}
              className={[
                "rounded-[26px] border p-5 shadow-[0_12px_40px_rgba(30,64,100,0.05)] sm:p-6",

                primaryCard
                  ? "border-[#153d62] bg-[#0d2f53]"
                  : "border-[#dce6f1] bg-white",
              ].join(" ")}
            >
              <div className="flex items-start justify-between">
                <div
                  className={[
                    "flex size-11 items-center justify-center rounded-2xl",

                    primaryCard ? "bg-[#007BFF] text-white" : iconClass,
                  ].join(" ")}
                >
                  <Icon size={19} />
                </div>

                <span
                  className={[
                    "mt-1 size-2 rounded-full",

                    primaryCard ? "bg-[#007BFF]" : dotClass,
                  ].join(" ")}
                />
              </div>

              <div className="mt-7">
                <p
                  className={[
                    "text-[12px] font-semibold",

                    primaryCard ? "text-[#7fbaff]" : "text-[#52657a]",
                  ].join(" ")}
                >
                  {card.title}
                </p>

                <div
                  className={[
                    "mt-1.5 text-3xl font-black tracking-[-0.045em]",

                    primaryCard ? "text-white" : "text-[#101828]",
                  ].join(" ")}
                >
                  {loading ? "..." : card.value}
                </div>

                <p
                  className={[
                    "mt-2 text-[11px] font-medium leading-5",

                    primaryCard ? "text-[#b7cada]" : "text-[#8291a4]",
                  ].join(" ")}
                >
                  {card.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* ===================================================== */}
      {/* QUICK ACTION */}
      {/* ===================================================== */}

      <section className="mt-6 rounded-[28px] border border-[#dce6f1] bg-white p-5 shadow-[0_12px_40px_rgba(30,64,100,0.04)] sm:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
            Quick Actions
          </p>

          <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#101828]">
            Akses cepat
          </h2>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-4 rounded-[20px] border border-[#edf2f7] bg-[#f7fafd] p-4 transition hover:-translate-y-0.5 hover:border-[#b9d9f7] hover:bg-[#f0f7ff]"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
                  <Icon size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#172033]">
                    {action.title}
                  </p>

                  <p className="mt-1 text-[11px] font-medium leading-4 text-[#8291a4]">
                    {action.description}
                  </p>
                </div>

                <ArrowRight
                  size={15}
                  className="shrink-0 text-[#94a3b8] transition group-hover:translate-x-1 group-hover:text-[#007BFF]"
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===================================================== */}
      {/* MAIN CONTENT */}
      {/* ===================================================== */}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* =================================================== */}
        {/* READER HEALTH */}
        {/* =================================================== */}

        <section className="overflow-hidden rounded-[28px] bg-[#0d2f53] p-6 text-white shadow-[0_24px_60px_rgba(13,47,83,0.16)] sm:p-7">
          {/* HEADER */}

          <div className="flex flex-col gap-5 border-b border-[#315474] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7f9fba]">
                <Radio size={14} />
                Reader Health
              </div>

              <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-white">
                {primaryDevice?.name ?? "Registration Reader"}
              </h2>

              <p className="mt-1 text-xs font-semibold text-[#8eaac1]">
                ESP32 + RC522
              </p>
            </div>

            <div
              className={[
                "inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-black",

                primaryOnline
                  ? "bg-[#10b981]/15 text-[#6ee7b7]"
                  : "bg-[#ef4444]/15 text-[#fca5a5]",
              ].join(" ")}
            >
              <span
                className={[
                  "size-2 rounded-full",

                  primaryOnline ? "bg-[#10b981]" : "bg-[#ef4444]",
                ].join(" ")}
              />

              {primaryOnline ? "ONLINE" : "OFFLINE"}
            </div>
          </div>

          {/* INFO */}

          <div className="grid gap-3 pt-6 sm:grid-cols-2">
            {/* WIFI */}

            <div className="rounded-2xl border border-[#315474] bg-[#12385d] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#87a4bd]">
                  <Wifi size={14} />
                  Wi-Fi Signal
                </div>

                <span className="text-[10px] font-bold text-[#6ee7b7]">
                  {wifiLabel(primaryDevice?.wifiRssi ?? null)}
                </span>
              </div>

              <div className="mt-3 text-xl font-black text-white">
                {primaryDevice?.wifiRssi ?? "-"}{" "}
                <span className="text-xs font-semibold text-[#87a4bd]">
                  dBm
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#0d2f53]">
                <div
                  className="h-full rounded-full bg-[#007BFF] transition-all duration-500"
                  style={{
                    width: `${wifiPercentage(
                      primaryDevice?.wifiRssi ?? null,
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* FIRMWARE */}

            <div className="rounded-2xl border border-[#315474] bg-[#12385d] p-4">
              <div className="flex items-center gap-2 text-xs text-[#87a4bd]">
                <Cpu size={14} />
                Firmware
              </div>

              <div className="mt-3 text-xl font-black text-white">
                {primaryDevice?.firmwareVersion ?? "-"}
              </div>

              <p className="mt-1 text-xs font-semibold text-[#87a4bd]">
                Registration + Attendance Reader
              </p>
            </div>
          </div>

          {/* HEARTBEAT */}

          <div className="mt-3 rounded-2xl border border-[#315474] bg-[#12385d] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-[#87a4bd]">
                  Last heartbeat
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  {formatRelativeTime(primaryDevice?.lastSeenAt ?? null)}
                </p>
              </div>

              <p className="text-[11px] font-semibold text-[#7f9fba]">
                {primaryDevice?.lastSeenAt
                  ? formatDateTime(primaryDevice.lastSeenAt)
                  : "-"}
              </p>
            </div>
          </div>

          {/* UPTIME */}

          <div className="mt-3 rounded-2xl border border-[#315474] bg-[#12385d] p-4">
            <p className="text-xs font-semibold text-[#87a4bd]">Uptime ESP32</p>

            <p className="mt-2 text-sm font-bold text-white">
              {formatUptime(primaryDevice?.uptimeSeconds)}
            </p>
          </div>

          {/* DEVICE LINK */}

          <Link
            href="/devices"
            className="mt-5 inline-flex items-center gap-2 text-xs font-black text-[#80bdff] transition hover:text-white"
          >
            Lihat detail perangkat
            <ArrowRight size={14} />
          </Link>
        </section>

        {/* =================================================== */}
        {/* RECENT ACTIVITY */}
        {/* =================================================== */}

        <section className="rounded-[28px] border border-[#dce6f1] bg-white p-6 shadow-[0_12px_40px_rgba(30,64,100,0.05)] sm:p-7">
          {/* HEADER */}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
                Live Activity
              </p>

              <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#101828]">
                Aktivitas terbaru
              </h2>
            </div>

            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[#007BFF]">
              <Activity size={18} />
            </div>
          </div>

          {/* LOGS */}

          <div className="mt-6 space-y-2">
            {logs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 rounded-2xl p-3.5 transition hover:bg-[#f5f9fd]"
              >
                {/* RESULT */}

                <span
                  className={[
                    "mt-1.5 size-2.5 shrink-0 rounded-full",

                    log.result === "success"
                      ? "bg-[#10b981]"
                      : log.result === "warning"
                        ? "bg-[#f59e0b]"
                        : "bg-[#ef4444]",
                  ].join(" ")}
                />

                {/* CONTENT */}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[#172033]">
                    {log.employeeName ?? log.uid ?? "Kartu tidak dikenal"}
                  </p>

                  <p className="mt-1 line-clamp-1 text-[11px] font-medium leading-5 text-[#8291a4]">
                    {getActivityLabel(log)}
                  </p>
                </div>

                {/* TIME */}

                <time className="shrink-0 text-[11px] font-semibold text-[#8b99aa]">
                  {formatTime(log.createdAt)}
                </time>
              </div>
            ))}

            {/* EMPTY */}

            {!loading && logs.length === 0 && (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#eaf4ff] text-[#007BFF]">
                  <ScanLine size={23} />
                </div>

                <p className="mt-4 text-sm font-black text-[#52657a]">
                  Belum ada aktivitas
                </p>

                <p className="mt-1 text-xs text-[#8a99aa]">
                  Scan kartu RFID akan muncul di sini.
                </p>
              </div>
            )}
          </div>

          {/* LOG LINK */}

          {logs.length > 0 && (
            <Link
              href="/logs"
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] text-xs font-black text-[#52657a] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
            >
              Lihat semua aktivitas
              <ArrowRight size={14} />
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
