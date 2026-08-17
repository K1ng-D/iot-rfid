"use client";

import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  UserRound,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AttendanceRecord } from "@/types/rfid";

// ============================================================
// TYPES
// ============================================================

type AttendanceFilter =
  | "all"
  | "early"
  | "on_time"
  | "late"
  | "checked_in"
  | "completed"
  | "early_checkout";

interface AttendanceResponse {
  success?: boolean;

  attendance?: AttendanceRecord[];

  records?: AttendanceRecord[];

  message?: string;
}

// ============================================================
// CONFIG
// ============================================================

const PAGE_SIZE = 12;

// ============================================================
// DATE HELPERS
// ============================================================

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  const [year, month, day] = parts;

  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
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
    timeZone: "Asia/Jakarta",
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

  const year = parts.find((part) => part.type === "year")?.value ?? "";

  const month = parts.find((part) => part.type === "month")?.value ?? "";

  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

// ============================================================
// DURATION
// ============================================================

function formatDuration(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  const safeValue = Math.max(0, Math.floor(value));

  const hours = Math.floor(safeValue / 60);

  const minutes = safeValue % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}j`;
  }

  return `${hours}j ${minutes}m`;
}

// ============================================================
// CHECK IN LABEL
// ============================================================

function getCheckInLabel(value: AttendanceRecord["checkInStatus"]) {
  if (value === "early") {
    return "Datang lebih awal";
  }

  if (value === "on_time") {
    return "Tepat waktu";
  }

  if (value === "late") {
    return "Terlambat";
  }

  return "-";
}

// ============================================================
// CHECK OUT LABEL
// ============================================================

function getCheckOutLabel(attendance: AttendanceRecord) {
  if (!attendance.checkOutAt) {
    return "Belum checkout";
  }

  if (attendance.checkOutStatus === "early") {
    return "Pulang lebih awal";
  }

  return "Normal";
}

// ============================================================
// PAGE
// ============================================================

export default function ReportsPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<AttendanceFilter>("all");

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [exporting, setExporting] = useState(false);

  const [loadError, setLoadError] = useState("");

  const requestRunningRef = useRef(false);

  // ==========================================================
  // LOAD
  // ==========================================================

  const loadAttendance = useCallback(async (manualRefresh = false) => {
    if (requestRunningRef.current) {
      return;
    }

    requestRunningRef.current = true;

    if (manualRefresh) {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/attendance", {
        cache: "no-store",

        headers: {
          Accept: "application/json",
        },
      });

      const data = (await response.json()) as AttendanceResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil laporan absensi.");
      }

      const result = Array.isArray(data.attendance)
        ? data.attendance
        : Array.isArray(data.records)
          ? data.records
          : [];

      setRecords(result);

      setLoadError("");
    } catch (error) {
      console.error("[REPORTS]", error);

      setLoadError(
        error instanceof Error
          ? error.message
          : "Gagal mengambil laporan absensi.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);

      requestRunningRef.current = false;
    }
  }, []);

  // ==========================================================
  // INITIAL
  // ==========================================================

  useEffect(() => {
    void loadAttendance();

    return () => {
      requestRunningRef.current = false;
    };
  }, [loadAttendance]);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return records
      .filter((attendance) => {
        // ================================================
        // SEARCH
        // ================================================

        const matchesSearch =
          !keyword ||
          [
            attendance.employeeName,
            attendance.employeeCode,
            attendance.department,
            attendance.position,
            attendance.rfidUid,
          ].some((value) => value.toLowerCase().includes(keyword));

        // ================================================
        // DATE
        // ================================================

        const matchesStartDate = !startDate || attendance.dateKey >= startDate;

        const matchesEndDate = !endDate || attendance.dateKey <= endDate;

        // ================================================
        // STATUS
        // ================================================

        let matchesStatus = true;

        if (statusFilter === "early") {
          matchesStatus = attendance.checkInStatus === "early";
        }

        if (statusFilter === "on_time") {
          matchesStatus = attendance.checkInStatus === "on_time";
        }

        if (statusFilter === "late") {
          matchesStatus = attendance.checkInStatus === "late";
        }

        if (statusFilter === "checked_in") {
          matchesStatus = attendance.status === "checked_in";
        }

        if (statusFilter === "completed") {
          matchesStatus = attendance.status === "completed";
        }

        if (statusFilter === "early_checkout") {
          matchesStatus = attendance.checkOutStatus === "early";
        }

        return (
          matchesSearch && matchesStartDate && matchesEndDate && matchesStatus
        );
      })
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) {
          return b.dateKey.localeCompare(a.dateKey);
        }

        const timeA = a.checkInAt ? new Date(a.checkInAt).getTime() : 0;

        const timeB = b.checkInAt ? new Date(b.checkInAt).getTime() : 0;

        return timeB - timeA;
      });
  }, [records, search, statusFilter, startDate, endDate]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const uniqueEmployees = useMemo(() => {
    return new Set(filteredRecords.map((attendance) => attendance.employeeId))
      .size;
  }, [filteredRecords]);

  const lateCount = useMemo(() => {
    return filteredRecords.filter(
      (attendance) => attendance.checkInStatus === "late",
    ).length;
  }, [filteredRecords]);

  const completedCount = useMemo(() => {
    return filteredRecords.filter(
      (attendance) => attendance.status === "completed",
    ).length;
  }, [filteredRecords]);

  const earlyCheckoutCount = useMemo(() => {
    return filteredRecords.filter(
      (attendance) => attendance.checkOutStatus === "early",
    ).length;
  }, [filteredRecords]);

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, startDate, endDate]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  const paginationStart =
    filteredRecords.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;

  const paginationEnd = Math.min(
    currentPage * PAGE_SIZE,
    filteredRecords.length,
  );

  // ==========================================================
  // FILTER STATE
  // ==========================================================

  const hasFilter =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    startDate !== "" ||
    endDate !== "";

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  }

  // ==========================================================
  // TODAY
  // ==========================================================

  function filterToday() {
    const today = getTodayKey();

    setStartDate(today);
    setEndDate(today);
    setCurrentPage(1);
  }

  // ==========================================================
  // EXPORT EXCEL
  // ==========================================================

  async function exportExcel() {
    if (filteredRecords.length === 0 || exporting) {
      return;
    }

    setExporting(true);

    try {
      /*
       * Dynamic import supaya ExcelJS hanya dimuat
       * ketika admin benar-benar melakukan export.
       */
      const ExcelJS = await import("exceljs");

      const workbook = new ExcelJS.Workbook();

      workbook.creator = "Nexty Labs";

      workbook.company = "Nexty Labs";

      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Laporan Absensi", {
        views: [
          {
            state: "frozen",
            ySplit: 5,
          },
        ],
      });

      // ======================================================
      // PAGE SETUP
      // ======================================================

      worksheet.pageSetup = {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      };

      // ======================================================
      // COLUMN WIDTH
      // ======================================================

      worksheet.columns = [
        {
          key: "date",
          width: 15,
        },
        {
          key: "employeeCode",
          width: 18,
        },
        {
          key: "employeeName",
          width: 27,
        },
        {
          key: "department",
          width: 20,
        },
        {
          key: "position",
          width: 22,
        },
        {
          key: "rfidUid",
          width: 18,
        },
        {
          key: "checkIn",
          width: 14,
        },
        {
          key: "checkInStatus",
          width: 22,
        },
        {
          key: "late",
          width: 16,
        },
        {
          key: "checkOut",
          width: 14,
        },
        {
          key: "checkOutStatus",
          width: 22,
        },
        {
          key: "duration",
          width: 17,
        },
        {
          key: "attendanceStatus",
          width: 20,
        },
      ];

      // ======================================================
      // TITLE
      // ======================================================

      worksheet.mergeCells("A1:M1");

      const titleCell = worksheet.getCell("A1");

      titleCell.value = "LAPORAN ABSENSI KARYAWAN";

      titleCell.font = {
        bold: true,
        size: 18,
        color: {
          argb: "FFFFFFFF",
        },
      };

      titleCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF0D2F53",
        },
      };

      worksheet.getRow(1).height = 32;

      // ======================================================
      // PERIOD
      // ======================================================

      worksheet.mergeCells("A2:M2");

      const periodCell = worksheet.getCell("A2");

      const periodStart = startDate ? formatDate(startDate) : "Semua tanggal";

      const periodEnd = endDate ? formatDate(endDate) : "Semua tanggal";

      periodCell.value =
        startDate && endDate
          ? `Periode: ${periodStart} - ${periodEnd}`
          : startDate
            ? `Mulai: ${periodStart}`
            : endDate
              ? `Sampai: ${periodEnd}`
              : "Periode: Semua Data";

      periodCell.font = {
        bold: true,
        size: 11,
        color: {
          argb: "FF52657A",
        },
      };

      periodCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.getRow(2).height = 22;

      // ======================================================
      // SUMMARY
      // ======================================================

      worksheet.mergeCells("A3:M3");

      const summaryCell = worksheet.getCell("A3");

      summaryCell.value =
        `Karyawan: ${uniqueEmployees} | ` +
        `Total Data: ${filteredRecords.length} | ` +
        `Absensi Selesai: ${completedCount} | ` +
        `Terlambat: ${lateCount} | ` +
        `Pulang Lebih Awal: ${earlyCheckoutCount}`;

      summaryCell.font = {
        size: 10,
        color: {
          argb: "FF64748B",
        },
      };

      summaryCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      // ======================================================
      // EMPTY ROW
      // ======================================================

      worksheet.getRow(4).height = 8;

      // ======================================================
      // HEADER
      // ======================================================

      const headerRow = worksheet.getRow(5);

      const headers = [
        "Tanggal",
        "Kode Karyawan",
        "Nama",
        "Department",
        "Jabatan",
        "RFID UID",
        "Jam Masuk",
        "Status Masuk",
        "Terlambat",
        "Jam Pulang",
        "Status Pulang",
        "Durasi Kerja",
        "Status Absensi",
      ];

      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);

        cell.value = header;

        cell.font = {
          bold: true,
          color: {
            argb: "FFFFFFFF",
          },
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FF007BFF",
          },
        };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };

        cell.border = {
          top: {
            style: "thin",
            color: {
              argb: "FFDCE6F1",
            },
          },
          left: {
            style: "thin",
            color: {
              argb: "FFDCE6F1",
            },
          },
          bottom: {
            style: "thin",
            color: {
              argb: "FFDCE6F1",
            },
          },
          right: {
            style: "thin",
            color: {
              argb: "FFDCE6F1",
            },
          },
        };
      });

      headerRow.height = 30;

      // ======================================================
      // DATA
      // ======================================================

      filteredRecords.forEach((attendance, index) => {
        const row = worksheet.addRow({
          date: formatDate(attendance.dateKey),

          employeeCode: attendance.employeeCode,

          employeeName: attendance.employeeName,

          department: attendance.department,

          position: attendance.position,

          rfidUid: attendance.rfidUid,

          checkIn: formatTime(attendance.checkInAt),

          checkInStatus: getCheckInLabel(attendance.checkInStatus),

          late:
            attendance.checkInStatus === "late"
              ? formatDuration(attendance.lateMinutes)
              : "-",

          checkOut: formatTime(attendance.checkOutAt),

          checkOutStatus: getCheckOutLabel(attendance),

          duration: formatDuration(attendance.workDurationMinutes),

          attendanceStatus:
            attendance.status === "completed" ? "Selesai" : "Belum checkout",
        });

        row.height = 23;

        row.eachCell(
          {
            includeEmpty: true,
          },
          (cell) => {
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
            };

            cell.border = {
              top: {
                style: "thin",
                color: {
                  argb: "FFE8EEF5",
                },
              },
              left: {
                style: "thin",
                color: {
                  argb: "FFE8EEF5",
                },
              },
              bottom: {
                style: "thin",
                color: {
                  argb: "FFE8EEF5",
                },
              },
              right: {
                style: "thin",
                color: {
                  argb: "FFE8EEF5",
                },
              },
            };

            if (index % 2 === 1) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                  argb: "FFF7FAFD",
                },
              };
            }
          },
        );

        // ================================================
        // STATUS MASUK
        // ================================================

        const checkInStatusCell = row.getCell(8);

        if (attendance.checkInStatus === "late") {
          checkInStatusCell.font = {
            bold: true,
            color: {
              argb: "FFB77900",
            },
          };
        } else if (attendance.checkInStatus === "on_time") {
          checkInStatusCell.font = {
            bold: true,
            color: {
              argb: "FF07875F",
            },
          };
        } else {
          checkInStatusCell.font = {
            bold: true,
            color: {
              argb: "FF007BFF",
            },
          };
        }

        // ================================================
        // LATE
        // ================================================

        if (attendance.checkInStatus === "late") {
          row.getCell(9).font = {
            bold: true,
            color: {
              argb: "FFB77900",
            },
          };
        }

        // ================================================
        // CHECKOUT
        // ================================================

        if (attendance.checkOutStatus === "early") {
          row.getCell(11).font = {
            bold: true,
            color: {
              argb: "FFB77900",
            },
          };
        }

        // ================================================
        // ATTENDANCE STATUS
        // ================================================

        row.getCell(13).font = {
          bold: true,
          color: {
            argb: attendance.status === "completed" ? "FF07875F" : "FFB77900",
          },
        };
      });

      // ======================================================
      // AUTOFILTER
      // ======================================================

      if (filteredRecords.length > 0) {
        worksheet.autoFilter = {
          from: {
            row: 5,
            column: 1,
          },

          to: {
            row: 5,
            column: 13,
          },
        };
      }

      // ======================================================
      // PRINT HEADER
      // ======================================================

      worksheet.pageSetup.printTitlesRow = "1:5";

      // ======================================================
      // CREATE FILE
      // ======================================================

      const buffer = await workbook.xlsx.writeBuffer();

      /*
       * ExcelJS dapat mengembalikan ArrayBufferLike.
       *
       * Blob membutuhkan ArrayBuffer yang konkret.
       * Karena ArrayBufferLike juga dapat berupa SharedArrayBuffer,
       * kita copy bytes ke ArrayBuffer baru agar TypeScript
       * dan browser sama-sama aman.
       */

      const sourceBytes = new Uint8Array(buffer);

      const safeArrayBuffer = new ArrayBuffer(sourceBytes.byteLength);

      const safeBytes = new Uint8Array(safeArrayBuffer);

      safeBytes.set(sourceBytes);

      const blob = new Blob([safeArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      const fileStart = startDate || "semua";

      const fileEnd = endDate || "semua";

      link.href = url;

      link.download = `laporan-absensi-${fileStart}-${fileEnd}.xlsx`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[EXPORT EXCEL]", error);

      window.alert("Gagal membuat file Excel.");
    } finally {
      setExporting(false);
    }
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#eaf4ff] text-[#007BFF]">
            <RefreshCw size={21} className="animate-spin" />
          </div>

          <p className="mt-4 text-xs font-bold text-[#8291a4]">
            Menyiapkan laporan absensi...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* ===================================================== */}
      {/* HEADER */}
      {/* ===================================================== */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
            Analisis dan rekap data kehadiran karyawan berdasarkan periode,
            status check-in, dan status check-out.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadAttendance(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#dce6f1] bg-white px-4 text-xs font-black text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF] disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            disabled={filteredRecords.length === 0 || exporting}
            onClick={() => void exportExcel()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#007BFF] px-4 text-xs font-black text-white transition hover:bg-[#006ee6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}

            {exporting ? "Membuat Excel..." : "Export Excel"}
          </button>
        </div>
      </div>

      {/* ===================================================== */}
      {/* ERROR */}
      {/* ===================================================== */}

      {loadError && (
        <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-[#ffd5d5] bg-[#fff0f0] p-4">
          <CircleAlert size={18} className="mt-0.5 shrink-0 text-[#ef4444]" />

          <div>
            <p className="text-sm font-black text-[#b42318]">
              Gagal memuat laporan
            </p>

            <p className="mt-1 text-xs font-semibold text-[#d92d20]">
              {loadError}
            </p>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* SUMMARY */}
      {/* ===================================================== */}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[26px] border border-[#153d62] bg-[#0d2f53] p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
            <UserRound size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-white">
            {uniqueEmployees}
          </p>

          <p className="mt-1 text-xs font-bold text-[#b7cada]">
            Karyawan tercatat
          </p>
        </article>

        <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e9f9f1] text-[#10b981]">
            <BadgeCheck size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
            {completedCount}
          </p>

          <p className="mt-1 text-xs font-bold text-[#8291a4]">
            Absensi selesai
          </p>
        </article>

        <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff7e5] text-[#f59e0b]">
            <Clock3 size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
            {lateCount}
          </p>

          <p className="mt-1 text-xs font-bold text-[#8291a4]">Terlambat</p>
        </article>

        <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff7e5] text-[#f59e0b]">
            <Timer size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
            {earlyCheckoutCount}
          </p>

          <p className="mt-1 text-xs font-bold text-[#8291a4]">
            Pulang lebih awal
          </p>
        </article>
      </div>

      {/* ===================================================== */}
      {/* REPORT */}
      {/* ===================================================== */}

      <section className="mt-6 overflow-hidden rounded-[28px] border border-[#dce6f1] bg-white shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
        <div className="border-b border-[#edf2f7] p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
              Attendance Report
            </p>

            <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#101828]">
              Rekap Kehadiran
            </h2>

            <p className="mt-1 text-xs text-[#8291a4]">
              {filteredRecords.length} data absensi ditemukan
            </p>
          </div>

          {/* ================================================= */}
          {/* FILTERS */}
          {/* ================================================= */}

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(240px,1fr)_180px_165px_165px_auto]">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#007BFF]"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama / kode karyawan..."
                className="h-11 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] pl-11 pr-4 text-sm font-semibold text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AttendanceFilter)
              }
              className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none focus:border-[#007BFF]"
            >
              <option value="all">Semua Status</option>

              <option value="early">Datang Lebih Awal</option>

              <option value="on_time">Tepat Waktu</option>

              <option value="late">Terlambat</option>

              <option value="checked_in">Belum Checkout</option>

              <option value="completed">Sudah Checkout</option>

              <option value="early_checkout">Pulang Lebih Awal</option>
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              max={endDate || undefined}
              className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none focus:border-[#007BFF]"
            />

            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              min={startDate || undefined}
              className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none focus:border-[#007BFF]"
            />

            {hasFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#dce6f1] bg-white px-4 text-xs font-black text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={filterToday}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#eaf4ff] px-3 text-[11px] font-black text-[#007BFF]"
            >
              <CalendarDays size={13} />
              Hari Ini
            </button>
          </div>
        </div>

        {/* =================================================== */}
        {/* DESKTOP TABLE */}
        {/* =================================================== */}

        {paginatedRecords.length > 0 && (
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#edf2f7] bg-[#f7fafd]">
                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-[#7f8fa3]">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-[#7f8fa3]">
                    Karyawan
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-[#7f8fa3]">
                    Masuk
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-[#7f8fa3]">
                    Status Masuk
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-[#7f8fa3]">
                    Pulang
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-[#7f8fa3]">
                    Durasi
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-[#7f8fa3]">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedRecords.map((attendance) => (
                  <tr
                    key={attendance.id}
                    className="border-b border-[#edf2f7] transition last:border-0 hover:bg-[#f7fafd]"
                  >
                    <td className="px-5 py-5">
                      <p className="whitespace-nowrap text-xs font-black text-[#52657a]">
                        {formatDate(attendance.dateKey)}
                      </p>
                    </td>

                    <td className="px-5 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf4ff] text-[#007BFF]">
                          <UserRound size={15} />
                        </div>

                        <div>
                          <p className="text-sm font-black text-[#334155]">
                            {attendance.employeeName}
                          </p>

                          <p className="mt-1 text-[10px] font-semibold text-[#8291a4]">
                            {attendance.employeeCode}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-5">
                      <p className="text-sm font-black text-[#172033]">
                        {formatTime(attendance.checkInAt)}
                      </p>
                    </td>

                    <td className="px-5 py-5">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[9px] font-black",

                            attendance.checkInStatus === "late"
                              ? "bg-[#fff7e5] text-[#b77900]"
                              : attendance.checkInStatus === "on_time"
                                ? "bg-[#e9f9f1] text-[#07875f]"
                                : "bg-[#eaf4ff] text-[#007BFF]",
                          ].join(" ")}
                        >
                          {getCheckInLabel(
                            attendance.checkInStatus,
                          ).toUpperCase()}
                        </span>

                        {attendance.checkInStatus === "late" &&
                          typeof attendance.lateMinutes === "number" && (
                            <span className="text-[10px] font-bold text-[#b77900]">
                              +{formatDuration(attendance.lateMinutes)}
                            </span>
                          )}
                      </div>
                    </td>

                    <td className="px-5 py-5">
                      <div>
                        <p className="text-sm font-black text-[#172033]">
                          {formatTime(attendance.checkOutAt)}
                        </p>

                        <p
                          className={[
                            "mt-1 text-[10px] font-bold",

                            attendance.checkOutStatus === "early"
                              ? "text-[#b77900]"
                              : "text-[#8291a4]",
                          ].join(" ")}
                        >
                          {getCheckOutLabel(attendance)}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-5">
                      <span className="text-xs font-black text-[#52657a]">
                        {formatDuration(attendance.workDurationMinutes)}
                      </span>
                    </td>

                    <td className="px-5 py-5">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1.5 text-[9px] font-black",

                          attendance.status === "completed"
                            ? "bg-[#e9f9f1] text-[#07875f]"
                            : "bg-[#fff7e5] text-[#b77900]",
                        ].join(" ")}
                      >
                        {attendance.status === "completed"
                          ? "SELESAI"
                          : "BELUM CHECKOUT"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =================================================== */}
        {/* MOBILE */}
        {/* =================================================== */}

        {paginatedRecords.length > 0 && (
          <div className="divide-y divide-[#edf2f7] xl:hidden">
            {paginatedRecords.map((attendance) => (
              <article key={attendance.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[#007BFF]">
                      <UserRound size={16} />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#172033]">
                        {attendance.employeeName}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-[#8291a4]">
                        {attendance.employeeCode}
                      </p>
                    </div>
                  </div>

                  <span
                    className={[
                      "shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black",

                      attendance.status === "completed"
                        ? "bg-[#e9f9f1] text-[#07875f]"
                        : "bg-[#fff7e5] text-[#b77900]",
                    ].join(" ")}
                  >
                    {attendance.status === "completed"
                      ? "SELESAI"
                      : "BELUM PULANG"}
                  </span>
                </div>

                <p className="mt-4 text-xs font-black text-[#52657a]">
                  {formatDate(attendance.dateKey)}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ReportItem
                    label="Masuk"
                    value={formatTime(attendance.checkInAt)}
                  />

                  <ReportItem
                    label="Pulang"
                    value={formatTime(attendance.checkOutAt)}
                  />

                  <ReportItem
                    label="Status Masuk"
                    value={getCheckInLabel(attendance.checkInStatus)}
                  />

                  <ReportItem
                    label="Durasi"
                    value={formatDuration(attendance.workDurationMinutes)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}

        {/* =================================================== */}
        {/* EMPTY */}
        {/* =================================================== */}

        {filteredRecords.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-[22px] bg-[#eaf4ff] text-[#007BFF]">
              <FileSpreadsheet size={27} />
            </div>

            <p className="mt-4 font-black text-[#172033]">
              Data laporan tidak ditemukan
            </p>

            <p className="mt-1 max-w-sm text-sm leading-6 text-[#8291a4]">
              {hasFilter
                ? "Tidak ada absensi yang sesuai dengan periode atau filter yang digunakan."
                : "Data absensi karyawan akan muncul di laporan ini."}
            </p>

            {hasFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#007BFF] px-4 text-xs font-black text-white"
              >
                <RotateCcw size={14} />
                Reset Filter
              </button>
            )}
          </div>
        )}

        {/* =================================================== */}
        {/* PAGINATION */}
        {/* =================================================== */}

        {filteredRecords.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-[#edf2f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs font-semibold text-[#8291a4]">
              Menampilkan{" "}
              <span className="font-black text-[#334155]">
                {paginationStart}
              </span>{" "}
              -{" "}
              <span className="font-black text-[#334155]">{paginationEnd}</span>{" "}
              dari{" "}
              <span className="font-black text-[#334155]">
                {filteredRecords.length}
              </span>{" "}
              data
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() =>
                  setCurrentPage((current) => Math.max(1, current - 1))
                }
                className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] disabled:opacity-40"
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
                  setCurrentPage((current) => Math.min(totalPages, current + 1))
                }
                className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// MOBILE REPORT ITEM
// ============================================================

function ReportItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#edf2f7] bg-[#f7fafd] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#94a3b8]">
        {label}
      </p>

      <p className="mt-2 text-xs font-black text-[#334155]">{value}</p>
    </div>
  );
}
