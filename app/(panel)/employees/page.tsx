"use client";

import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CreditCard,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { Employee } from "@/types/rfid";

// ============================================================
// TYPES
// ============================================================

interface EmployeeForm {
  name: string;
  department: string;
  position: string;
  status: "active" | "inactive";
}

type StatusFilter = "all" | "active" | "inactive";

type RfidFilter = "all" | "registered" | "unregistered";

type SortOption = "name_asc" | "name_desc" | "code_asc" | "code_desc";

interface ToastState {
  type: "success" | "error";
  message: string;
}

// ============================================================
// CONFIG
// ============================================================

const PAGE_SIZE = 10;

const emptyForm: EmployeeForm = {
  name: "",
  department: "",
  position: "",
  status: "active",
};

// ============================================================
// PAGE
// ============================================================

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [rfidFilter, setRfidFilter] = useState<RfidFilter>("all");

  const [sortOption, setSortOption] = useState<SortOption>("name_asc");

  const [currentPage, setCurrentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const [form, setForm] = useState<EmployeeForm>(emptyForm);

  const [formError, setFormError] = useState("");

  const [loadError, setLoadError] = useState("");

  const [toast, setToast] = useState<ToastState | null>(null);

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = useCallback((type: ToastState["type"], message: string) => {
    setToast({
      type,
      message,
    });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  // ==========================================================
  // LOAD EMPLOYEES
  // ==========================================================

  const loadEmployees = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/employees", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil data karyawan.");
      }

      setEmployees(Array.isArray(data.employees) ? data.employees : []);

      setLoadError("");
    } catch (loadEmployeeError) {
      setLoadError(
        loadEmployeeError instanceof Error
          ? loadEmployeeError.message
          : "Gagal mengambil data karyawan.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "active").length,
    [employees],
  );

  const registeredRfid = useMemo(
    () => employees.filter((employee) => Boolean(employee.rfidUid)).length,
    [employees],
  );

  const waitingRfid = useMemo(
    () => employees.filter((employee) => !employee.rfidUid).length,
    [employees],
  );

  // ==========================================================
  // FILTER & SORT
  // ==========================================================

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = employees.filter((employee) => {
      const matchesSearch =
        !keyword ||
        [
          employee.name,
          employee.employeeCode,
          employee.department,
          employee.position,
          employee.rfidUid ?? "",
        ].some((value) => value.toLowerCase().includes(keyword));

      const matchesStatus =
        statusFilter === "all" || employee.status === statusFilter;

      const matchesRfid =
        rfidFilter === "all" ||
        (rfidFilter === "registered" && Boolean(employee.rfidUid)) ||
        (rfidFilter === "unregistered" && !employee.rfidUid);

      return matchesSearch && matchesStatus && matchesRfid;
    });

    return [...result].sort((a, b) => {
      if (sortOption === "name_asc") {
        return a.name.localeCompare(b.name, "id-ID");
      }

      if (sortOption === "name_desc") {
        return b.name.localeCompare(a.name, "id-ID");
      }

      if (sortOption === "code_asc") {
        return a.employeeCode.localeCompare(b.employeeCode, "id-ID");
      }

      return b.employeeCode.localeCompare(a.employeeCode, "id-ID");
    });
  }, [employees, search, statusFilter, rfidFilter, sortOption]);

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / PAGE_SIZE),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, rfidFilter, sortOption]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, currentPage]);

  const paginationStart =
    filteredEmployees.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;

  const paginationEnd = Math.min(
    currentPage * PAGE_SIZE,
    filteredEmployees.length,
  );

  // ==========================================================
  // FILTER STATE
  // ==========================================================

  const hasActiveFilter =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    rfidFilter !== "all" ||
    sortOption !== "name_asc";

  function resetFilters() {
    setSearch("");

    setStatusFilter("all");

    setRfidFilter("all");

    setSortOption("name_asc");

    setCurrentPage(1);
  }

  // ==========================================================
  // CREATE
  // ==========================================================

  function openCreate() {
    setEditingEmployee(null);

    setForm(emptyForm);

    setFormError("");

    setModalOpen(true);
  }

  // ==========================================================
  // EDIT
  // ==========================================================

  function openEdit(employee: Employee) {
    setEditingEmployee(employee);

    setForm({
      name: employee.name,
      department: employee.department,
      position: employee.position,
      status: employee.status,
    });

    setFormError("");

    setModalOpen(true);
  }

  // ==========================================================
  // CLOSE MODAL
  // ==========================================================

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);

    setEditingEmployee(null);

    setForm(emptyForm);

    setFormError("");
  }

  // ==========================================================
  // SAVE
  // ==========================================================

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setFormError("");

    const employeeName = form.name.trim();

    if (employeeName.length < 2) {
      setFormError("Nama karyawan minimal 2 karakter.");

      return;
    }

    setSaving(true);

    const isEditing = Boolean(editingEmployee);

    try {
      const endpoint = editingEmployee
        ? `/api/employees/${editingEmployee.id}`
        : "/api/employees";

      const method = editingEmployee ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name: employeeName,

          department: form.department.trim(),

          position: form.position.trim(),

          status: form.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menyimpan data.");
      }

      setModalOpen(false);

      setEditingEmployee(null);

      setForm(emptyForm);

      await loadEmployees();

      showToast(
        "success",
        isEditing
          ? "Data karyawan berhasil diperbarui."
          : "Karyawan berhasil ditambahkan.",
      );
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menyimpan data.",
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // DELETE
  // ==========================================================

  function openDeleteConfirmation(employee: Employee) {
    setDeleteTarget(employee);
  }

  function closeDeleteConfirmation() {
    if (deleting) {
      return;
    }

    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/employees/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menghapus karyawan.");
      }

      setDeleteTarget(null);

      await loadEmployees();

      showToast("success", "Karyawan berhasil dihapus.");
    } catch (deleteError) {
      showToast(
        "error",
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus karyawan.",
      );
    } finally {
      setDeleting(false);
    }
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex flex-col items-center">
          <p className="mt-4 text-xs font-bold text-[#8291a4]">
            Memuat data karyawan...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <>
      <div className="mx-auto max-w-[1500px]">
        {/* =================================================== */}
        {/* HEADER */}
        {/* =================================================== */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
              Kelola identitas karyawan, status keaktifan, dan hubungan kartu
              RFID.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#007BFF] px-5 text-sm font-bold text-white shadow-lg shadow-[#007BFF]/20 transition hover:-translate-y-0.5 hover:bg-[#006ee6]"
          >
            <Plus size={17} />
            Tambah Karyawan
          </button>
        </div>

        {/* =================================================== */}
        {/* LOAD ERROR */}
        {/* =================================================== */}

        {loadError && (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-[20px] border border-[#ffd5d5] bg-[#fff0f0] p-4">
            <div className="flex items-start gap-3">
              <CircleAlert
                size={18}
                className="mt-0.5 shrink-0 text-[#ef4444]"
              />

              <div>
                <p className="text-sm font-black text-[#b42318]">
                  Gagal memuat data
                </p>

                <p className="mt-1 text-xs font-semibold text-[#d92d20]">
                  {loadError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadEmployees(true)}
              className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#d92d20]"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* =================================================== */}
        {/* SUMMARY */}
        {/* =================================================== */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* TOTAL */}

          <article className="rounded-[26px] border border-[#153d62] bg-[#0d2f53] p-6 shadow-[0_12px_40px_rgba(13,47,83,0.08)]">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
              <Users size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-white">
              {employees.length}
            </p>

            <p className="mt-1 text-xs font-bold text-[#b7cada]">
              Total karyawan
            </p>
          </article>

          {/* ACTIVE */}

          <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e9f9f1] text-[#10b981]">
              <BadgeCheck size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
              {activeEmployees}
            </p>

            <p className="mt-1 text-xs font-bold text-[#8291a4]">
              Karyawan aktif
            </p>
          </article>

          {/* RFID REGISTERED */}

          <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[#007BFF]">
              <CreditCard size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
              {registeredRfid}
            </p>

            <p className="mt-1 text-xs font-bold text-[#8291a4]">
              RFID terdaftar
            </p>
          </article>

          {/* WAITING */}

          <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff7e5] text-[#f59e0b]">
              <CreditCard size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
              {waitingRfid}
            </p>

            <p className="mt-1 text-xs font-bold text-[#8291a4]">
              Menunggu RFID
            </p>
          </article>
        </div>

        {/* =================================================== */}
        {/* LIST */}
        {/* =================================================== */}

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#dce6f1] bg-white">
          {/* ================================================= */}
          {/* LIST HEADER */}
          {/* ================================================= */}

          <div className="border-b border-[#edf2f7] p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black tracking-[-0.025em] text-[#101828]">
                    Daftar Karyawan
                  </h2>

                  <p className="mt-1 text-xs text-[#8291a4]">
                    {filteredEmployees.length} data ditemukan
                  </p>
                </div>
              </div>

              {/* FILTERS */}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_170px_180px_170px_auto]">
                {/* SEARCH */}

                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#007BFF]"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari nama, kode, departemen..."
                    className="h-11 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] pl-11 pr-4 text-sm font-medium text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                  />
                </div>

                {/* STATUS */}

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                >
                  <option value="all">Semua Status</option>

                  <option value="active">Aktif</option>

                  <option value="inactive">Nonaktif</option>
                </select>

                {/* RFID */}

                <select
                  value={rfidFilter}
                  onChange={(event) =>
                    setRfidFilter(event.target.value as RfidFilter)
                  }
                  className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                >
                  <option value="all">Semua RFID</option>

                  <option value="registered">RFID Terdaftar</option>

                  <option value="unregistered">Belum Terdaftar</option>
                </select>

                {/* SORT */}

                <select
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(event.target.value as SortOption)
                  }
                  className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                >
                  <option value="name_asc">Nama A-Z</option>

                  <option value="name_desc">Nama Z-A</option>

                  <option value="code_asc">Kode A-Z</option>

                  <option value="code_desc">Kode Z-A</option>
                </select>

                {/* RESET */}

                {hasActiveFilter && (
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
          {/* DESKTOP TABLE */}
          {/* ================================================= */}

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#edf2f7] bg-[#f7fafd] text-left">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                    Karyawan
                  </th>

                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                    Department
                  </th>

                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                    RFID
                  </th>

                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                    Status
                  </th>

                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedEmployees.map((employee) => (
                  <tr
                    key={employee.id}
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
                            {employee.name}
                          </p>

                          <p className="mt-1 text-[11px] font-bold text-[#8291a4]">
                            {employee.employeeCode}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* DEPARTMENT */}

                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-[#334155]">
                        {employee.department || "-"}
                      </p>

                      <p className="mt-1 text-xs text-[#8291a4]">
                        {employee.position || "-"}
                      </p>
                    </td>

                    {/* RFID */}

                    <td className="px-6 py-5">
                      {employee.rfidUid ? (
                        <div>
                          <span className="inline-flex rounded-xl bg-[#e9f9f1] px-3 py-2 font-mono text-xs font-bold text-[#07875f]">
                            {employee.rfidUid}
                          </span>

                          <p className="mt-1.5 text-[10px] font-bold text-[#10b981]">
                            TERDAFTAR
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-xl bg-[#fff7e5] px-3 py-2 text-xs font-bold text-[#b77900]">
                          Belum terdaftar
                        </span>
                      )}
                    </td>

                    {/* STATUS */}

                    <td className="px-6 py-5">
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black",

                          employee.status === "active"
                            ? "bg-[#e9f9f1] text-[#07875f]"
                            : "bg-[#f1f5f9] text-[#64748b]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "size-1.5 rounded-full",

                            employee.status === "active"
                              ? "bg-[#10b981]"
                              : "bg-[#94a3b8]",
                          ].join(" ")}
                        />

                        {employee.status === "active" ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>

                    {/* ACTION */}

                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(employee)}
                          title="Edit karyawan"
                          className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#007BFF] transition hover:border-[#007BFF] hover:bg-[#eaf4ff]"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteConfirmation(employee)}
                          title="Hapus karyawan"
                          className="flex size-9 items-center justify-center rounded-xl border border-[#ffdede] bg-white text-[#ef4444] transition hover:bg-[#fff0f0]"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ================================================= */}
          {/* MOBILE */}
          {/* ================================================= */}

          <div className="divide-y divide-[#edf2f7] lg:hidden">
            {paginatedEmployees.map((employee) => (
              <article key={employee.id} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
                    <UserRound size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#172033]">
                      {employee.name}
                    </p>

                    <p className="mt-1 text-[11px] font-bold text-[#8291a4]">
                      {employee.employeeCode}
                    </p>

                    <span
                      className={[
                        "mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-black",

                        employee.status === "active"
                          ? "bg-[#e9f9f1] text-[#07875f]"
                          : "bg-[#f1f5f9] text-[#64748b]",
                      ].join(" ")}
                    >
                      {employee.status === "active" ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(employee)}
                      className="flex size-9 items-center justify-center rounded-xl bg-[#eaf4ff] text-[#007BFF]"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => openDeleteConfirmation(employee)}
                      className="flex size-9 items-center justify-center rounded-xl bg-[#fff0f0] text-[#ef4444]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#f7fafd] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#8291a4]">
                      Departemen
                    </p>

                    <p className="mt-2 truncate text-xs font-black text-[#334155]">
                      {employee.department || "-"}
                    </p>

                    <p className="mt-1 truncate text-[10px] font-semibold text-[#94a3b8]">
                      {employee.position || "-"}
                    </p>
                  </div>

                  <div
                    className={[
                      "rounded-2xl p-4",

                      employee.rfidUid ? "bg-[#e9f9f1]" : "bg-[#fff7e5]",
                    ].join(" ")}
                  >
                    <p
                      className={[
                        "text-[10px] font-black uppercase tracking-wider",

                        employee.rfidUid ? "text-[#07875f]" : "text-[#b77900]",
                      ].join(" ")}
                    >
                      RFID
                    </p>

                    <p
                      className={[
                        "mt-2 truncate font-mono text-xs font-black",

                        employee.rfidUid ? "text-[#067052]" : "text-[#9a6700]",
                      ].join(" ")}
                    >
                      {employee.rfidUid || "Belum terdaftar"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* ================================================= */}
          {/* EMPTY */}
          {/* ================================================= */}

          {filteredEmployees.length === 0 && (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-[22px] bg-[#eaf4ff] text-[#007BFF]">
                <Users size={28} />
              </div>

              <p className="mt-4 font-black text-[#172033]">
                {hasActiveFilter
                  ? "Karyawan tidak ditemukan"
                  : "Belum ada karyawan"}
              </p>

              <p className="mt-1 max-w-sm text-sm leading-6 text-[#8291a4]">
                {hasActiveFilter
                  ? "Coba ubah pencarian atau filter yang sedang digunakan."
                  : "Tambahkan data karyawan pertama untuk mulai menggunakan sistem."}
              </p>

              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 flex h-10 items-center gap-2 rounded-xl bg-[#007BFF] px-4 text-xs font-black text-white"
                >
                  <RotateCcw size={14} />
                  Reset Filter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 flex h-10 items-center gap-2 rounded-xl bg-[#007BFF] px-4 text-xs font-black text-white"
                >
                  <Plus size={14} />
                  Tambah Karyawan
                </button>
              )}
            </div>
          )}

          {/* ================================================= */}
          {/* PAGINATION */}
          {/* ================================================= */}

          {filteredEmployees.length > 0 && (
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
                  {filteredEmployees.length}
                </span>{" "}
                karyawan
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setCurrentPage((current) => Math.max(1, current - 1))
                  }
                  className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ===================================================== */}
      {/* CREATE / EDIT MODAL */}
      {/* ===================================================== */}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0d2f53]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="w-full max-w-lg rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
                  Employee
                </p>

                <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#172033]">
                  {editingEmployee ? "Edit Karyawan" : "Tambah Karyawan"}
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#8291a4]">
                  {editingEmployee
                    ? "Perbarui informasi karyawan."
                    : "Masukkan data karyawan baru."}
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b] transition hover:bg-[#eaf4ff] hover:text-[#007BFF] disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* NAME */}

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#52657a]">
                  Nama Karyawan
                </span>

                <input
                  value={form.name}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }));

                    setFormError("");
                  }}
                  placeholder="Masukkan nama lengkap"
                  autoFocus
                  className="h-12 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* DEPARTMENT */}

                <label className="block">
                  <span className="mb-2 block text-xs font-black text-[#52657a]">
                    Departemen
                  </span>

                  <input
                    value={form.department}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        department: event.target.value,
                      }))
                    }
                    placeholder="Contoh: IT"
                    className="h-12 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                  />
                </label>

                {/* POSITION */}

                <label className="block">
                  <span className="mb-2 block text-xs font-black text-[#52657a]">
                    Jabatan
                  </span>

                  <input
                    value={form.position}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        position: event.target.value,
                      }))
                    }
                    placeholder="Contoh: Developer"
                    className="h-12 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                  />
                </label>
              </div>

              {/* STATUS */}

              <label className="block">
                <span className="mb-2 block text-xs font-black text-[#52657a]">
                  Status
                </span>

                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as "active" | "inactive",
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#172033] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                >
                  <option value="active">Aktif</option>

                  <option value="inactive">Nonaktif</option>
                </select>
              </label>

              {/* RFID INFO */}

              {editingEmployee && (
                <div className="rounded-2xl border border-[#edf2f7] bg-[#f7fafd] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8291a4]">
                    RFID
                  </p>

                  {editingEmployee.rfidUid ? (
                    <div className="mt-2 flex items-center gap-2">
                      <CircleCheck size={16} className="text-[#10b981]" />

                      <p className="font-mono text-xs font-black text-[#07875f]">
                        {editingEmployee.rfidUid}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-bold text-[#b77900]">
                      Karyawan belum memiliki kartu RFID.
                    </p>
                  )}
                </div>
              )}

              {/* FORM ERROR */}

              {formError && (
                <div className="flex items-start gap-3 rounded-2xl border border-[#ffd5d5] bg-[#fff0f0] px-4 py-3 text-xs font-bold text-[#d92d20]">
                  <CircleAlert size={16} className="mt-0.5 shrink-0" />

                  {formError}
                </div>
              )}

              {/* ACTION */}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="h-12 flex-1 rounded-2xl border border-[#dce6f1] bg-white text-sm font-bold text-[#64748b] transition hover:bg-[#f7fafd] disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* DELETE MODAL */}
      {/* ===================================================== */}

      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0d2f53]/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-7">
            {/* ICON */}

            <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#fff0f0] text-[#ef4444]">
              <Trash2 size={22} />
            </div>

            {/* TITLE */}

            <h2 className="mt-5 text-xl font-black tracking-[-0.03em] text-[#172033]">
              Hapus karyawan?
            </h2>

            {/* DESCRIPTION */}

            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Data{" "}
              <span className="font-black text-[#172033]">
                {deleteTarget.name}
              </span>{" "}
              akan dihapus dari sistem.
            </p>

            {/* RFID WARNING */}

            {deleteTarget.rfidUid && (
              <div className="mt-4 rounded-2xl border border-[#fde7b2] bg-[#fff7e5] p-4">
                <div className="flex items-start gap-3">
                  <CircleAlert
                    size={17}
                    className="mt-0.5 shrink-0 text-[#f59e0b]"
                  />

                  <p className="text-xs font-bold leading-5 text-[#9a6700]">
                    Kartu RFID{" "}
                    <span className="font-mono">{deleteTarget.rfidUid}</span>{" "}
                    yang terhubung dengan karyawan ini juga akan dilepas.
                  </p>
                </div>
              </div>
            )}

            {/* ACTIONS */}

            <div className="mt-6 grid grid-cols-2 gap-3">
              {/* CANCEL */}

              <button
                type="button"
                disabled={deleting}
                onClick={closeDeleteConfirmation}
                className="flex h-12 items-center justify-center rounded-2xl border border-[#dce6f1] bg-white text-sm font-bold text-[#64748b] transition hover:bg-[#f7fafd] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>

              {/* DELETE */}

              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ef4444] text-sm font-bold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? (
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

      {/* ===================================================== */}
      {/* TOAST */}
      {/* ===================================================== */}

      {toast && (
        <div className="fixed right-4 top-4 z-[150] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6">
          <div
            className={[
              "flex items-start gap-3 rounded-[18px] border bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)]",

              toast.type === "success"
                ? "border-[#cfeedd]"
                : "border-[#ffd5d5]",
            ].join(" ")}
          >
            <div
              className={[
                "flex size-9 shrink-0 items-center justify-center rounded-xl",

                toast.type === "success"
                  ? "bg-[#e9f9f1] text-[#10b981]"
                  : "bg-[#fff0f0] text-[#ef4444]",
              ].join(" ")}
            >
              {toast.type === "success" ? (
                <CircleCheck size={17} />
              ) : (
                <CircleAlert size={17} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[#172033]">
                {toast.type === "success" ? "Berhasil" : "Terjadi kesalahan"}
              </p>

              <p className="mt-1 text-xs font-semibold leading-5 text-[#64748b]">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#334155]"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
