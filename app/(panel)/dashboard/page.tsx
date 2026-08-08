"use client";

import {
  Activity,
  BadgeCheck,
  Cpu,
  Radio,
  ScanLine,
  Users,
  Wifi,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Employee, RfidDevice, ScanLog } from "@/types/rfid";

// ============================================================
// HELPERS
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
  }).format(date);
}

function isDeviceOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) {
    return false;
  }

  const timestamp = new Date(lastSeenAt).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  /*
   * Heartbeat ESP32 setiap 60 detik.
   * Kita beri toleransi 130 detik.
   */
  return Date.now() - timestamp < 130_000;
}

function wifiLabel(rssi: number | null) {
  if (rssi === null) {
    return "Unknown";
  }

  if (rssi >= -55) {
    return "Excellent";
  }

  if (rssi >= -67) {
    return "Good";
  }

  if (rssi >= -75) {
    return "Fair";
  }

  return "Weak";
}

// ============================================================
// PAGE
// ============================================================

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [devices, setDevices] = useState<RfidDevice[]>([]);

  const [logs, setLogs] = useState<ScanLog[]>([]);

  const [loading, setLoading] = useState(true);

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData = useCallback(async () => {
    try {
      const [employeesResponse, devicesResponse, logsResponse] =
        await Promise.all([
          fetch("/api/employees", {
            cache: "no-store",
          }),

          fetch("/api/devices", {
            cache: "no-store",
          }),

          fetch("/api/logs", {
            cache: "no-store",
          }),
        ]);

      const [employeesJson, devicesJson, logsJson] = await Promise.all([
        employeesResponse.json(),
        devicesResponse.json(),
        logsResponse.json(),
      ]);

      setEmployees(employeesJson.employees ?? []);

      setDevices(devicesJson.devices ?? []);

      setLogs(logsJson.logs ?? []);
    } catch (error) {
      console.error("[DASHBOARD]", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // POLLING
  // ==========================================================

  useEffect(() => {
    void loadData();

    const interval = window.setInterval(() => {
      void loadData();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadData]);

  // ==========================================================
  // CALCULATIONS
  // ==========================================================

  const registeredCount = useMemo(
    () => employees.filter((employee) => Boolean(employee.rfidUid)).length,
    [employees],
  );

  const onlineDevices = useMemo(
    () => devices.filter((device) => isDeviceOnline(device.lastSeenAt)).length,
    [devices],
  );

  const successScans = useMemo(
    () => logs.filter((log) => log.result === "success").length,
    [logs],
  );

  const primaryDevice = devices[0] ?? null;

  const primaryOnline = primaryDevice
    ? isDeviceOnline(primaryDevice.lastSeenAt)
    : false;

  const cards = [
    {
      title: "Total Karyawan",

      value: employees.length,

      description: "Data karyawan",

      icon: Users,
    },

    {
      title: "RFID Terdaftar",

      value: registeredCount,

      description: `${Math.max(
        employees.length - registeredCount,
        0,
      )} belum memiliki kartu`,

      icon: BadgeCheck,
    },

    {
      title: "Reader Online",

      value: `${onlineDevices}/${devices.length}`,

      description: "Heartbeat reader",

      icon: Cpu,
    },

    {
      title: "Scan Berhasil",

      value: successScans,

      description: "100 riwayat terbaru",

      icon: ScanLine,
    },
  ];

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-7">
        <p className="max-w-2xl text-sm leading-6 text-slate-500">
          Pantau reader, registrasi kartu, dan aktivitas RFID dari satu tempat.
        </p>
      </section>

      {/* STATISTICS */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.title}
              className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)] sm:p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon size={19} />
                </div>

                <span className="mt-1 size-2 rounded-full bg-emerald-500" />
              </div>

              <div className="mt-7">
                <p className="text-[13px] font-semibold text-slate-500">
                  {card.title}
                </p>

                <div className="mt-1.5 text-3xl font-black tracking-[-0.045em] text-slate-950">
                  {loading ? "..." : card.value}
                </div>

                <p className="mt-2 text-xs font-medium text-slate-400">
                  {card.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* READER HEALTH */}

        <section className="overflow-hidden rounded-[28px] bg-[#0b1220] p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-7">
          <div className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <Radio size={14} />
                Reader Health
              </div>

              <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">
                {primaryDevice?.name ?? "Registration Reader"}
              </h2>

              <p className="mt-1 text-xs font-semibold capitalize text-slate-500">
                {primaryDevice?.type === "registration"
                  ? "RFID Registration Reader"
                  : (primaryDevice?.type ?? "Belum terhubung")}
              </p>
            </div>

            <div
              className={[
                "inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-black",
                primaryOnline
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-rose-400/10 text-rose-400",
              ].join(" ")}
            >
              <span
                className={[
                  "size-2 rounded-full",
                  primaryOnline ? "bg-emerald-400" : "bg-rose-400",
                ].join(" ")}
              />

              {primaryOnline ? "ONLINE" : "OFFLINE"}
            </div>
          </div>

          <div className="grid gap-3 pt-6 sm:grid-cols-2">
            {/* WIFI */}

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Wifi size={14} />
                Wi-Fi Signal
              </div>

              <div className="mt-3 text-xl font-black">
                {primaryDevice?.wifiRssi ?? "-"}{" "}
                <span className="text-xs font-semibold text-slate-500">
                  dBm
                </span>
              </div>

              <p className="mt-1 text-xs font-semibold text-emerald-400">
                {wifiLabel(primaryDevice?.wifiRssi ?? null)}
              </p>
            </div>

            {/* FIRMWARE */}

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Cpu size={14} />
                Firmware
              </div>

              <div className="mt-3 text-xl font-black">
                {primaryDevice?.firmwareVersion ?? "-"}
              </div>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                ESP32 + RC522
              </p>
            </div>
          </div>

          {/* HEARTBEAT */}

          <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold text-slate-500">
              Last heartbeat
            </p>

            <p className="mt-2 text-sm font-bold">
              {primaryDevice?.lastSeenAt
                ? new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",

                    timeStyle: "medium",
                  }).format(new Date(primaryDevice.lastSeenAt))
                : "Belum pernah menerima heartbeat"}
            </p>
          </div>
        </section>

        {/* ACTIVITY */}

        <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)] sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Live Activity
              </p>

              <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">
                Aktivitas terbaru
              </h2>
            </div>

            <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-100">
              <Activity size={18} />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {logs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-4 rounded-2xl p-3.5 transition hover:bg-slate-50"
              >
                <span
                  className={[
                    "size-2.5 shrink-0 rounded-full",
                    log.result === "success"
                      ? "bg-emerald-500"
                      : log.result === "warning"
                        ? "bg-amber-400"
                        : "bg-rose-500",
                  ].join(" ")}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {log.employeeName ?? log.uid ?? "Unknown card"}
                  </p>

                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
                    {log.code}
                  </p>
                </div>

                <time className="shrink-0 text-[11px] font-semibold text-slate-400">
                  {formatTime(log.createdAt)}
                </time>
              </div>
            ))}

            {!loading && logs.length === 0 && (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <Activity size={28} className="text-slate-300" />

                <p className="mt-3 text-sm font-bold text-slate-500">
                  Belum ada aktivitas
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
