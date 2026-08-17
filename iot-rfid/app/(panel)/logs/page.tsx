"use client";

import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  RotateCcw,
  Search,
  ScanLine,
  Timer,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ScanLog } from "@/types/rfid";

// ============================================================
// TYPES
// ============================================================

type ResultFilter = "all" | "success" | "warning" | "error";

type ActivityFilter =
  | "all"
  | "registration"
  | "check_in"
  | "check_out"
  | "other";

// ============================================================
// CONFIG
// ============================================================

const PAGE_SIZE = 12;

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
    timeStyle: "medium",
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

function getJakartaDateKey(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;

  const month = parts.find((part) => part.type === "month")?.value;

  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

// ============================================================
// DURATION
// ============================================================

function formatDuration(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
    return "-";
  }

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
// ACTIVITY TYPE
// ============================================================

function getActivityType(log: ScanLog): Exclude<ActivityFilter, "all"> {
  const code = log.code.toUpperCase();

  const action = log.action.toUpperCase();

  if (
    code.includes("REGISTER") ||
    action.includes("REGISTER") ||
    log.readerType === "registration"
  ) {
    return "registration";
  }

  if (code.includes("CHECK_IN") || action.includes("CHECK_IN")) {
    return "check_in";
  }

  if (code.includes("CHECK_OUT") || action.includes("CHECK_OUT")) {
    return "check_out";
  }

  return "other";
}

// ============================================================
// ACTIVITY LABEL
// ============================================================

function getActivityTitle(log: ScanLog) {
  switch (log.code) {
    case "ATTENDANCE_CHECK_IN":
      return "Check-in berhasil";

    case "ATTENDANCE_CHECK_OUT":
      return "Check-out berhasil";

    case "CHECK_IN_TOO_EARLY":
      return "Check-in terlalu awal";

    case "CHECK_IN_TIME_CLOSED":
      return "Waktu check-in berakhir";

    case "CHECK_OUT_TOO_EARLY":
      return "Check-out belum tersedia";

    case "ATTENDANCE_ALREADY_COMPLETE":
      return "Absensi sudah selesai";

    case "CARD_NOT_REGISTERED":
      return "Kartu belum terdaftar";

    case "CARD_ALREADY_REGISTERED":
      return "Kartu sudah terdaftar";

    case "EMPLOYEE_INACTIVE":
      return "Karyawan tidak aktif";

    case "CARD_REGISTERED":
      return "Registrasi RFID berhasil";

    case "REGISTRATION_COMPLETED":
      return "Registrasi RFID berhasil";

    case "REGISTRATION_CANCELLED":
      return "Registrasi dibatalkan";

    case "REGISTRATION_FAILED":
      return "Registrasi gagal";

    default:
      if (getActivityType(log) === "registration") {
        return "Aktivitas registrasi RFID";
      }

      if (getActivityType(log) === "check_in") {
        return "Aktivitas check-in";
      }

      if (getActivityType(log) === "check_out") {
        return "Aktivitas check-out";
      }

      return "Aktivitas RFID";
  }
}

// ============================================================

function getActivityTypeLabel(log: ScanLog) {
  const type = getActivityType(log);

  if (type === "registration") {
    return "REGISTRASI";
  }

  if (type === "check_in") {
    return "CHECK-IN";
  }

  if (type === "check_out") {
    return "CHECK-OUT";
  }

  return "LAINNYA";
}

// ============================================================
// RESULT STYLE
// ============================================================

function getResultLabel(result: ScanLog["result"]) {
  if (result === "success") {
    return "SUCCESS";
  }

  if (result === "warning") {
    return "WARNING";
  }

  return "ERROR";
}

// ============================================================
// PAGE
// ============================================================

export default function LogsPage() {
  const [logs, setLogs] = useState<ScanLog[]>([]);

  const [search, setSearch] = useState("");

  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const [dateFilter, setDateFilter] = useState("");

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [selectedLog, setSelectedLog] = useState<ScanLog | null>(null);

  // ==========================================================
  // LOAD LOGS
  // ==========================================================

  const loadLogs = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/logs", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil riwayat scan.");
      }

      setLogs(Array.isArray(data.logs) ? data.logs : []);

      setLoadError("");
    } catch (error) {
      console.error("[LOGS]", error);

      setLoadError(
        error instanceof Error
          ? error.message
          : "Gagal mengambil riwayat scan.",
      );
    } finally {
      setLoading(false);

      setRefreshing(false);
    }
  }, []);

  // ==========================================================
  // POLLING
  // ==========================================================

  useEffect(() => {
    void loadLogs();

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadLogs();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadLogs]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const successCount = useMemo(
    () => logs.filter((log) => log.result === "success").length,
    [logs],
  );

  const warningCount = useMemo(
    () => logs.filter((log) => log.result === "warning").length,
    [logs],
  );

  const errorCount = useMemo(
    () => logs.filter((log) => log.result === "error").length,
    [logs],
  );

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return logs
      .filter((log) => {
        // RESULT

        const matchesResult =
          resultFilter === "all" || log.result === resultFilter;

        // ACTIVITY

        const matchesActivity =
          activityFilter === "all" || getActivityType(log) === activityFilter;

        // DATE

        const matchesDate =
          !dateFilter || getJakartaDateKey(log.createdAt) === dateFilter;

        // SEARCH

        const matchesSearch =
          !keyword ||
          [
            log.uid,
            log.employeeName ?? "",
            log.employeeId ?? "",
            log.code,
            log.message,
            log.action,
            log.readerType ?? "",
            getActivityTitle(log),
          ].some((value) => value.toLowerCase().includes(keyword));

        return matchesResult && matchesActivity && matchesDate && matchesSearch;
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;

        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

        return timeB - timeA;
      });
  }, [logs, search, resultFilter, activityFilter, dateFilter]);

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, resultFilter, activityFilter, dateFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const paginationStart =
    filteredLogs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;

  const paginationEnd = Math.min(currentPage * PAGE_SIZE, filteredLogs.length);

  // ==========================================================
  // FILTER STATE
  // ==========================================================

  const hasFilter =
    search.trim() !== "" ||
    resultFilter !== "all" ||
    activityFilter !== "all" ||
    dateFilter !== "";

  function resetFilters() {
    setSearch("");

    setResultFilter("all");

    setActivityFilter("all");

    setDateFilter("");

    setCurrentPage(1);
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <>
      <div className="mx-auto max-w-[1500px]">
        {/* =================================================== */}
        {/* INTRO */}
        {/* =================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
              Pantau seluruh aktivitas RFID untuk monitoring, audit, dan
              troubleshooting sistem.
            </p>
          </div>
        </div>

        {/* =================================================== */}
        {/* ERROR */}
        {/* =================================================== */}

        {loadError && (
          <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-[#ffd5d5] bg-[#fff0f0] p-4">
            <CircleAlert size={18} className="mt-0.5 shrink-0 text-[#ef4444]" />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[#b42318]">
                Gagal memuat aktivitas
              </p>

              <p className="mt-1 text-xs font-semibold leading-5 text-[#d92d20]">
                {loadError}
              </p>
            </div>
          </div>
        )}

        {/* =================================================== */}
        {/* SUMMARY */}
        {/* =================================================== */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* TOTAL */}

          <article className="rounded-[26px] border border-[#153d62] bg-[#0d2f53] p-6 shadow-[0_12px_40px_rgba(13,47,83,0.08)]">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
              <Activity size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-white">
              {loading ? "..." : logs.length}
            </p>

            <p className="mt-1 text-xs font-bold text-[#b7cada]">
              Total aktivitas
            </p>
          </article>

          {/* SUCCESS */}

          <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e9f9f1] text-[#10b981]">
              <Check size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
              {loading ? "..." : successCount}
            </p>

            <p className="mt-1 text-xs font-bold text-[#8291a4]">Berhasil</p>
          </article>

          {/* WARNING */}

          <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff7e5] text-[#f59e0b]">
              <TriangleAlert size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
              {loading ? "..." : warningCount}
            </p>

            <p className="mt-1 text-xs font-bold text-[#8291a4]">Peringatan</p>
          </article>

          {/* ERROR */}

          <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff0f0] text-[#ef4444]">
              <CircleAlert size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
              {loading ? "..." : errorCount}
            </p>

            <p className="mt-1 text-xs font-bold text-[#8291a4]">Error</p>
          </article>
        </div>

        {/* =================================================== */}
        {/* LOG SECTION */}
        {/* =================================================== */}

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#dce6f1] bg-white shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
          {/* ================================================= */}
          {/* HEADER */}
          {/* ================================================= */}

          <div className="border-b border-[#edf2f7] p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
                  Activity Log
                </p>

                <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#101828]">
                  Riwayat Scan
                </h2>

                <p className="mt-1 text-xs text-[#8291a4]">
                  {filteredLogs.length} aktivitas ditemukan
                </p>
              </div>

              {/* ============================================= */}
              {/* FILTER */}
              {/* ============================================= */}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_170px_190px_180px_auto]">
                {/* SEARCH */}

                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#007BFF]"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari UID, nama, kode..."
                    className="h-11 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] pl-11 pr-4 text-sm font-semibold text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                  />
                </div>

                {/* RESULT */}

                <select
                  value={resultFilter}
                  onChange={(event) =>
                    setResultFilter(event.target.value as ResultFilter)
                  }
                  className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                >
                  <option value="all">Semua Hasil</option>

                  <option value="success">Success</option>

                  <option value="warning">Warning</option>

                  <option value="error">Error</option>
                </select>

                {/* ACTIVITY */}

                <select
                  value={activityFilter}
                  onChange={(event) =>
                    setActivityFilter(event.target.value as ActivityFilter)
                  }
                  className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                >
                  <option value="all">Semua Aktivitas</option>

                  <option value="registration">Registrasi RFID</option>

                  <option value="check_in">Check-in</option>

                  <option value="check_out">Check-out</option>

                  <option value="other">Lainnya</option>
                </select>

                {/* DATE */}

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                />

                {/* RESET */}

                {hasFilter && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#dce6f1] bg-white px-4 text-sm font-bold text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* LOG LIST */}
          {/* ================================================= */}

          <div className="divide-y divide-[#edf2f7]">
            {paginatedLogs.map((log) => {
              const Icon =
                log.result === "success"
                  ? Check
                  : log.result === "warning"
                    ? TriangleAlert
                    : CircleAlert;

              return (
                <article
                  key={log.id}
                  className="grid gap-4 p-5 transition hover:bg-[#f7fafd] lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:p-6"
                >
                  {/* ========================================= */}
                  {/* ICON */}
                  {/* ========================================= */}

                  <div
                    className={[
                      "flex size-11 items-center justify-center rounded-2xl",

                      log.result === "success"
                        ? "bg-[#e9f9f1] text-[#10b981]"
                        : log.result === "warning"
                          ? "bg-[#fff7e5] text-[#f59e0b]"
                          : "bg-[#fff0f0] text-[#ef4444]",
                    ].join(" ")}
                  >
                    <Icon size={18} />
                  </div>

                  {/* ========================================= */}
                  {/* CONTENT */}
                  {/* ========================================= */}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-[#172033]">
                        {getActivityTitle(log)}
                      </p>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-[9px] font-black",

                          log.result === "success"
                            ? "bg-[#e9f9f1] text-[#07875f]"
                            : log.result === "warning"
                              ? "bg-[#fff7e5] text-[#b77900]"
                              : "bg-[#fff0f0] text-[#d92d20]",
                        ].join(" ")}
                      >
                        {getResultLabel(log.result)}
                      </span>

                      <span className="rounded-full bg-[#eaf4ff] px-2.5 py-1 text-[9px] font-black text-[#007BFF]">
                        {getActivityTypeLabel(log)}
                      </span>
                    </div>

                    {/* EMPLOYEE */}

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <UserRound
                          size={13}
                          className="shrink-0 text-[#8291a4]"
                        />

                        <span className="truncate text-xs font-bold text-[#52657a]">
                          {log.employeeName ?? "Tanpa karyawan"}
                        </span>
                      </div>

                      <span className="font-mono text-[11px] font-bold text-[#8291a4]">
                        UID: {log.uid || "-"}
                      </span>
                    </div>

                    {/* MESSAGE */}

                    <p className="mt-2 text-xs font-medium leading-5 text-[#8291a4]">
                      {log.message}
                    </p>

                    {/* ======================================= */}
                    {/* METADATA */}
                    {/* ======================================= */}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {log.checkInStatus === "late" &&
                        typeof log.lateMinutes === "number" && (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#fff7e5] px-2.5 py-1.5 text-[10px] font-black text-[#b77900]">
                            <Clock3 size={12} />
                            Terlambat {formatDuration(log.lateMinutes)}
                          </span>
                        )}

                      {typeof log.remainingMinutes === "number" &&
                        log.remainingMinutes > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#fff7e5] px-2.5 py-1.5 text-[10px] font-black text-[#b77900]">
                            <Timer size={12} />
                            Tunggu {formatDuration(log.remainingMinutes)}
                          </span>
                        )}

                      {typeof log.workDurationMinutes === "number" && (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#eaf4ff] px-2.5 py-1.5 text-[10px] font-black text-[#007BFF]">
                          <Timer size={12} />
                          Durasi {formatDuration(log.workDurationMinutes)}
                        </span>
                      )}

                      {log.checkOutStatus === "early" && (
                        <span className="rounded-xl bg-[#fff7e5] px-2.5 py-1.5 text-[10px] font-black text-[#b77900]">
                          PULANG AWAL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ========================================= */}
                  {/* RIGHT */}
                  {/* ========================================= */}

                  <div className="flex items-center justify-between gap-4 lg:justify-end">
                    <div className="lg:text-right">
                      <p className="text-xs font-black text-[#52657a]">
                        {formatTime(log.createdAt)}
                      </p>

                      <p className="mt-1 max-w-40 truncate text-[10px] font-semibold text-[#94a3b8]">
                        {log.code}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      title="Lihat detail"
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ================================================= */}
          {/* EMPTY */}
          {/* ================================================= */}

          {!loading && filteredLogs.length === 0 && (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-[22px] bg-[#eaf4ff] text-[#007BFF]">
                <ScanLine size={27} />
              </div>

              <p className="mt-4 font-black text-[#172033]">
                {hasFilter
                  ? "Aktivitas tidak ditemukan"
                  : "Belum ada aktivitas"}
              </p>

              <p className="mt-1 max-w-sm text-sm leading-6 text-[#8291a4]">
                {hasFilter
                  ? "Coba ubah pencarian atau filter yang digunakan."
                  : "Aktivitas scan kartu RFID akan muncul di halaman ini."}
              </p>

              {hasFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 flex h-10 items-center gap-2 rounded-xl bg-[#007BFF] px-4 text-xs font-black text-white transition hover:bg-[#006ee6]"
                >
                  <RotateCcw size={14} />
                  Reset Filter
                </button>
              )}
            </div>
          )}

          {/* ================================================= */}
          {/* PAGINATION */}
          {/* ================================================= */}

          {filteredLogs.length > 0 && (
            <div className="flex flex-col gap-4 border-t border-[#edf2f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs font-semibold text-[#8291a4]">
                Menampilkan{" "}
                <span className="font-black text-[#334155]">
                  {paginationStart}
                </span>{" "}
                -{" "}
                <span className="font-black text-[#334155]">
                  {paginationEnd}
                </span>{" "}
                dari{" "}
                <span className="font-black text-[#334155]">
                  {filteredLogs.length}
                </span>{" "}
                aktivitas
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setCurrentPage((current) => Math.max(1, current - 1))
                  }
                  className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] transition hover:border-[#007BFF] hover:text-[#007BFF] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex h-9 min-w-20 items-center justify-center rounded-xl bg-[#f7fafd] px-3 text-xs font-black text-[#334155]">
                  {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((current) =>
                      Math.min(totalPages, current + 1),
                    )
                  }
                  className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] transition hover:border-[#007BFF] hover:text-[#007BFF] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ===================================================== */}
      {/* DETAIL MODAL */}
      {/* ===================================================== */}

      {selectedLog && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#0d2f53]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] sm:p-7">
            {/* ================================================= */}
            {/* MODAL HEADER */}
            {/* ================================================= */}

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
                  Scan Detail
                </p>

                <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#172033]">
                  {getActivityTitle(selectedLog)}
                </h2>

                <p className="mt-1 text-xs text-[#8291a4]">
                  {formatDateTime(selectedLog.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b] transition hover:bg-[#eaf4ff] hover:text-[#007BFF]"
              >
                <X size={18} />
              </button>
            </div>

            {/* ================================================= */}
            {/* RESULT */}
            {/* ================================================= */}

            <div
              className={[
                "mt-6 flex items-start gap-4 rounded-[22px] border p-5",

                selectedLog.result === "success"
                  ? "border-[#cfeedd] bg-[#f4fcf8]"
                  : selectedLog.result === "warning"
                    ? "border-[#f8e4b4] bg-[#fffaf0]"
                    : "border-[#ffd5d5] bg-[#fff7f7]",
              ].join(" ")}
            >
              <div
                className={[
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl",

                  selectedLog.result === "success"
                    ? "bg-[#e9f9f1] text-[#10b981]"
                    : selectedLog.result === "warning"
                      ? "bg-[#fff7e5] text-[#f59e0b]"
                      : "bg-[#fff0f0] text-[#ef4444]",
                ].join(" ")}
              >
                {selectedLog.result === "success" ? (
                  <Check size={18} />
                ) : selectedLog.result === "warning" ? (
                  <TriangleAlert size={18} />
                ) : (
                  <CircleAlert size={18} />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-[9px] font-black",

                      selectedLog.result === "success"
                        ? "bg-[#e9f9f1] text-[#07875f]"
                        : selectedLog.result === "warning"
                          ? "bg-[#fff7e5] text-[#b77900]"
                          : "bg-[#fff0f0] text-[#d92d20]",
                    ].join(" ")}
                  >
                    {getResultLabel(selectedLog.result)}
                  </span>

                  <span className="rounded-full bg-[#eaf4ff] px-2.5 py-1 text-[9px] font-black text-[#007BFF]">
                    {getActivityTypeLabel(selectedLog)}
                  </span>
                </div>

                <p className="mt-3 text-sm font-semibold leading-6 text-[#52657a]">
                  {selectedLog.message}
                </p>
              </div>
            </div>

            {/* ================================================= */}
            {/* DETAIL */}
            {/* ================================================= */}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DetailItem
                label="Nama Karyawan"
                value={selectedLog.employeeName ?? "Tanpa karyawan"}
              />

              <DetailItem
                label="Employee ID"
                value={selectedLog.employeeId ?? "-"}
                mono
              />

              <DetailItem
                label="RFID UID"
                value={selectedLog.uid || "-"}
                mono
              />

              <DetailItem
                label="Reader"
                value={
                  selectedLog.readerType === "registration"
                    ? "Registration Reader"
                    : (selectedLog.readerType ?? "RFID Reader")
                }
              />

              <DetailItem label="Action" value={selectedLog.action || "-"} />

              <DetailItem label="Code" value={selectedLog.code || "-"} mono />
            </div>

            {/* ================================================= */}
            {/* ATTENDANCE METADATA */}
            {/* ================================================= */}

            {(selectedLog.checkInStatus ||
              selectedLog.checkOutStatus ||
              typeof selectedLog.lateMinutes === "number" ||
              typeof selectedLog.workDurationMinutes === "number" ||
              typeof selectedLog.remainingMinutes === "number") && (
              <div className="mt-5 rounded-[22px] border border-[#dce6f1] bg-[#f7fafd] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8291a4]">
                  Attendance Detail
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedLog.checkInStatus && (
                    <DetailItem
                      label="Status Check-in"
                      value={
                        selectedLog.checkInStatus === "early"
                          ? "Datang lebih awal"
                          : selectedLog.checkInStatus === "on_time"
                            ? "Tepat waktu"
                            : "Terlambat"
                      }
                    />
                  )}

                  {typeof selectedLog.lateMinutes === "number" && (
                    <DetailItem
                      label="Keterlambatan"
                      value={formatDuration(selectedLog.lateMinutes)}
                    />
                  )}

                  {selectedLog.checkOutStatus && (
                    <DetailItem
                      label="Status Check-out"
                      value={
                        selectedLog.checkOutStatus === "early"
                          ? "Pulang lebih awal"
                          : "Normal"
                      }
                    />
                  )}

                  {typeof selectedLog.workDurationMinutes === "number" && (
                    <DetailItem
                      label="Durasi Kerja"
                      value={formatDuration(selectedLog.workDurationMinutes)}
                    />
                  )}

                  {typeof selectedLog.remainingMinutes === "number" &&
                    selectedLog.remainingMinutes > 0 && (
                      <DetailItem
                        label="Waktu Tersisa"
                        value={formatDuration(selectedLog.remainingMinutes)}
                      />
                    )}
                </div>
              </div>
            )}

            {/* ================================================= */}
            {/* ID */}
            {/* ================================================= */}

            <div className="mt-5 rounded-2xl border border-[#edf2f7] bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">
                Log ID
              </p>

              <p className="mt-2 break-all font-mono text-xs font-bold text-[#64748b]">
                {selectedLog.id}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="mt-6 h-12 w-full rounded-2xl bg-[#007BFF] text-sm font-black text-white transition hover:bg-[#006ee6]"
            >
              Tutup Detail
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// DETAIL ITEM
// ============================================================

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#edf2f7] bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.11em] text-[#94a3b8]">
        {label}
      </p>

      <p
        className={[
          "mt-2 break-words text-xs font-black text-[#334155]",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
