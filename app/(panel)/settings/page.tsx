"use client";

import {
  AlarmClock,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Timer,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AttendanceSettings } from "@/types/rfid";

// ============================================================
// DEFAULT
// ============================================================

const DEFAULT_SETTINGS: AttendanceSettings = {
  checkInOpen: "06:00",

  workStart: "09:00",

  lateStart: "09:16",

  checkInClose: "12:00",

  checkOutOpen: "15:00",

  normalCheckOut: "17:00",

  minimumWorkDurationMinutes: 300,

  timezone: "Asia/Jakarta",

  updatedAt: null,
};

// ============================================================
// TYPES
// ============================================================

interface SettingsResponse {
  success?: boolean;

  settings?: AttendanceSettings;

  message?: string;
}

interface ToastState {
  type: "success" | "error";

  message: string;
}

// ============================================================
// HELPERS
// ============================================================

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  const hours = Math.floor(safeMinutes / 60);

  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} menit`;
  }

  if (remainingMinutes === 0) {
    return `${hours} jam`;
  }

  return `${hours} jam ${remainingMinutes} menit`;
}

// ============================================================

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "Belum pernah disimpan";
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
// PAGE
// ============================================================

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<AttendanceSettings>(DEFAULT_SETTINGS);

  const [savedSettings, setSavedSettings] =
    useState<AttendanceSettings>(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [formError, setFormError] = useState("");

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

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [toast]);

  // ==========================================================
  // LOAD
  // ==========================================================

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/attendance", {
        cache: "no-store",
      });

      const data = (await response.json()) as SettingsResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil pengaturan.");
      }

      const nextSettings = data.settings ?? DEFAULT_SETTINGS;

      setSettings(nextSettings);

      setSavedSettings(nextSettings);

      setLoadError("");
    } catch (error) {
      console.error("[SETTINGS]", error);

      setLoadError(
        error instanceof Error ? error.message : "Gagal mengambil pengaturan.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // ==========================================================
  // DIRTY
  // ==========================================================

  const hasChanges = useMemo(
    () =>
      JSON.stringify({
        ...settings,

        updatedAt: null,
      }) !==
      JSON.stringify({
        ...savedSettings,

        updatedAt: null,
      }),
    [settings, savedSettings],
  );

  // ==========================================================
  // UPDATE TIME
  // ==========================================================

  function updateTime(
    key:
      | "checkInOpen"
      | "workStart"
      | "lateStart"
      | "checkInClose"
      | "checkOutOpen"
      | "normalCheckOut",
    value: string,
  ) {
    setSettings((current) => ({
      ...current,

      [key]: value,
    }));

    setFormError("");
  }

  // ==========================================================
  // MINIMUM WORK
  // ==========================================================

  function changeMinimumWork(difference: number) {
    setSettings((current) => {
      const next = current.minimumWorkDurationMinutes + difference;

      return {
        ...current,

        minimumWorkDurationMinutes: Math.min(720, Math.max(60, next)),
      };
    });

    setFormError("");
  }

  // ==========================================================
  // SAVE
  // ==========================================================

  async function saveSettings() {
    if (saving) {
      return;
    }

    setSaving(true);

    setFormError("");

    try {
      const response = await fetch("/api/settings/attendance", {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",

          Accept: "application/json",
        },

        body: JSON.stringify({
          checkInOpen: settings.checkInOpen,

          workStart: settings.workStart,

          lateStart: settings.lateStart,

          checkInClose: settings.checkInClose,

          checkOutOpen: settings.checkOutOpen,

          normalCheckOut: settings.normalCheckOut,

          minimumWorkDurationMinutes: settings.minimumWorkDurationMinutes,
        }),
      });

      const data = (await response.json()) as SettingsResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menyimpan pengaturan.");
      }

      await loadSettings();

      showToast(
        "success",

        data.message ?? "Pengaturan absensi berhasil disimpan.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menyimpan pengaturan.";

      setFormError(message);

      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // RESET FORM
  // ==========================================================

  function resetChanges() {
    setSettings(savedSettings);

    setFormError("");
  }

  // ==========================================================
  // RESET DEFAULT
  // ==========================================================

  function resetDefault() {
    setSettings({
      ...DEFAULT_SETTINGS,

      updatedAt: savedSettings.updatedAt,
    });

    setFormError("");
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
            Memuat pengaturan...
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
      <div className="mx-auto max-w-[1300px]">
        {/* =================================================== */}
        {/* INTRO */}
        {/* =================================================== */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
              Atur kebijakan waktu check-in, keterlambatan, check-out, dan
              minimum durasi kerja.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[#94a3b8]">
                Zona waktu: Asia/Jakarta
              </p>

              <span className="size-1 rounded-full bg-[#cbd5e1]" />

              <p className="text-xs font-semibold text-[#94a3b8]">
                Terakhir diperbarui {formatUpdatedAt(savedSettings.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {hasChanges && (
              <button
                type="button"
                disabled={saving}
                onClick={resetChanges}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#dce6f1] bg-white px-4 text-xs font-black text-[#64748b] transition hover:bg-[#f7fafd]"
              >
                <RotateCcw size={14} />
                Batalkan
              </button>
            )}

            <button
              type="button"
              disabled={saving || !hasChanges}
              onClick={() => void saveSettings()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#007BFF] px-5 text-xs font-black text-white shadow-lg shadow-[#007BFF]/20 transition hover:bg-[#006ee6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}

              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
          </div>
        </div>

        {/* =================================================== */}
        {/* UNSAVED */}
        {/* =================================================== */}

        {hasChanges && (
          <div className="mt-5 flex items-center gap-3 rounded-[18px] border border-[#cfe0ff] bg-[#f4f8ff] px-4 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#007BFF] text-white">
              <CircleAlert size={15} />
            </div>

            <p className="text-xs font-bold text-[#175cd3]">
              Ada perubahan yang belum disimpan.
            </p>
          </div>
        )}

        {/* =================================================== */}
        {/* ERROR */}
        {/* =================================================== */}

        {loadError && (
          <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-[#ffd5d5] bg-[#fff0f0] p-4">
            <CircleAlert size={18} className="mt-0.5 text-[#ef4444]" />

            <div>
              <p className="text-sm font-black text-[#b42318]">
                Gagal memuat pengaturan
              </p>

              <p className="mt-1 text-xs font-semibold text-[#d92d20]">
                {loadError}
              </p>
            </div>
          </div>
        )}

        {formError && (
          <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-[#f8e4b4] bg-[#fff7e5] p-4">
            <CircleAlert size={18} className="mt-0.5 text-[#f59e0b]" />

            <p className="text-xs font-bold leading-5 text-[#9a6700]">
              {formError}
            </p>
          </div>
        )}

        {/* =================================================== */}
        {/* SUMMARY */}
        {/* =================================================== */}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={AlarmClock}
            label="Jam Kerja"
            value={settings.workStart}
            description="Waktu kerja normal dimulai"
          />

          <SummaryCard
            icon={Clock3}
            label="Mulai Terlambat"
            value={settings.lateStart}
            description="Setelah batas tepat waktu"
          />

          <SummaryCard
            icon={BadgeCheck}
            label="Pulang Normal"
            value={settings.normalCheckOut}
            description="Mulai dianggap checkout normal"
          />

          <SummaryCard
            icon={Timer}
            label="Minimum Kerja"
            value={formatDuration(settings.minimumWorkDurationMinutes)}
            description="Syarat durasi check-out"
          />
        </div>

        {/* =================================================== */}
        {/* SETTINGS */}
        {/* =================================================== */}

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#dce6f1] bg-white shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
          {/* HEADER */}

          <div className="border-b border-[#edf2f7] p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
                <Settings2 size={19} />
              </div>

              <div>
                <h2 className="font-black text-[#172033]">Aturan Kehadiran</h2>

                <p className="mt-1 text-xs text-[#8291a4]">
                  Klik pada waktu yang ingin diubah.
                </p>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* CHECK IN */}
          {/* ================================================= */}

          <div className="p-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
                Check-in
              </p>

              <p className="mt-1 text-xs text-[#94a3b8]">
                Atur rentang waktu kehadiran masuk karyawan.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TimeField
                label="Check-in Dibuka"
                description="Scan pertama dapat diterima mulai waktu ini."
                value={settings.checkInOpen}
                onChange={(value) => updateTime("checkInOpen", value)}
              />

              <TimeField
                label="Jam Kerja Mulai"
                description="Patokan dimulainya jam kerja normal."
                value={settings.workStart}
                onChange={(value) => updateTime("workStart", value)}
              />

              <TimeField
                label="Terlambat Mulai"
                description="Scan mulai waktu ini dikategorikan terlambat."
                value={settings.lateStart}
                onChange={(value) => updateTime("lateStart", value)}
              />

              <TimeField
                label="Check-in Ditutup"
                description="Setelah waktu ini check-in tidak diterima."
                value={settings.checkInClose}
                onChange={(value) => updateTime("checkInClose", value)}
              />
            </div>
          </div>

          {/* ================================================= */}
          {/* CHECKOUT */}
          {/* ================================================= */}

          <div className="border-t border-[#edf2f7] p-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
                Check-out
              </p>

              <p className="mt-1 text-xs text-[#94a3b8]">
                Atur syarat dan batas waktu absensi pulang.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TimeField
                label="Check-out Dibuka"
                description="Checkout paling awal dapat dilakukan pada waktu ini."
                value={settings.checkOutOpen}
                onChange={(value) => updateTime("checkOutOpen", value)}
              />

              <TimeField
                label="Pulang Normal"
                description="Checkout mulai waktu ini dianggap pulang normal."
                value={settings.normalCheckOut}
                onChange={(value) => updateTime("normalCheckOut", value)}
              />

              {/* ============================================= */}
              {/* MINIMUM WORK */}
              {/* ============================================= */}

              <div className="rounded-[22px] border border-[#dce6f1] bg-[#f7fafd] p-5 transition hover:border-[#b9d7f6] md:col-span-2">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-xl bg-[#eaf4ff] text-[#007BFF]">
                        <Timer size={14} />
                      </div>

                      <p className="text-sm font-black text-[#172033]">
                        Minimum Durasi Kerja
                      </p>
                    </div>

                    <p className="mt-2 max-w-md text-xs leading-5 text-[#8291a4]">
                      Karyawan harus memenuhi durasi ini sebelum diperbolehkan
                      melakukan check-out.
                    </p>
                  </div>

                  {/* STEPPER */}

                  <div className="flex items-center rounded-2xl border border-[#cbdced] bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      aria-label="Kurangi durasi"
                      onClick={() => changeMinimumWork(-30)}
                      disabled={settings.minimumWorkDurationMinutes <= 60}
                      className="flex size-10 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#eaf4ff] hover:text-[#007BFF] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus size={16} />
                    </button>

                    <div className="min-w-32 px-3 text-center">
                      <p className="text-sm font-black text-[#172033]">
                        {formatDuration(settings.minimumWorkDurationMinutes)}
                      </p>

                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">
                        {settings.minimumWorkDurationMinutes} menit
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label="Tambah durasi"
                      onClick={() => changeMinimumWork(30)}
                      disabled={settings.minimumWorkDurationMinutes >= 720}
                      className="flex size-10 items-center justify-center rounded-xl bg-[#007BFF] text-white transition hover:bg-[#006ee6] disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* DEFAULT */}
          {/* ================================================= */}

          <div className="flex flex-col gap-4 border-t border-[#edf2f7] bg-[#f7fafd] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-[#334155]">
                Kembalikan aturan standar
              </p>

              <p className="mt-1 text-[11px] text-[#8291a4]">
                06:00 · 09:00 · 09:16 · 12:00 · 15:00 · 17:00 · 5 jam
              </p>
            </div>

            <button
              type="button"
              onClick={resetDefault}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#cbdced] bg-white px-4 text-xs font-black text-[#52657a] shadow-sm transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
            >
              <RotateCcw size={14} />
              Gunakan Default
            </button>
          </div>
        </section>
      </div>

      {/* ===================================================== */}
      {/* TOAST */}
      {/* ===================================================== */}

      {toast && (
        <div className="fixed right-4 top-4 z-[150] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6">
          <div
            className={[
              "flex items-start gap-3 rounded-[18px] border bg-white p-4 shadow-xl",

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
                <Check size={17} />
              ) : (
                <CircleAlert size={17} />
              )}
            </div>

            <p className="min-w-0 flex-1 text-xs font-bold leading-5 text-[#52657a]">
              {toast.message}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// TIME FIELD
// ============================================================

function TimeField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;

  description: string;

  value: string;

  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.focus();

    try {
      input.showPicker();
    } catch {
      // Browser fallback:
      // input tetap mendapat focus.
    }
  }

  return (
    <div className="group rounded-[22px] border border-[#dce6f1] bg-[#f7fafd] p-5 transition hover:border-[#9cc9f7] hover:bg-[#f4f9ff]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* INFO */}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#eaf4ff] text-[#007BFF]">
              <Clock3 size={14} />
            </div>

            <p className="text-sm font-black text-[#172033]">{label}</p>
          </div>

          <p className="mt-2 max-w-sm text-xs leading-5 text-[#8291a4]">
            {description}
          </p>
        </div>

        {/* CLICKABLE TIME */}

        <button
          type="button"
          onClick={openPicker}
          className="flex w-full shrink-0 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#bfd8f0] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#007BFF] hover:shadow-[0_6px_20px_rgba(0,123,255,0.10)] focus:outline-none focus:ring-4 focus:ring-[#007BFF]/10 sm:w-[180px]"
        >
          <div>
            <p className="mt-1 text-lg font-black tracking-[-0.03em] text-[#172033]">
              {value}
            </p>
          </div>

          <ChevronRight
            size={18}
            className="text-[#94a3b8] transition group-hover:translate-x-0.5 group-hover:text-[#007BFF]"
          />
        </button>

        {/* REAL INPUT */}

        <input
          ref={inputRef}
          type="time"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Clock3;

  label: string;

  value: string;

  description: string;
}) {
  return (
    <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[#007BFF]">
        <Icon size={19} />
      </div>

      <p className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#101828]">
        {value}
      </p>

      <p className="mt-1 text-xs font-black text-[#52657a]">{label}</p>

      <p className="mt-1 text-[10px] font-semibold text-[#94a3b8]">
        {description}
      </p>
    </article>
  );
}

// ============================================================
// PAGE
// ============================================================
