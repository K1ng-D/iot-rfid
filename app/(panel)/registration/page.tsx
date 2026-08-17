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

import type { Employee, RegistrationSession, RfidDevice } from "@/types/rfid";

const READER_DOCUMENT = "registration-reader";

const READER_ONLINE_THRESHOLD = 130_000;

// ============================================================
// HELPERS
// ============================================================

function isReaderOnline(device: RfidDevice | null) {
  if (!device?.lastSeenAt) {
    return false;
  }

  const lastSeen = new Date(device.lastSeenAt).getTime();

  if (Number.isNaN(lastSeen)) {
    return false;
  }

  return Date.now() - lastSeen < READER_ONLINE_THRESHOLD;
}

function formatLastSeen(value: string | null) {
  if (!value) {
    return "Belum terhubung";
  }

  const lastSeen = new Date(value).getTime();

  if (Number.isNaN(lastSeen)) {
    return "Tidak diketahui";
  }

  const difference = Math.max(0, Date.now() - lastSeen);

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

  return `${hours} jam lalu`;
}

function getWifiLabel(value: number | null) {
  if (value === null) {
    return "-";
  }

  if (value >= -55) {
    return "Sangat baik";
  }

  if (value >= -67) {
    return "Baik";
  }

  if (value >= -75) {
    return "Cukup";
  }

  return "Lemah";
}

// ============================================================
// PAGE
// ============================================================

export default function RegistrationPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [session, setSession] = useState<RegistrationSession | null>(null);

  const [reader, setReader] = useState<RfidDevice | null>(null);

  const [loading, setLoading] = useState(true);

  const [starting, setStarting] = useState(false);

  const [cancelling, setCancelling] = useState(false);

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

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil data karyawan.");
      }

      setEmployees(Array.isArray(data.employees) ? data.employees : []);
    } catch (fetchError) {
      console.error("[REGISTRATION EMPLOYEES]", fetchError);
    }
  }, []);

  // ==========================================================
  // READER
  // ==========================================================

  const loadReader = useCallback(async () => {
    try {
      const response = await fetch("/api/devices", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil status perangkat.");
      }

      const devices: RfidDevice[] = Array.isArray(data.devices)
        ? data.devices
        : [];

      const registrationReader =
        devices.find((device) => device.id === READER_DOCUMENT) ??
        devices.find((device) =>
          device.type?.toLowerCase().includes("registration"),
        ) ??
        null;

      setReader(registrationReader);
    } catch (fetchError) {
      console.error("[REGISTRATION READER]", fetchError);

      setReader(null);
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

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal membaca sesi registrasi.");
      }

      if (data.session) {
        setSession(data.session);

        setSelectedEmployeeId(data.session.employeeId);
      } else {
        setSession(null);
      }
    } catch (fetchError) {
      console.error("[ACTIVE SESSION]", fetchError);
    }
  }, []);

  // ==========================================================
  // INITIAL DATA
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      await Promise.allSettled([
        loadEmployees(),
        loadActiveSession(),
        loadReader(),
      ]);

      if (mounted) {
        setLoading(false);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [loadEmployees, loadActiveSession, loadReader]);

  // ==========================================================
  // READER POLLING
  // ==========================================================

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadReader();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadReader]);

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

        if (!response.ok) {
          throw new Error(data.message ?? "Gagal membaca status registrasi.");
        }

        if (!data.session) {
          return;
        }

        setSession(data.session);

        if (data.session.status === "completed") {
          setError("");

          void loadEmployees();
        }
      } catch (pollError) {
        console.error("[REGISTRATION POLLING]", pollError);
      }
    }, 1200);

    return () => window.clearInterval(interval);
  }, [session?.id, session?.status, loadEmployees]);

  // ==========================================================
  // EMPLOYEE DATA
  // ==========================================================

  const availableEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => employee.status === "active" && !employee.rfidUid,
      ),
    [employees],
  );

  const selectedEmployee = useMemo(
    () =>
      employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  // ==========================================================
  // READER STATE
  // ==========================================================

  const readerOnline = isReaderOnline(reader);

  const canStartRegistration =
    Boolean(selectedEmployeeId) &&
    Boolean(selectedEmployee) &&
    !selectedEmployee?.rfidUid &&
    readerOnline &&
    !starting;

  // ==========================================================
  // START
  // ==========================================================

  async function startRegistration() {
    if (!selectedEmployeeId) {
      setError("Pilih karyawan terlebih dahulu.");

      return;
    }

    if (!selectedEmployee) {
      setError("Data karyawan tidak ditemukan.");

      return;
    }

    if (selectedEmployee.rfidUid) {
      setError("Karyawan ini sudah memiliki kartu RFID.");

      return;
    }

    if (!readerOnline) {
      setError(
        "Registration Reader sedang offline. Pastikan perangkat ESP32 terhubung sebelum memulai registrasi.",
      );

      return;
    }

    if (starting) {
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

      if (!data.sessionId) {
        throw new Error("Session ID registrasi tidak ditemukan.");
      }

      const sessionResponse = await fetch(
        `/api/registration/session/${data.sessionId}`,
        {
          cache: "no-store",
        },
      );

      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok) {
        throw new Error(
          sessionData.message ?? "Gagal membaca sesi registrasi.",
        );
      }

      if (!sessionData.session) {
        throw new Error("Sesi registrasi tidak ditemukan.");
      }

      setSession(sessionData.session);
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
    if (!session?.id || cancelling) {
      return;
    }

    setCancelling(true);

    setError("");

    try {
      const response = await fetch("/api/registration/cancel", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          sessionId: session.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal membatalkan registrasi.");
      }

      setSession(null);

      setSelectedEmployeeId("");

      await loadEmployees();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Gagal membatalkan registrasi.",
      );
    } finally {
      setCancelling(false);
    }
  }

  // ==========================================================
  // RESET
  // ==========================================================

  function resetRegistration() {
    setSession(null);

    setSelectedEmployeeId("");

    setError("");

    void Promise.allSettled([loadEmployees(), loadReader()]);
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#eaf4ff] text-[#007BFF]">
            <LoaderCircle size={22} className="animate-spin" />
          </div>

          <p className="mt-4 text-xs font-bold text-[#8291a4]">
            Menyiapkan registrasi...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
          Hubungkan kartu RFID dengan karyawan agar kartu dapat digunakan untuk
          melakukan absensi.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        {/* =================================================== */}
        {/* LEFT */}
        {/* =================================================== */}

        <section className="rounded-[30px] border border-[#dce6f1] bg-white p-6 shadow-[0_12px_40px_rgba(30,64,100,0.04)] sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
            <UserRound size={20} />
          </div>

          <p className="mt-7 text-[10px] font-black uppercase tracking-[0.15em] text-[#8291a4]">
            Step 01
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#172033]">
            Pilih karyawan
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            Pilih karyawan aktif yang belum memiliki kartu RFID.
          </p>

          {/* ================================================= */}
          {/* EMPLOYEE SELECT */}
          {/* ================================================= */}

          <label className="mt-7 block">
            <span className="mb-2 block text-xs font-black text-[#52657a]">
              Karyawan
            </span>

            <select
              disabled={session?.status === "waiting"}
              value={selectedEmployeeId}
              onChange={(event) => {
                setSelectedEmployeeId(event.target.value);

                setError("");
              }}
              className="h-14 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-bold text-[#172033] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10 disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
            >
              <option value="">Pilih karyawan</option>

              {availableEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} — {employee.employeeCode}
                </option>
              ))}
            </select>
          </label>

          {/* ================================================= */}
          {/* SELECTED EMPLOYEE */}
          {/* ================================================= */}

          {selectedEmployee && (
            <div className="mt-4 rounded-[22px] border border-[#edf2f7] bg-[#f7fafd] p-5">
              <div className="flex items-center gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
                  <UserRound size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-[#172033]">
                    {selectedEmployee.name}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-[#8291a4]">
                    {selectedEmployee.employeeCode} ·{" "}
                    {selectedEmployee.department || "Tanpa departemen"}
                  </p>

                  {selectedEmployee.position && (
                    <p className="mt-1 text-[11px] font-semibold text-[#94a3b8]">
                      {selectedEmployee.position}
                    </p>
                  )}
                </div>

                <span className="shrink-0 rounded-full bg-[#e9f9f1] px-3 py-1.5 text-[9px] font-black text-[#07875f]">
                  SIAP
                </span>
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* READER STATUS */}
          {/* ================================================= */}

          <div
            className={[
              "mt-5 rounded-[22px] border p-5 transition",
              readerOnline
                ? "border-[#cfeedd] bg-[#f4fcf8]"
                : "border-[#fde2e2] bg-[#fff7f7]",
            ].join(" ")}
          >
            <div className="flex items-center gap-4">
              <div
                className={[
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                  readerOnline
                    ? "bg-[#e9f9f1] text-[#10b981]"
                    : "bg-[#fff0f0] text-[#ef4444]",
                ].join(" ")}
              >
                <Radio size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-[#172033]">
                    Registration Reader
                  </p>

                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black",
                      readerOnline
                        ? "bg-[#e9f9f1] text-[#07875f]"
                        : "bg-[#fff0f0] text-[#d92d20]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "size-1.5 rounded-full",
                        readerOnline ? "bg-[#10b981]" : "bg-[#ef4444]",
                      ].join(" ")}
                    />

                    {readerOnline ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>

                <p className="mt-1 text-xs font-semibold text-[#8291a4]">
                  {reader
                    ? `${formatLastSeen(reader.lastSeenAt)} · WiFi ${getWifiLabel(
                        reader.wifiRssi,
                      )}`
                    : "Perangkat belum terdeteksi oleh sistem"}
                </p>
              </div>


            </div>
          </div>

          {/* ================================================= */}
          {/* ERROR */}
          {/* ================================================= */}

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#ffd5d5] bg-[#fff0f0] p-4 text-sm font-semibold text-[#d92d20]">
              <CircleAlert size={18} className="mt-0.5 shrink-0" />

              <p className="leading-5">{error}</p>
            </div>
          )}

          {/* ================================================= */}
          {/* START */}
          {/* ================================================= */}

          {!session && (
            <>
              <button
                type="button"
                disabled={!canStartRegistration}
                onClick={() => void startRegistration()}
                className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#007BFF] px-5 text-sm font-black text-white shadow-lg shadow-[#007BFF]/20 transition hover:-translate-y-0.5 hover:bg-[#087de4] disabled:cursor-not-allowed disabled:bg-[#a8ccef] disabled:text-white disabled:shadow-none disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {starting ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <ScanLine size={17} />
                )}

                {starting ? "Memulai..." : "Mulai Registrasi"}
              </button>

              {!readerOnline && (
                <p className="mt-3 text-center text-[11px] font-semibold leading-5 text-[#94a3b8]">
                  Registrasi hanya dapat dimulai ketika Registration Reader
                  sedang online.
                </p>
              )}
            </>
          )}

          {/* ================================================= */}
          {/* CANCEL */}
          {/* ================================================= */}

          {session?.status === "waiting" && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => void cancelRegistration()}
              className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-[#ffd5d5] bg-[#fff0f0] text-sm font-black text-[#d92d20] transition hover:bg-[#ffe5e5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelling ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <X size={17} />
              )}

              {cancelling ? "Membatalkan..." : "Batalkan Registrasi"}
            </button>
          )}
        </section>

        {/* =================================================== */}
        {/* RIGHT */}
        {/* =================================================== */}

        <section className="relative flex min-h-[520px] overflow-hidden rounded-[30px] bg-[#0d2f53] p-7 text-white shadow-[0_18px_50px_rgba(13,47,83,0.12)] sm:p-10">
          <div className="absolute -right-32 -top-32 size-96 rounded-full bg-[#007BFF]/10 blur-3xl" />

          <div className="absolute -bottom-32 -left-32 size-96 rounded-full bg-[#10b981]/10 blur-3xl" />

          {/* ================================================= */}
          {/* IDLE */}
          {/* ================================================= */}

          {!session && (
            <div className="relative z-10 m-auto flex max-w-sm flex-col items-center text-center">
              <div className="flex size-24 items-center justify-center rounded-[30px] border border-[#315474] bg-[#12385d]">
                <CreditCard
                  size={38}
                  strokeWidth={1.5}
                  className="text-[#007BFF]"
                />
              </div>

              <div
                className={[
                  "mt-7 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-black tracking-[0.08em]",
                  readerOnline
                    ? "bg-[#10b981]/10 text-[#6ee7b7]"
                    : "bg-[#ef4444]/10 text-[#fda4af]",
                ].join(" ")}
              >
                <span
                  className={[
                    "size-1.5 rounded-full",
                    readerOnline ? "bg-[#10b981]" : "bg-[#ef4444]",
                  ].join(" ")}
                />
                READER {readerOnline ? "ONLINE" : "OFFLINE"}
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[#7f9fba]">
                RFID Registration
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                Siap untuk registrasi
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#9bb3c8]">
                {readerOnline
                  ? "Pilih karyawan kemudian mulai sesi registrasi."
                  : "Hubungkan Registration Reader terlebih dahulu untuk memulai registrasi."}
              </p>
            </div>
          )}

          {/* ================================================= */}
          {/* WAITING */}
          {/* ================================================= */}

          {session?.status === "waiting" && (
            <div className="relative z-10 m-auto flex w-full max-w-md flex-col items-center text-center">
              <div className="relative flex size-56 items-center justify-center">
                <div className="scan-ring absolute size-36 rounded-full border border-[#4aa5ff]/50" />

                <div className="scan-ring scan-ring-delay-1 absolute size-36 rounded-full border border-[#4aa5ff]/40" />

                <div className="scan-ring scan-ring-delay-2 absolute size-36 rounded-full border border-[#4aa5ff]/30" />

                <div className="scan-float relative z-10 flex size-24 items-center justify-center rounded-[30px] bg-[#007BFF] text-white shadow-2xl shadow-[#007BFF]/25">
                  <Radio size={37} strokeWidth={1.8} />
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#007BFF]/15 px-4 py-2 text-[11px] font-black text-[#80bdff]">
                <span className="size-2 animate-pulse rounded-full bg-[#168cf5]" />
                MENUNGGU KARTU
              </div>

              <h2 className="mt-6 text-3xl font-black tracking-[-0.045em]">
                Tempelkan kartu RFID
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#9bb3c8]">
                Registration Reader sedang menunggu kartu yang akan didaftarkan
                untuk
              </p>

              <p className="mt-2 text-base font-black text-white">
                {session.employeeName}
              </p>

              {!readerOnline && (
                <div className="mt-6 flex max-w-sm items-start gap-3 rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/10 p-4 text-left">
                  <CircleAlert
                    size={17}
                    className="mt-0.5 shrink-0 text-[#fda4af]"
                  />

                  <p className="text-xs font-semibold leading-5 text-[#fecdd3]">
                    Reader kehilangan koneksi. Sesi tetap aktif dan akan
                    melanjutkan proses ketika perangkat kembali online.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ================================================= */}
          {/* COMPLETED */}
          {/* ================================================= */}

          {session?.status === "completed" && (
            <div className="relative z-10 m-auto flex max-w-md flex-col items-center text-center">
              <div className="flex size-24 items-center justify-center rounded-full bg-[#10b981] text-white shadow-2xl shadow-[#10b981]/20">
                <Check size={40} strokeWidth={3} />
              </div>

              <div className="mt-6 rounded-full bg-[#10b981]/10 px-4 py-2 text-[11px] font-black text-[#6ee7b7]">
                REGISTRATION SUCCESS
              </div>

              <h2 className="mt-6 text-3xl font-black tracking-[-0.045em]">
                RFID berhasil terdaftar
              </h2>

              <p className="mt-3 text-sm text-[#9bb3c8]">
                Kartu berhasil dipasangkan dengan
              </p>

              <p className="mt-1 font-black text-white">
                {session.employeeName}
              </p>

              <div className="mt-7 min-w-[230px] rounded-2xl border border-[#315474] bg-[#12385d] px-6 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7f9fba]">
                  RFID UID
                </p>

                <p className="mt-2 break-all font-mono text-xl font-black tracking-wider text-[#6ee7b7]">
                  {session.uid || "-"}
                </p>
              </div>

              <button
                type="button"
                onClick={resetRegistration}
                className="mt-8 flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-black text-[#0d2f53] transition hover:bg-[#eaf4ff]"
              >
                <RotateCcw size={16} />
                Registrasi Berikutnya
              </button>
            </div>
          )}

          {/* ================================================= */}
          {/* CANCELLED / FAILED */}
          {/* ================================================= */}

          {session && ["cancelled", "failed"].includes(session.status) && (
            <div className="relative z-10 m-auto flex max-w-sm flex-col items-center text-center">
              <div className="flex size-20 items-center justify-center rounded-[26px] bg-[#ef4444]/10 text-[#fda4af]">
                <CircleAlert size={34} />
              </div>

              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.16em] text-[#fda4af]">
                REGISTRATION STOPPED
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Registrasi dihentikan
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#9bb3c8]">
                Sesi registrasi tidak dilanjutkan. Kamu dapat memulai sesi baru
                kapan saja.
              </p>

              <button
                type="button"
                onClick={resetRegistration}
                className="mt-7 flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-[#0d2f53] transition hover:bg-[#eaf4ff]"
              >
                <RotateCcw size={15} />
                Kembali
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
