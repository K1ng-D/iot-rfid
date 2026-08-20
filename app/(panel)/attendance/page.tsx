"use client";

import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Timer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  AttendancePermission,
  AttendancePermissionType,
  AttendanceRecord,
  Employee,
} from "@/types/rfid";

// ============================================================
// TYPES
// ============================================================

type StatusFilter = "all" | "checked_in" | "completed" | "late";

type PermissionSort = "newest" | "oldest" | "name_asc" | "name_desc";

type PermissionForm = {
  employeeId: string;
  dateKey: string;
  type: AttendancePermissionType;
  reason: string;
};

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
// PERMISSION HELPERS
// ============================================================

function createEmptyPermissionForm(): PermissionForm {
  return {
    employeeId: "",
    dateKey: getTodayKey(),
    type: "absent",
    reason: "",
  };
}

// ============================================================

function getPermissionTypeLabel(type: AttendancePermissionType) {
  if (type === "late") {
    return "IZIN TERLAMBAT";
  }

  return "IZIN TIDAK MASUK";
}

// ============================================================

function getPermissionMatchKey(employeeId: string, dateKey: string) {
  return `${employeeId}::${dateKey}`;
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

  const [permissions, setPermissions] = useState<AttendancePermission[]>([]);

  const [permissionSearch, setPermissionSearch] = useState("");

  const [permissionDateFilter, setPermissionDateFilter] = useState("");

  const [permissionSort, setPermissionSort] =
    useState<PermissionSort>("newest");

  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);

  const attendanceRequestRunningRef = useRef(false);

  const [permissionLoading, setPermissionLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [dateFilter, setDateFilter] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // ==========================================================
  // PERMISSION MODAL
  // ==========================================================

  const [permissionModalOpen, setPermissionModalOpen] = useState(false);

  const [editingPermission, setEditingPermission] =
    useState<AttendancePermission | null>(null);

  const [permissionForm, setPermissionForm] = useState<PermissionForm>(() =>
    createEmptyPermissionForm(),
  );

  const [permissionFormError, setPermissionFormError] = useState("");

  const [savingPermission, setSavingPermission] = useState(false);

  const [deletingPermissionId, setDeletingPermissionId] = useState<
    string | null
  >(null);

  const [deletePermissionTarget, setDeletePermissionTarget] =
    useState<AttendancePermission | null>(null);

  const [deletePermissionError, setDeletePermissionError] = useState("");

  const todayKey = getTodayKey();

  // ==========================================================
  // LOAD ATTENDANCE
  // ==========================================================

  const loadAttendance = useCallback(async (silent = false) => {
    if (attendanceRequestRunningRef.current) {
      return;
    }

    attendanceRequestRunningRef.current = true;

    try {
      const response = await fetch("/api/attendance", {
        cache: "no-store",

        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Attendance API error: ${response.status}`);
      }

      const data = await response.json();

      setAttendance(Array.isArray(data.attendance) ? data.attendance : []);
    } catch (error) {
      /*
       * Polling background tidak perlu membuat
       * Next.js dev overlay merah saat Turbopack
       * sedang HMR/recompile.
       *
       * Initial request tetap dicatat agar
       * error asli masih terlihat saat debugging.
       */
      if (!silent) {
        console.warn("[ATTENDANCE] Gagal mengambil data:", error);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }

      attendanceRequestRunningRef.current = false;
    }
  }, []);

  // ==========================================================
  // LOAD PERMISSIONS
  // ==========================================================

  const loadPermissions = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance/permissions", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil data izin.");
      }

      setPermissions(data.permissions ?? []);
    } catch (error) {
      console.error("[ATTENDANCE PERMISSIONS]", error);
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  // ==========================================================
  // LOAD EMPLOYEES
  // ==========================================================

  const loadEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil data karyawan.");
      }

      setEmployees(data.employees ?? []);
    } catch (error) {
      console.error("[ATTENDANCE EMPLOYEES]", error);
    }
  }, []);

  // ==========================================================
  // POLLING
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    let timer: number | null = null;

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }

      timer = window.setTimeout(async () => {
        /*
         * Jangan polling ketika tab/browser
         * sedang tidak aktif.
         */
        if (document.visibilityState === "visible") {
          await loadAttendance(true);
        }

        scheduleNext();
      }, 5000);
    };

    const start = async () => {
      /*
       * Load pertama:
       * tampilkan state loading normal.
       */
      await loadAttendance(false);

      scheduleNext();
    };

    void start();

    return () => {
      cancelled = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [loadAttendance]);

  // ==========================================================
  // LOAD PERMISSION DATA
  // ==========================================================

  useEffect(() => {
    void loadPermissions();

    void loadEmployees();
  }, [loadPermissions, loadEmployees]);

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
  // ACTIVE EMPLOYEES
  // ==========================================================

  const activeEmployees = useMemo(() => {
    return employees
      .filter((employee) => employee.status === "active")
      .sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
  }, [employees]);

  // ==========================================================
  // SORTED PERMISSIONS
  // ==========================================================

  const filteredPermissions = useMemo(() => {
    const normalizedSearch = permissionSearch.trim().toLowerCase();

    const result = permissions.filter((permission) => {
      // ======================================================
      // SEARCH
      // ======================================================

      const matchesSearch =
        !normalizedSearch ||
        permission.employeeName.toLowerCase().includes(normalizedSearch) ||
        permission.employeeCode.toLowerCase().includes(normalizedSearch) ||
        permission.department.toLowerCase().includes(normalizedSearch) ||
        permission.reason.toLowerCase().includes(normalizedSearch);

      // ======================================================
      // DATE
      // ======================================================

      const matchesDate =
        !permissionDateFilter || permission.dateKey === permissionDateFilter;

      return matchesSearch && matchesDate;
    });

    // ========================================================
    // SORT
    // ========================================================

    return [...result].sort((a, b) => {
      switch (permissionSort) {
        case "oldest":
          return a.dateKey.localeCompare(b.dateKey);

        case "name_asc":
          return a.employeeName.localeCompare(b.employeeName, "id-ID");

        case "name_desc":
          return b.employeeName.localeCompare(a.employeeName, "id-ID");

        case "newest":
        default:
          return b.dateKey.localeCompare(a.dateKey);
      }
    });
  }, [permissions, permissionSearch, permissionDateFilter, permissionSort]);

  const hasPermissionFilter =
    permissionSearch.trim() !== "" ||
    permissionDateFilter !== "" ||
    permissionSort !== "newest";

  function resetPermissionFilter() {
    setPermissionSearch("");
    setPermissionDateFilter("");
    setPermissionSort("newest");
  }

  // ==========================================================
  // LATE PERMISSION LOOKUP
  // ==========================================================

  const latePermissionKeys = useMemo(() => {
    return new Set(
      permissions
        .filter((permission) => permission.type === "late")
        .map((permission) =>
          getPermissionMatchKey(permission.employeeId, permission.dateKey),
        ),
    );
  }, [permissions]);

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
  // OPEN CREATE PERMISSION
  // ==========================================================

  function openCreatePermission() {
    setEditingPermission(null);

    setPermissionForm(createEmptyPermissionForm());

    setPermissionFormError("");

    setPermissionModalOpen(true);
  }

  // ==========================================================
  // OPEN EDIT PERMISSION
  // ==========================================================

  function openEditPermission(permission: AttendancePermission) {
    setEditingPermission(permission);

    setPermissionForm({
      employeeId: permission.employeeId,
      dateKey: permission.dateKey,
      type: permission.type,
      reason: permission.reason,
    });

    setPermissionFormError("");

    setPermissionModalOpen(true);
  }

  // ==========================================================
  // CLOSE PERMISSION MODAL
  // ==========================================================

  function closePermissionModal() {
    if (savingPermission) {
      return;
    }

    setPermissionModalOpen(false);

    setEditingPermission(null);

    setPermissionForm(createEmptyPermissionForm());

    setPermissionFormError("");
  }

  // ==========================================================
  // SAVE PERMISSION
  // ==========================================================

  async function handlePermissionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPermissionFormError("");

    if (!permissionForm.employeeId) {
      setPermissionFormError("Karyawan wajib dipilih.");

      return;
    }

    if (!permissionForm.dateKey) {
      setPermissionFormError("Tanggal izin wajib dipilih.");

      return;
    }

    if (permissionForm.reason.trim().length < 3) {
      setPermissionFormError("Alasan izin minimal 3 karakter.");

      return;
    }

    setSavingPermission(true);

    try {
      const endpoint = editingPermission
        ? `/api/attendance/permissions/${editingPermission.id}`
        : "/api/attendance/permissions";

      const method = editingPermission ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          employeeId: permissionForm.employeeId,

          dateKey: permissionForm.dateKey,

          type: permissionForm.type,

          reason: permissionForm.reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menyimpan izin.");
      }

      await loadPermissions();

      setPermissionModalOpen(false);

      setEditingPermission(null);

      setPermissionForm(createEmptyPermissionForm());

      setPermissionFormError("");
    } catch (error) {
      setPermissionFormError(
        error instanceof Error ? error.message : "Gagal menyimpan izin.",
      );
    } finally {
      setSavingPermission(false);
    }
  }

  // ==========================================================
  // DELETE PERMISSION
  // ==========================================================

  function openDeletePermissionConfirmation(permission: AttendancePermission) {
    setDeletePermissionTarget(permission);

    setDeletePermissionError("");
  }

  // ==========================================================

  function closeDeletePermissionConfirmation() {
    if (deletingPermissionId) {
      return;
    }

    setDeletePermissionTarget(null);

    setDeletePermissionError("");
  }

  // ==========================================================

  async function confirmDeletePermission() {
    if (!deletePermissionTarget || deletingPermissionId) {
      return;
    }

    setDeletingPermissionId(deletePermissionTarget.id);

    setDeletePermissionError("");

    try {
      const response = await fetch(
        `/api/attendance/permissions/${deletePermissionTarget.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menghapus izin.");
      }

      setDeletePermissionTarget(null);

      await loadPermissions();
    } catch (error) {
      setDeletePermissionError(
        error instanceof Error ? error.message : "Gagal menghapus izin.",
      );
    } finally {
      setDeletingPermissionId(null);
    }
  }
  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* ===================================================== */}
      {/* INTRO */}
      {/* ===================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
          Pantau jam masuk, jam pulang, serta catatan izin karyawan.
        </p>

        <button
          type="button"
          onClick={openCreatePermission}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#007BFF] px-5 text-sm font-black text-white shadow-[0_8px_24px_rgba(0,123,255,0.20)] transition hover:bg-[#006ee6] sm:w-auto"
        >
          <Plus size={17} />
          Catat Izin
        </button>
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
      {/* PERMISSIONS */}
      {/* ===================================================== */}

      <section className="mt-6 overflow-hidden rounded-[28px] border border-[#dce6f1] bg-white shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
        {/* PERMISSION HEADER */}

        <div className="border-b border-[#edf2f7] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#101828]">
                Catatan Izin
              </h2>

              <p className="mt-1 text-xs text-[#8291a4]">
                {permissionLoading
                  ? "Memuat data..."
                  : `${filteredPermissions.length} dari ${permissions.length} catatan izin`}
              </p>
            </div>

            {/* FILTER */}

            <div className="flex w-full flex-col gap-3 md:flex-row xl:w-auto">
              {/* SEARCH */}

              <div className="relative w-full md:min-w-[250px] xl:w-72">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#007BFF]"
                />

                <input
                  type="search"
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  placeholder="Cari karyawan..."
                  className="h-11 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] pl-11 pr-4 text-sm font-medium text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                />
              </div>

              {/* DATE */}

              <input
                type="date"
                value={permissionDateFilter}
                onChange={(event) =>
                  setPermissionDateFilter(event.target.value)
                }
                className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
              />

              {/* SORT */}

              <select
                value={permissionSort}
                onChange={(event) =>
                  setPermissionSort(event.target.value as PermissionSort)
                }
                className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
              >
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
                <option value="name_asc">Nama A - Z</option>
                <option value="name_desc">Nama Z - A</option>
              </select>

              {hasPermissionFilter && (
                <button
                  type="button"
                  onClick={resetPermissionFilter}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#dce6f1] bg-white px-4 text-sm font-bold text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
                >
                  <RotateCcw size={15} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {permissionLoading ? (
          <div className="p-8 text-center text-sm font-semibold text-[#8291a4]">
            Memuat catatan izin...
          </div>
        ) : filteredPermissions.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#eaf4ff] text-[#007BFF]">
              <CalendarDays size={24} />
            </div>

            <p className="mt-4 text-sm font-black text-[#172033]">
              {permissions.length === 0
                ? "Belum ada catatan izin"
                : "Catatan izin tidak ditemukan"}
            </p>

            <p className="mt-1 max-w-sm text-xs leading-5 text-[#8291a4]">
              {permissions.length === 0
                ? "Izin tidak masuk atau izin terlambat yang dicatat admin akan muncul di sini."
                : "Coba ubah kata pencarian, tanggal, atau urutan data."}
            </p>

            {hasPermissionFilter && (
              <button
                type="button"
                onClick={resetPermissionFilter}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#007BFF] px-4 text-xs font-black text-white transition hover:bg-[#006ee6]"
              >
                <RotateCcw size={14} />
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredPermissions.map((permission) => (
              <article
                key={permission.id}
                className="rounded-[22px] border border-[#e5edf5] bg-[#f9fbfd] p-5"
              >
                {/* HEADER */}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={[
                        "inline-flex rounded-full px-3 py-1.5 text-[9px] font-black",
                        permission.type === "late"
                          ? "bg-[#fff7e5] text-[#b77900]"
                          : "bg-[#eaf4ff] text-[#007BFF]",
                      ].join(" ")}
                    >
                      {getPermissionTypeLabel(permission.type)}
                    </span>

                    <p className="mt-3 truncate text-sm font-black text-[#172033]">
                      {permission.employeeName}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-[#8291a4]">
                      {permission.employeeCode} · {permission.department}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEditPermission(permission)}
                      className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
                      title="Edit izin"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      type="button"
                      disabled={deletingPermissionId === permission.id}
                      onClick={() =>
                        openDeletePermissionConfirmation(permission)
                      }
                      className="flex size-9 items-center justify-center rounded-xl border border-[#ffd7d7] bg-white text-[#ef4444] transition hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-50"
                      title="Hapus izin"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* DATE */}

                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#52657a]">
                  <CalendarDays size={14} className="text-[#007BFF]" />
                  {formatDateKey(permission.dateKey)}
                </div>

                {/* REASON */}

                <div className="mt-4 rounded-2xl bg-white p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">
                    Alasan
                  </p>

                  <p className="mt-2 text-xs font-semibold leading-5 text-[#52657a]">
                    {permission.reason}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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

                const hasLatePermission =
                  late &&
                  latePermissionKeys.has(
                    getPermissionMatchKey(item.employeeId, item.dateKey),
                  );

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
                          <span
                            className={[
                              "inline-flex rounded-full px-3 py-1.5 text-[10px] font-black",
                              hasLatePermission
                                ? "bg-[#eaf4ff] text-[#007BFF]"
                                : "bg-[#fff7e5] text-[#b77900]",
                            ].join(" ")}
                          >
                            {hasLatePermission
                              ? "TERLAMBAT BERIZIN"
                              : "TERLAMBAT"}
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

            const hasLatePermission =
              late &&
              latePermissionKeys.has(
                getPermissionMatchKey(item.employeeId, item.dateKey),
              );

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
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-[9px] font-black",
                          hasLatePermission
                            ? "bg-[#eaf4ff] text-[#007BFF]"
                            : "bg-[#fff7e5] text-[#b77900]",
                        ].join(" ")}
                      >
                        {hasLatePermission ? "TERLAMBAT BERIZIN" : "TERLAMBAT"}
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
      {/* ===================================================== */}
      {/* CREATE / EDIT PERMISSION MODAL */}
      {/* ===================================================== */}

      {permissionModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0d2f53]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[30px] bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-[30px] sm:p-7">
            {/* HEADER */}

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
                  Attendance
                </p>

                <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#172033]">
                  {editingPermission ? "Edit Izin" : "Catat Izin"}
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#8291a4]">
                  Catat izin tidak masuk atau keterlambatan karyawan.
                </p>
              </div>

              <button
                type="button"
                disabled={savingPermission}
                onClick={closePermissionModal}
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b] transition hover:bg-[#eaf4ff] hover:text-[#007BFF] disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePermissionSubmit} className="mt-6 space-y-4">
              {/* EMPLOYEE */}

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#52657a]">
                  Karyawan
                </span>

                <select
                  value={permissionForm.employeeId}
                  onChange={(event) => {
                    setPermissionForm((current) => ({
                      ...current,

                      employeeId: event.target.value,
                    }));

                    setPermissionFormError("");
                  }}
                  disabled={savingPermission}
                  className="h-12 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#172033] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10 disabled:opacity-60"
                >
                  <option value="">Pilih karyawan</option>

                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employeeCode} - {employee.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* TYPE */}

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#52657a]">
                  Jenis Izin
                </span>

                <select
                  value={permissionForm.type}
                  onChange={(event) =>
                    setPermissionForm((current) => ({
                      ...current,

                      type: event.target.value as AttendancePermissionType,
                    }))
                  }
                  disabled={savingPermission}
                  className="h-12 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#172033] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10 disabled:opacity-60"
                >
                  <option value="absent">Izin Tidak Masuk</option>

                  <option value="late">Izin Terlambat</option>
                </select>
              </label>

              {/* DATE */}

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#52657a]">
                  Tanggal
                </span>

                <input
                  type="date"
                  value={permissionForm.dateKey}
                  onChange={(event) =>
                    setPermissionForm((current) => ({
                      ...current,

                      dateKey: event.target.value,
                    }))
                  }
                  disabled={savingPermission}
                  className="h-12 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#172033] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10 disabled:opacity-60"
                />
              </label>

              {/* REASON */}

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#52657a]">
                  Alasan
                </span>

                <textarea
                  value={permissionForm.reason}
                  onChange={(event) => {
                    setPermissionForm((current) => ({
                      ...current,

                      reason: event.target.value,
                    }));

                    setPermissionFormError("");
                  }}
                  disabled={savingPermission}
                  rows={3}
                  placeholder="Contoh: Keperluan keluarga"
                  className="w-full resize-none rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 py-3 text-sm font-semibold leading-6 text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10 disabled:opacity-60"
                />
              </label>

              {/* ERROR */}

              {permissionFormError && (
                <div className="flex items-start gap-3 rounded-2xl border border-[#ffd5d5] bg-[#fff0f0] px-4 py-3 text-xs font-bold text-[#d92d20]">
                  <CircleAlert size={16} className="mt-0.5 shrink-0" />

                  {permissionFormError}
                </div>
              )}

              {/* ACTION */}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingPermission}
                  onClick={closePermissionModal}
                  className="h-12 flex-1 rounded-2xl border border-[#dce6f1] bg-white text-sm font-bold text-[#64748b] transition hover:bg-[#f7fafd] disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={savingPermission}
                  className="h-12 flex-1 rounded-2xl bg-[#007BFF] text-sm font-black text-white transition hover:bg-[#006ee6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPermission
                    ? "Menyimpan..."
                    : editingPermission
                      ? "Simpan Perubahan"
                      : "Simpan Izin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ===================================================== */}
      {/* DELETE PERMISSION MODAL */}
      {/* ===================================================== */}

      {deletePermissionTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0d2f53]/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-7">
            {/* ICON */}

            <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#fff0f0] text-[#ef4444]">
              <Trash2 size={22} />
            </div>

            {/* TITLE */}

            <h2 className="mt-5 text-xl font-black tracking-[-0.03em] text-[#172033]">
              Hapus catatan izin?
            </h2>

            {/* DESCRIPTION */}

            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Catatan izin milik{" "}
              <span className="font-black text-[#172033]">
                {deletePermissionTarget.employeeName}
              </span>{" "}
              pada tanggal{" "}
              <span className="font-black text-[#172033]">
                {formatDateKey(deletePermissionTarget.dateKey)}
              </span>{" "}
              akan dihapus dari sistem.
            </p>

            {/* PERMISSION INFO */}

            <div className="mt-4 rounded-2xl border border-[#e5edf5] bg-[#f7fafd] p-4">
              <div className="flex items-start gap-3">
                <CalendarDays
                  size={17}
                  className="mt-0.5 shrink-0 text-[#007BFF]"
                />

                <div className="min-w-0">
                  <p className="text-xs font-black text-[#334155]">
                    {getPermissionTypeLabel(deletePermissionTarget.type)}
                  </p>

                  <p className="mt-1 text-xs font-semibold leading-5 text-[#8291a4]">
                    {deletePermissionTarget.reason}
                  </p>
                </div>
              </div>
            </div>

            {/* ERROR */}

            {deletePermissionError && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#ffd5d5] bg-[#fff0f0] p-4">
                <CircleAlert
                  size={17}
                  className="mt-0.5 shrink-0 text-[#ef4444]"
                />

                <p className="text-xs font-bold leading-5 text-[#d92d20]">
                  {deletePermissionError}
                </p>
              </div>
            )}

            {/* ACTIONS */}

            <div className="mt-6 grid grid-cols-2 gap-3">
              {/* CANCEL */}

              <button
                type="button"
                disabled={deletingPermissionId !== null}
                onClick={closeDeletePermissionConfirmation}
                className="flex h-12 items-center justify-center rounded-2xl border border-[#dce6f1] bg-white text-sm font-bold text-[#64748b] transition hover:bg-[#f7fafd] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>

              {/* DELETE */}

              <button
                type="button"
                disabled={deletingPermissionId !== null}
                onClick={() => void confirmDeletePermission()}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ef4444] text-sm font-bold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingPermissionId ? (
                  <>Menghapus...</>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Hapus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
