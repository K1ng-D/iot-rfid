"use client";

import {
  BadgeCheck,
  CreditCard,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { Employee } from "@/types/rfid";

interface EmployeeForm {
  name: string;

  department: string;

  position: string;

  status: "active" | "inactive";
}

const emptyForm: EmployeeForm = {
  name: "",

  department: "",

  position: "",

  status: "active",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [form, setForm] = useState<EmployeeForm>(emptyForm);

  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees", {
        cache: "no-store",
      });

      const data = await response.json();

      setEmployees(data.employees ?? []);
    } catch {
      setError("Gagal mengambil data karyawan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return employees;
    }

    return employees.filter((employee) => {
      return [
        employee.name,
        employee.employeeCode,
        employee.department,
        employee.position,
        employee.rfidUid ?? "",
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [employees, search]);

  function openCreate() {
    setEditingEmployee(null);

    setForm(emptyForm);

    setError("");

    setModalOpen(true);
  }

  function openEdit(employee: Employee) {
    setEditingEmployee(employee);

    setForm({
      name: employee.name,

      department: employee.department,

      position: employee.position,

      status: employee.status,
    });

    setError("");

    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError("");

    if (form.name.trim().length < 2) {
      setError("Nama karyawan minimal 2 karakter.");

      return;
    }

    setSaving(true);

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

        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menyimpan data.");
      }

      setModalOpen(false);

      setEditingEmployee(null);

      setForm(emptyForm);

      await loadEmployees();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menyimpan data.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmployee(employee: Employee) {
    const confirmed = window.confirm(
      `Hapus ${employee.name}?\n\nKartu RFID yang terhubung juga akan dilepas.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menghapus.");
      }

      await loadEmployees();
    } catch (deleteError) {
      window.alert(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus karyawan.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            Kelola identitas karyawan dan hubungan kartu RFID.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5"
        >
          <Plus size={17} />
          Tambah Karyawan
        </button>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
          <Users size={18} className="text-slate-400" />

          <p className="mt-5 text-3xl font-black tracking-[-0.04em]">
            {employees.length}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            Total karyawan
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
          <BadgeCheck size={18} className="text-emerald-500" />

          <p className="mt-5 text-3xl font-black tracking-[-0.04em]">
            {employees.filter((item) => Boolean(item.rfidUid)).length}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            RFID terdaftar
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
          <CreditCard size={18} className="text-amber-500" />

          <p className="mt-5 text-3xl font-black tracking-[-0.04em]">
            {employees.filter((item) => !item.rfidUid).length}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            Menunggu kartu
          </p>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-black tracking-[-0.025em]">
              Daftar Karyawan
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              {filteredEmployees.length} data ditemukan
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari karyawan..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Karyawan
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Department
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  RFID
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Status
                </th>

                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.map((employee) => (
                <tr
                  key={employee.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                        <UserRound size={17} />
                      </div>

                      <div>
                        <p className="text-sm font-black text-slate-850">
                          {employee.name}
                        </p>

                        <p className="mt-1 text-[11px] font-bold text-slate-400">
                          {employee.employeeCode}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-slate-700">
                      {employee.department || "-"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {employee.position || "-"}
                    </p>
                  </td>

                  <td className="px-6 py-5">
                    {employee.rfidUid ? (
                      <span className="inline-flex rounded-xl bg-emerald-50 px-3 py-2 font-mono text-xs font-bold text-emerald-700">
                        {employee.rfidUid}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                        Belum terdaftar
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-5">
                    <span
                      className={[
                        "inline-flex rounded-full px-3 py-1.5 text-[11px] font-black",
                        employee.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      {employee.status === "active" ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(employee)}
                        className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        onClick={() => void deleteEmployee(employee)}
                        className="flex size-9 items-center justify-center rounded-xl border border-rose-100 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
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

        <div className="divide-y divide-slate-100 lg:hidden">
          {filteredEmployees.map((employee) => (
            <article key={employee.id} className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                  <UserRound size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{employee.name}</p>

                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    {employee.employeeCode}
                  </p>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(employee)}
                    className="flex size-9 items-center justify-center rounded-xl bg-slate-100"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => void deleteEmployee(employee)}
                    className="flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Posisi
                  </p>

                  <p className="mt-1 text-xs font-bold">
                    {employee.position || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    RFID
                  </p>

                  <p className="mt-1 truncate font-mono text-xs font-bold">
                    {employee.rfidUid || "Belum"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!loading && filteredEmployees.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <Users size={32} className="text-slate-300" />

            <p className="mt-4 font-black">Belum ada karyawan</p>

            <p className="mt-1 text-sm text-slate-400">
              Tambahkan data karyawan pertama.
            </p>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="w-full max-w-lg rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Employee
                </p>

                <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">
                  {editingEmployee ? "Edit Karyawan" : "Tambah Karyawan"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex size-10 items-center justify-center rounded-2xl bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-600">
                  Nama Karyawan
                </span>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                  placeholder="Masukkan nama lengkap"
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-slate-400"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-600">
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
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-600">
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
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-600">
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
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-slate-400"
                >
                  <option value="active">Aktif</option>

                  <option value="inactive">Nonaktif</option>
                </select>
              </label>

              {error && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-12 flex-1 rounded-2xl border border-slate-200 text-sm font-bold"
                >
                  Batal
                </button>

                <button
                  disabled={saving}
                  className="h-12 flex-1 rounded-2xl bg-slate-950 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Menyimpan..."
                    : editingEmployee
                      ? "Simpan"
                      : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
