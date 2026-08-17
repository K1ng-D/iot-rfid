"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  RotateCcw,
  Search,
  Timer,
  UserRound,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AttendanceRecord } from "@/types/rfid";

// ============================================================
// TYPES
// ============================================================

type StatusFilter = "all" | "checked_in" | "completed" | "late";

// ============================================================
// DATE HELPERS
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
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

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

function formatDateKey(dateKey: string) {
  if (!dateKey) {
    return "-";
  }

  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return dateKey;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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
// OLD DATA FALLBACK
// ============================================================

function getJakartaHourMinute(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
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
    return null;
  }

  return {
    hour,
    minute,
  };
}

// ============================================================
// CHECK-IN STATUS
//
// Record baru:
// → langsung baca checkInStatus dari backend.
//
// Record lama:
// → fallback berdasarkan checkInAt.
// ============================================================

function getCheckInStatus(
  item: AttendanceRecord,
): "early" | "on_time" | "late" | null {
  if (
    item.checkInStatus === "early" ||
    item.checkInStatus === "on_time" ||
    item.checkInStatus === "late"
  ) {
    return item.checkInStatus;
  }

  const time = getJakartaHourMinute(item.checkInAt);

  if (!time) {
    return null;
  }

  const minutes = time.hour * 60 + time.minute;

  if (minutes < 9 * 60) {
    return "early";
  }

  if (minutes < 9 * 60 + 16) {
    return "on_time";
  }

  return "late";
}

// ============================================================
// LATE
// ============================================================

function isLate(item: AttendanceRecord) {
  return getCheckInStatus(item) === "late";
}

// ============================================================
// LATE MINUTES
//
// Prioritas:
// 1. lateMinutes dari backend.
// 2. fallback timestamp untuk data lama.
// ============================================================

function getLateMinutes(item: AttendanceRecord) {
  if (
    typeof item.lateMinutes === "number" &&
    Number.isFinite(item.lateMinutes)
  ) {
    return Math.max(0, item.lateMinutes);
  }

  const time = getJakartaHourMinute(item.checkInAt);

  if (!time) {
    return 0;
  }

  const checkInMinutes = time.hour * 60 + time.minute;

  return Math.max(0, checkInMinutes - 9 * 60);
}

// ============================================================
// DURATION FORMAT
// ============================================================

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  const hours = Math.floor(safeMinutes / 60);

  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}j`;
  }

  return `${hours}j ${remainingMinutes}m`;
}

// ============================================================
// WORK DURATION
//
// Prioritas:
// 1. workDurationMinutes dari backend.
// 2. fallback timestamp untuk record lama.
// ============================================================

function getWorkDurationMinutes(item: AttendanceRecord) {
  if (
    typeof item.workDurationMinutes === "number" &&
    Number.isFinite(item.workDurationMinutes)
  ) {
    return Math.max(0, item.workDurationMinutes);
  }

  if (!item.checkInAt || !item.checkOutAt) {
    return null;
  }

  const checkIn = new Date(item.checkInAt).getTime();

  const checkOut = new Date(item.checkOutAt).getTime();

  if (
    !Number.isFinite(checkIn) ||
    !Number.isFinite(checkOut) ||
    checkOut <= checkIn
  ) {
    return null;
  }

  return Math.floor((checkOut - checkIn) / 60_000);
}

// ============================================================

function formatWorkDuration(item: AttendanceRecord) {
  const minutes = getWorkDurationMinutes(item);

  if (minutes === null) {
    return "-";
  }

  return formatDuration(minutes);
}

// ============================================================
// CHECK-IN STATUS LABEL
// ============================================================

function getCheckInStatusLabel(item: AttendanceRecord) {
  const status = getCheckInStatus(item);

  if (status === "early") {
    return "DATANG LEBIH AWAL";
  }

  if (status === "on_time") {
    return "TEPAT WAKTU";
  }

  if (status === "late") {
    return "TERLAMBAT";
  }

  return null;
}

// ============================================================
// PAGE
// ============================================================

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [dateFilter, setDateFilter] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const todayKey = getTodayKey();

  // ==========================================================
  // LOAD ATTENDANCE
  // ==========================================================

  const loadAttendance = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance", {
        cache: "no-store",
      });

      const data = await response.json();

      setAttendance(data.attendance ?? []);
    } catch (error) {
      console.error("[ATTENDANCE]", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // POLLING
  // ==========================================================

  useEffect(() => {
    void loadAttendance();

    const interval = window.setInterval(() => {
      void loadAttendance();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [loadAttendance]);

  // ==========================================================
  // TODAY
  // ==========================================================

  const todayAttendance = useMemo(
    () => attendance.filter((item) => item.dateKey === todayKey),
    [attendance, todayKey],
  );

  // ==========================================================
  // COMPLETED TODAY
  // ==========================================================

  const completedToday = useMemo(
    () => todayAttendance.filter((item) => item.status === "completed").length,
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
  // LATE TODAY
  // ==========================================================

  const lateToday = useMemo(
    () => todayAttendance.filter((item) => isLate(item)).length,
    [todayAttendance],
  );

  // ==========================================================
  // FILTER
  // ==========================================================

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return attendance.filter((item) => {
      const matchesSearch =
        !keyword ||
        [
          item.employeeName,
          item.employeeCode,
          item.department,
          item.position,
          item.rfidUid,
          item.dateKey,
        ].some((value) => value.toLowerCase().includes(keyword));

      const matchesDate = !dateFilter || item.dateKey === dateFilter;

      let matchesStatus = true;

      if (statusFilter === "checked_in") {
        matchesStatus = item.status === "checked_in";
      }

      if (statusFilter === "completed") {
        matchesStatus = item.status === "completed";
      }

      if (statusFilter === "late") {
        matchesStatus = isLate(item);
      }

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [attendance, search, dateFilter, statusFilter]);

  // ==========================================================
  // FILTER ACTIVE
  // ==========================================================

  const hasFilter =
    search.trim() !== "" || dateFilter !== "" || statusFilter !== "all";

  function resetFilter() {
    setSearch("");

    setDateFilter("");

    setStatusFilter("all");
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* ===================================================== */}
      {/* INTRO */}
      {/* ===================================================== */}

      <div>
        <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
          Pantau jam masuk dan jam pulang karyawan berdasarkan scan kartu RFID.
        </p>
      </div>

      {/* ===================================================== */}
      {/* STAT CARDS */}
      {/* ===================================================== */}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* HADIR */}

        <article className="rounded-[26px] border border-[#153d62] bg-[#0d2f53] p-6 shadow-[0_12px_40px_rgba(13,47,83,0.08)]">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
            <CalendarDays size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-white">
            {loading ? "..." : todayAttendance.length}
          </p>

          <p className="mt-1 text-xs font-bold text-[#b7cada]">
            Hadir hari ini
          </p>
        </article>

        {/* LATE */}

        <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6 shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff7e5] text-[#f59e0b]">
            <Clock3 size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
            {loading ? "..." : lateToday}
          </p>

          <p className="mt-1 text-xs font-bold text-[#8291a4]">Terlambat</p>
        </article>

        {/* STILL INSIDE */}

        <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6 shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[#007BFF]">
            <LogIn size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
            {loading ? "..." : stillInside}
          </p>

          <p className="mt-1 text-xs font-bold text-[#8291a4]">
            Belum absen pulang
          </p>
        </article>

        {/* COMPLETED */}

        <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6 shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e9f9f1] text-[#10b981]">
            <CheckCircle2 size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
            {loading ? "..." : completedToday}
          </p>

          <p className="mt-1 text-xs font-bold text-[#8291a4]">Sudah pulang</p>
        </article>
      </div>

      {/* ===================================================== */}
      {/* TABLE */}
      {/* ===================================================== */}

      <section className="mt-6 overflow-hidden rounded-[28px] border border-[#dce6f1] bg-white shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
        {/* TABLE HEADER */}

        <div className="border-b border-[#edf2f7] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#101828]">
                Riwayat Absensi
              </h2>

              <p className="mt-1 text-xs text-[#8291a4]">
                {filtered.length} data absensi
              </p>
            </div>

            {/* FILTER */}

            <div className="flex w-full flex-col gap-3 md:flex-row xl:w-auto">
              {/* SEARCH */}

              <div className="relative w-full md:min-w-[250px] xl:w-72">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#007BFF]"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari karyawan..."
                  className="h-11 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] pl-11 pr-4 text-sm font-medium text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                />
              </div>

              {/* DATE */}

              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
              />

              {/* STATUS */}

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
              >
                <option value="all">Semua Status</option>

                <option value="checked_in">Belum Pulang</option>

                <option value="completed">Selesai</option>

                <option value="late">Terlambat</option>
              </select>

              {hasFilter && (
                <button
                  type="button"
                  onClick={resetFilter}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#dce6f1] bg-white px-4 text-sm font-bold text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
                >
                  <RotateCcw size={15} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* =================================================== */}
        {/* DESKTOP */}
        {/* =================================================== */}

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#edf2f7] bg-[#f7fafd] text-left">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                  Karyawan
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                  Tanggal
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                  Jam Masuk
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                  Jam Pulang
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                  Durasi
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => {
                const checkInStatus = getCheckInStatus(item);

                const checkInLabel = getCheckInStatusLabel(item);

                const late = checkInStatus === "late";

                const lateMinutes = getLateMinutes(item);

                const earlyCheckout = item.checkOutStatus === "early";

                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#edf2f7] last:border-0 hover:bg-[#f7fafd]"
                  >
                    {/* EMPLOYEE */}

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
                          <UserRound size={17} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#172033]">
                            {item.employeeName}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-[#8291a4]">
                            {item.employeeCode} · {item.department}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* DATE */}

                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-[#52657a]">
                        {formatDateKey(item.dateKey)}
                      </p>
                    </td>

                    {/* CHECK-IN */}

                    <td className="px-6 py-5">
                      <div
                        className={[
                          "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black",

                          checkInStatus === "late"
                            ? "bg-[#fff7e5] text-[#b77900]"
                            : checkInStatus === "early"
                              ? "bg-[#eaf4ff] text-[#007BFF]"
                              : "bg-[#e9f9f1] text-[#07875f]",
                        ].join(" ")}
                      >
                        <LogIn size={14} />

                        {formatTime(item.checkInAt)}
                      </div>

                      {late && (
                        <p className="mt-1.5 text-[10px] font-bold text-[#d68a00]">
                          +{formatDuration(lateMinutes)}
                        </p>
                      )}

                      {!late && checkInLabel && (
                        <p
                          className={[
                            "mt-1.5 text-[10px] font-bold",

                            checkInStatus === "early"
                              ? "text-[#007BFF]"
                              : "text-[#07875f]",
                          ].join(" ")}
                        >
                          {checkInLabel}
                        </p>
                      )}
                    </td>

                    {/* CHECK OUT */}

                    <td className="px-6 py-5">
                      {item.checkOutAt ? (
                        <div>
                          <div
                            className={[
                              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black",

                              earlyCheckout
                                ? "bg-[#fff7e5] text-[#b77900]"
                                : "bg-[#eaf4ff] text-[#007BFF]",
                            ].join(" ")}
                          >
                            <LogOut size={14} />

                            {formatTime(item.checkOutAt)}
                          </div>

                          {earlyCheckout && (
                            <p className="mt-1.5 text-[10px] font-bold text-[#d68a00]">
                              Pulang lebih awal
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-xl bg-[#fff7e5] px-3 py-2 text-xs font-bold text-[#b77900]">
                          Belum pulang
                        </span>
                      )}
                    </td>

                    {/* DURATION */}

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-sm font-black text-[#334155]">
                        <Timer size={15} className="text-[#007BFF]" />

                        {formatWorkDuration(item)}
                      </div>
                    </td>

                    {/* STATUS */}

                    <td className="px-6 py-5">
                      <div className="flex max-w-[230px] flex-wrap gap-1.5">
                        {checkInStatus === "early" && (
                          <span className="inline-flex rounded-full bg-[#eaf4ff] px-3 py-1.5 text-[10px] font-black text-[#007BFF]">
                            DATANG LEBIH AWAL
                          </span>
                        )}

                        {checkInStatus === "on_time" && (
                          <span className="inline-flex rounded-full bg-[#e9f9f1] px-3 py-1.5 text-[10px] font-black text-[#07875f]">
                            TEPAT WAKTU
                          </span>
                        )}

                        {late && (
                          <span className="inline-flex rounded-full bg-[#fff7e5] px-3 py-1.5 text-[10px] font-black text-[#b77900]">
                            TERLAMBAT
                          </span>
                        )}

                        {earlyCheckout && (
                          <span className="inline-flex rounded-full bg-[#fff0e5] px-3 py-1.5 text-[10px] font-black text-[#c66a00]">
                            PULANG AWAL
                          </span>
                        )}

                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1.5 text-[10px] font-black",

                            item.status === "completed"
                              ? "bg-[#e9f9f1] text-[#07875f]"
                              : "bg-[#eaf4ff] text-[#007BFF]",
                          ].join(" ")}
                        >
                          {item.status === "completed"
                            ? "SELESAI"
                            : "CHECKED IN"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* =================================================== */}
        {/* MOBILE */}
        {/* =================================================== */}

        <div className="divide-y divide-[#edf2f7] lg:hidden">
          {filtered.map((item) => {
            const checkInStatus = getCheckInStatus(item);

            const late = checkInStatus === "late";

            const lateMinutes = getLateMinutes(item);

            const earlyCheckout = item.checkOutStatus === "early";

            return (
              <article key={item.id} className="p-5">
                {/* EMPLOYEE */}

                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
                    <UserRound size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#172033]">
                      {item.employeeName}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-[#8291a4]">
                      {item.employeeCode} · {item.department}
                    </p>

                    <p className="mt-1 text-[11px] font-semibold text-[#94a3b8]">
                      {formatDateKey(item.dateKey)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {checkInStatus === "early" && (
                      <span className="rounded-full bg-[#eaf4ff] px-2.5 py-1 text-[9px] font-black text-[#007BFF]">
                        LEBIH AWAL
                      </span>
                    )}

                    {checkInStatus === "on_time" && (
                      <span className="rounded-full bg-[#e9f9f1] px-2.5 py-1 text-[9px] font-black text-[#07875f]">
                        TEPAT WAKTU
                      </span>
                    )}

                    {late && (
                      <span className="rounded-full bg-[#fff7e5] px-2.5 py-1 text-[9px] font-black text-[#b77900]">
                        TERLAMBAT
                      </span>
                    )}

                    {earlyCheckout && (
                      <span className="rounded-full bg-[#fff0e5] px-2.5 py-1 text-[9px] font-black text-[#c66a00]">
                        PULANG AWAL
                      </span>
                    )}

                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[9px] font-black",

                        item.status === "completed"
                          ? "bg-[#e9f9f1] text-[#07875f]"
                          : "bg-[#eaf4ff] text-[#007BFF]",
                      ].join(" ")}
                    >
                      {item.status === "completed" ? "SELESAI" : "CHECKED IN"}
                    </span>
                  </div>
                </div>

                {/* TIME */}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {/* CHECK IN */}

                  <div
                    className={[
                      "rounded-2xl p-4",

                      checkInStatus === "late"
                        ? "bg-[#fff7e5]"
                        : checkInStatus === "early"
                          ? "bg-[#eaf4ff]"
                          : "bg-[#e9f9f1]",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex items-center gap-2 text-[10px] font-black uppercase tracking-wider",

                        checkInStatus === "late"
                          ? "text-[#b77900]"
                          : checkInStatus === "early"
                            ? "text-[#007BFF]"
                            : "text-[#07875f]",
                      ].join(" ")}
                    >
                      <LogIn size={13} />
                      Masuk
                    </div>

                    <p
                      className={[
                        "mt-2 text-sm font-black",

                        checkInStatus === "late"
                          ? "text-[#9a6700]"
                          : checkInStatus === "early"
                            ? "text-[#005fc4]"
                            : "text-[#067052]",
                      ].join(" ")}
                    >
                      {formatTime(item.checkInAt)}
                    </p>

                    {late && (
                      <p className="mt-1 text-[10px] font-bold text-[#d68a00]">
                        Terlambat {formatDuration(lateMinutes)}
                      </p>
                    )}

                    {checkInStatus === "early" && (
                      <p className="mt-1 text-[10px] font-bold text-[#007BFF]">
                        Datang lebih awal
                      </p>
                    )}

                    {checkInStatus === "on_time" && (
                      <p className="mt-1 text-[10px] font-bold text-[#07875f]">
                        Tepat waktu
                      </p>
                    )}
                  </div>

                  {/* CHECK OUT */}

                  <div
                    className={[
                      "rounded-2xl p-4",

                      earlyCheckout ? "bg-[#fff7e5]" : "bg-[#eaf4ff]",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex items-center gap-2 text-[10px] font-black uppercase tracking-wider",

                        earlyCheckout ? "text-[#b77900]" : "text-[#007BFF]",
                      ].join(" ")}
                    >
                      <LogOut size={13} />
                      Pulang
                    </div>

                    <p
                      className={[
                        "mt-2 text-sm font-black",

                        earlyCheckout ? "text-[#9a6700]" : "text-[#005fc4]",
                      ].join(" ")}
                    >
                      {item.checkOutAt ? formatTime(item.checkOutAt) : "-"}
                    </p>

                    {earlyCheckout && (
                      <p className="mt-1 text-[10px] font-bold text-[#d68a00]">
                        Pulang lebih awal
                      </p>
                    )}
                  </div>
                </div>

                {/* DURATION */}

                <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#f7fafd] px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8291a4]">
                    <Timer size={14} className="text-[#007BFF]" />
                    Durasi kerja
                  </div>

                  <p className="text-xs font-black text-[#334155]">
                    {formatWorkDuration(item)}
                  </p>
                </div>

                <p className="mt-3 text-xs font-semibold text-[#94a3b8]">
                  Terakhir diperbarui {formatDateTime(item.updatedAt)}
                </p>
              </article>
            );
          })}
        </div>

        {/* =================================================== */}
        {/* EMPTY */}
        {/* =================================================== */}

        {!loading && filtered.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-[22px] bg-[#eaf4ff] text-[#007BFF]">
              <CalendarDays size={28} />
            </div>

            <p className="mt-4 font-black text-[#172033]">
              {hasFilter ? "Data tidak ditemukan" : "Belum ada absensi"}
            </p>

            <p className="mt-1 max-w-sm text-sm leading-6 text-[#8291a4]">
              {hasFilter
                ? "Coba ubah pencarian atau filter yang digunakan."
                : "Scan kartu RFID terdaftar untuk membuat absensi."}
            </p>

            {hasFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#007BFF] px-4 text-xs font-black text-white transition hover:bg-[#006ee6]"
              >
                <RotateCcw size={14} />
                Reset Filter
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
