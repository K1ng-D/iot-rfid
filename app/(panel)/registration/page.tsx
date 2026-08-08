"use client";

import {
  Check,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  Radio,
  RotateCcw,
  ScanLine,
  UserRound,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Employee, RegistrationSession } from "@/types/rfid";

export default function RegistrationPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [session, setSession] = useState<RegistrationSession | null>(null);

  const [loading, setLoading] = useState(true);

  const [starting, setStarting] = useState(false);

  const [error, setError] = useState("");

  // ==========================================================
  // EMPLOYEES
  // ==========================================================

  const loadEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees", {
        cache: "no-store",
      });

      const data = await response.json();

      setEmployees(data.employees ?? []);
    } catch (fetchError) {
      console.error("[REGISTRATION EMPLOYEES]", fetchError);
    }
  }, []);

  // ==========================================================
  // ACTIVE SESSION
  // ==========================================================

  const loadActiveSession = useCallback(async () => {
    try {
      const response = await fetch("/api/registration/active", {
        cache: "no-store",
      });

      const data = await response.json();

      if (data.session) {
        setSession(data.session);

        setSelectedEmployeeId(data.session.employeeId);
      }
    } catch (fetchError) {
      console.error("[ACTIVE SESSION]", fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // INITIAL DATA
  // ==========================================================

  useEffect(() => {
    void Promise.all([loadEmployees(), loadActiveSession()]);
  }, [loadEmployees, loadActiveSession]);

  // ==========================================================
  // SESSION POLLING
  // ==========================================================

  useEffect(() => {
    if (!session?.id || session.status !== "waiting") {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/registration/session/${session.id}`,
          {
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (data.session) {
          setSession(data.session);

          if (data.session.status === "completed") {
            void loadEmployees();
          }
        }
      } catch (pollError) {
        console.error("[REGISTRATION POLLING]", pollError);
      }
    }, 1200);

    return () => window.clearInterval(interval);
  }, [session?.id, session?.status, loadEmployees]);

  // ==========================================================
  // AVAILABLE EMPLOYEES
  // ==========================================================

  const availableEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => employee.status === "active" && !employee.rfidUid,
      ),
    [employees],
  );

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null;

  // ==========================================================
  // START
  // ==========================================================

  async function startRegistration() {
    if (!selectedEmployeeId) {
      setError("Pilih karyawan terlebih dahulu.");

      return;
    }

    setStarting(true);

    setError("");

    try {
      const response = await fetch("/api/registration/start", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          employeeId: selectedEmployeeId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal memulai registrasi.");
      }

      const sessionResponse = await fetch(
        `/api/registration/session/${data.sessionId}`,
        {
          cache: "no-store",
        },
      );

      const sessionData = await sessionResponse.json();

      setSession(sessionData.session ?? null);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Gagal memulai registrasi.",
      );
    } finally {
      setStarting(false);
    }
  }

  // ==========================================================
  // CANCEL
  // ==========================================================

  async function cancelRegistration() {
    if (!session?.id) {
      return;
    }

    try {
      await fetch("/api/registration/cancel", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          sessionId: session.id,
        }),
      });
    } finally {
      setSession(null);

      setError("");
    }
  }

  // ==========================================================
  // RESET
  // ==========================================================

  function resetRegistration() {
    setSession(null);

    setSelectedEmployeeId("");

    setError("");

    void loadEmployees();
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-slate-400" />
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        {/* LEFT */}

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <UserRound size={20} />
          </div>

          <p className="mt-7 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
            Step 01
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Pilih karyawan
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Pilih karyawan yang belum memiliki kartu RFID.
          </p>

          <label className="mt-7 block">
            <span className="mb-2 block text-xs font-black text-slate-600">
              Karyawan
            </span>

            <select
              disabled={session?.status === "waiting"}
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none transition focus:border-slate-400 disabled:bg-slate-50"
            >
              <option value="">Pilih karyawan</option>

              {availableEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} — {employee.employeeCode}
                </option>
              ))}
            </select>
          </label>

          {/* SELECTED EMPLOYEE */}

          {selectedEmployee && (
            <div className="mt-4 rounded-[22px] bg-slate-50 p-5">
              <div className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <UserRound size={18} />
                </div>

                <div>
                  <p className="font-black">{selectedEmployee.name}</p>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {selectedEmployee.employeeCode} ·{" "}
                    {selectedEmployee.department || "Tanpa departemen"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-600">
              <CircleAlert size={18} className="mt-0.5 shrink-0" />

              {error}
            </div>
          )}

          {/* START */}

          {!session && (
            <button
              disabled={!selectedEmployeeId || starting}
              onClick={() => void startRegistration()}
              className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              {starting ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <ScanLine size={17} />
              )}
              Mulai Registrasi
            </button>
          )}

          {/* CANCEL */}

          {session?.status === "waiting" && (
            <button
              onClick={() => void cancelRegistration()}
              className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-600"
            >
              <X size={17} />
              Batalkan Registrasi
            </button>
          )}
        </section>

        {/* RIGHT */}

        <section className="relative flex min-h-[520px] overflow-hidden rounded-[30px] bg-[#0b1220] p-7 text-white sm:p-10">
          <div className="absolute -right-32 -top-32 size-96 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="absolute -bottom-32 -left-32 size-96 rounded-full bg-emerald-500/10 blur-3xl" />

          {/* IDLE */}

          {!session && (
            <div className="relative z-10 m-auto flex max-w-sm flex-col items-center text-center">
              <div className="flex size-24 items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.05]">
                <CreditCard
                  size={38}
                  strokeWidth={1.5}
                  className="text-slate-400"
                />
              </div>

              <p className="mt-7 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                RFID Registration
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                Siap untuk registrasi
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Pilih karyawan kemudian mulai sesi registrasi.
              </p>
            </div>
          )}

          {/* WAITING */}

          {session?.status === "waiting" && (
            <div className="relative z-10 m-auto flex w-full max-w-md flex-col items-center text-center">
              <div className="relative flex size-56 items-center justify-center">
                <div className="scan-ring absolute size-36 rounded-full border border-blue-400/50" />

                <div className="scan-ring scan-ring-delay-1 absolute size-36 rounded-full border border-blue-400/40" />

                <div className="scan-ring scan-ring-delay-2 absolute size-36 rounded-full border border-blue-400/30" />

                <div className="scan-float relative z-10 flex size-24 items-center justify-center rounded-[30px] bg-white text-slate-950 shadow-2xl shadow-blue-500/20">
                  <Radio size={37} strokeWidth={1.8} />
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-400/10 px-4 py-2 text-[11px] font-black text-blue-300">
                <span className="size-2 animate-pulse rounded-full bg-blue-400" />
                WAITING FOR CARD
              </div>

              <h2 className="mt-6 text-3xl font-black tracking-[-0.045em]">
                Tempelkan kartu RFID
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Registration Reader sedang menunggu kartu untuk
              </p>

              <p className="mt-1 text-sm font-black text-white">
                {session.employeeName}
              </p>
            </div>
          )}

          {/* COMPLETED */}

          {session?.status === "completed" && (
            <div className="relative z-10 m-auto flex max-w-md flex-col items-center text-center">
              <div className="flex size-24 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-2xl shadow-emerald-400/20">
                <Check size={40} strokeWidth={3} />
              </div>

              <div className="mt-6 rounded-full bg-emerald-400/10 px-4 py-2 text-[11px] font-black text-emerald-400">
                REGISTRATION SUCCESS
              </div>

              <h2 className="mt-6 text-3xl font-black tracking-[-0.045em]">
                RFID berhasil terdaftar
              </h2>

              <p className="mt-3 text-sm text-slate-500">
                Kartu berhasil dipasangkan dengan
              </p>

              <p className="mt-1 font-black">{session.employeeName}</p>

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                  RFID UID
                </p>

                <p className="mt-2 font-mono text-xl font-black tracking-wider text-emerald-400">
                  {session.uid}
                </p>
              </div>

              <button
                onClick={resetRegistration}
                className="mt-8 flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-black text-slate-950"
              >
                <RotateCcw size={16} />
                Registrasi Berikutnya
              </button>
            </div>
          )}

          {/* CANCELLED / FAILED */}

          {session && ["cancelled", "failed"].includes(session.status) && (
            <div className="relative z-10 m-auto flex max-w-sm flex-col items-center text-center">
              <CircleAlert size={50} className="text-rose-400" />

              <h2 className="mt-5 text-2xl font-black">
                Registrasi dihentikan
              </h2>

              <button
                onClick={resetRegistration}
                className="mt-7 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
              >
                Kembali
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
