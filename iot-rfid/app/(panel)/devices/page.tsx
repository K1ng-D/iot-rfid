"use client";

import { Activity, Cpu, Radio, Router, Wifi } from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import type { RfidDevice } from "@/types/rfid";

// ============================================================
// HELPERS
// ============================================================

function isOnline(value: string | null) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) && Date.now() - timestamp < 130_000;
}

function wifiQuality(value: number | null) {
  if (value === null) {
    return {
      label: "Unknown",

      percentage: 0,
    };
  }

  const percentage = Math.max(5, Math.min(100, Math.round((value + 100) * 2)));

  if (value >= -55) {
    return {
      label: "Excellent",

      percentage,
    };
  }

  if (value >= -67) {
    return {
      label: "Good",

      percentage,
    };
  }

  if (value >= -75) {
    return {
      label: "Fair",

      percentage,
    };
  }

  return {
    label: "Weak",

    percentage,
  };
}

// ============================================================
// PAGE
// ============================================================

export default function DevicesPage() {
  const [devices, setDevices] = useState<RfidDevice[]>([]);

  const [loading, setLoading] = useState(true);

  // ==========================================================
  // LOAD
  // ==========================================================

  const loadDevices = useCallback(async () => {
    try {
      const response = await fetch("/api/devices", {
        cache: "no-store",
      });

      const data = await response.json();

      setDevices(data.devices ?? []);
    } catch (error) {
      console.error("[DEVICES]", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // POLLING
  // ==========================================================

  useEffect(() => {
    void loadDevices();

    const interval = window.setInterval(() => {
      void loadDevices();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadDevices]);

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-[1400px]">
      <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
        Pantau status, heartbeat, firmware, uptime, dan kualitas koneksi
        Registration Reader.
      </p>

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        {devices.map((device) => {
          const online = isOnline(device.lastSeenAt);

          const wifi = wifiQuality(device.wifiRssi);

          return (
            <article
              key={device.id}
              className="overflow-hidden rounded-[30px] border border-[#dce6f1] bg-white shadow-[0_12px_40px_rgba(30,64,100,0.04)]"
            >
              {/* HEADER */}

              <div className="flex flex-col gap-5 border-b border-[#edf2f7] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#007BFF] text-white">
                    <Radio size={23} />
                  </div>

                  <div>
                    <p className="font-black tracking-[-0.02em] text-[#172033]">
                      {device.name || "Registration Reader"}
                    </p>

                    <p className="mt-1 text-xs font-bold text-[#8291a4]">
                      ESP32 + RC522
                    </p>
                  </div>
                </div>

                <span
                  className={[
                    "inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black",
                    online
                      ? "bg-[#e9f9f1] text-[#07875f]"
                      : "bg-[#fff0f0] text-[#dc2626]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "size-2 rounded-full",
                      online ? "bg-[#10b981]" : "bg-[#ef4444]",
                    ].join(" ")}
                  />

                  {online ? "ONLINE" : "OFFLINE"}
                </span>
              </div>

              {/* CONTENT */}

              <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-7">
                {/* FIRMWARE */}

                <div className="rounded-[22px] border border-[#edf2f7] bg-[#f7fafd] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8291a4]">
                    <Cpu size={14} className="text-[#007BFF]" />
                    Firmware
                  </div>

                  <p className="mt-3 text-lg font-black text-[#172033]">
                    {device.firmwareVersion || "-"}
                  </p>
                </div>

                {/* READER TYPE */}

                <div className="rounded-[22px] border border-[#edf2f7] bg-[#f7fafd] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8291a4]">
                    <Router size={14} className="text-[#007BFF]" />
                    Reader Type
                  </div>

                  <p className="mt-3 text-lg font-black capitalize text-[#172033]">
                    {device.type === "registration"
                      ? "Registration"
                      : device.type || "-"}
                  </p>
                </div>

                {/* WIFI */}

                <div className="rounded-[22px] border border-[#edf2f7] bg-[#f7fafd] p-4 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#8291a4]">
                      <Wifi size={14} className="text-[#007BFF]" />
                      Wi-Fi Signal
                    </div>

                    <span className="text-xs font-black text-[#52657a]">
                      {wifi.label}
                    </span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#dce6f1]">
                    <div
                      className="h-full rounded-full bg-[#007BFF] transition-all duration-500"
                      style={{
                        width: `${wifi.percentage}%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-sm font-black text-[#172033]">
                    {device.wifiRssi ?? "-"}{" "}
                    <span className="text-xs font-medium text-[#8291a4]">
                      dBm
                    </span>
                  </p>
                </div>

                {/* UPTIME */}

                <div className="rounded-[22px] border border-[#edf2f7] bg-[#f7fafd] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8291a4]">
                    <Activity size={14} className="text-[#007BFF]" />
                    Uptime
                  </div>

                  <p className="mt-3 text-lg font-black text-[#172033]">
                    {typeof device.uptimeSeconds === "number"
                      ? `${Math.floor(device.uptimeSeconds / 60)} menit`
                      : "-"}
                  </p>
                </div>

                {/* CONNECTION */}

                <div className="rounded-[22px] border border-[#edf2f7] bg-[#f7fafd] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8291a4]">
                    <Radio size={14} className="text-[#007BFF]" />
                    Connection
                  </div>

                  <p
                    className={[
                      "mt-3 text-lg font-black",
                      online ? "text-[#07875f]" : "text-[#ef4444]",
                    ].join(" ")}
                  >
                    {online ? "Connected" : "Disconnected"}
                  </p>
                </div>

                {/* HEARTBEAT */}

                <div className="rounded-[22px] border border-[#edf2f7] bg-[#f7fafd] p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#8291a4]">
                    <Activity size={14} className="text-[#007BFF]" />
                    Last heartbeat
                  </div>

                  <p className="mt-3 text-sm font-black text-[#172033]">
                    {device.lastSeenAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",

                          timeStyle: "medium",
                        }).format(new Date(device.lastSeenAt))
                      : "Belum pernah terhubung"}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* EMPTY */}

      {!loading && devices.length === 0 && (
        <div className="mt-7 flex min-h-80 flex-col items-center justify-center rounded-[30px] border border-dashed border-[#b9cadd] bg-white p-8 text-center shadow-[0_12px_40px_rgba(30,64,100,0.03)]">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[#eaf4ff]">
            <Cpu size={34} className="text-[#007BFF]" />
          </div>

          <p className="mt-4 font-black text-[#172033]">
            Reader belum terhubung
          </p>

          <p className="mt-1 max-w-sm text-sm leading-6 text-[#8291a4]">
            Nyalakan ESP32. Data reader akan dibuat otomatis setelah heartbeat
            pertama diterima.
          </p>
        </div>
      )}
    </div>
  );
}
