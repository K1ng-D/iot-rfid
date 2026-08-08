"use client";

import { Activity, Cpu, Radio, Router, Wifi } from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import type { RfidDevice } from "@/types/rfid";

function online(value: string | null) {
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

export default function DevicesPage() {
  const [devices, setDevices] = useState<RfidDevice[]>([]);

  const [loading, setLoading] = useState(true);

  const loadDevices = useCallback(async () => {
    try {
      const response = await fetch("/api/devices", {
        cache: "no-store",
      });

      const data = await response.json();

      setDevices(data.devices ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();

    const interval = window.setInterval(() => {
      void loadDevices();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadDevices]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <p className="max-w-2xl text-sm leading-6 text-slate-500">
        Pantau status, heartbeat, firmware dan kualitas koneksi setiap perangkat
        RFID.
      </p>

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        {devices.map((device) => {
          const isOnline = online(device.lastSeenAt);

          const wifi = wifiQuality(device.wifiRssi);

          return (
            <article
              key={device.id}
              className="overflow-hidden rounded-[30px] border border-slate-200 bg-white"
            >
              <div className="flex flex-col gap-5 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-[20px] bg-slate-950 text-white">
                    <Radio size={23} />
                  </div>

                  <div>
                    <p className="font-black tracking-[-0.02em]">
                      {device.name || "RFID Reader"}
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {device.deviceId}
                    </p>
                  </div>
                </div>

                <span
                  className={[
                    "inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black",
                    isOnline
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "size-2 rounded-full",
                      isOnline ? "bg-emerald-500" : "bg-rose-500",
                    ].join(" ")}
                  />

                  {isOnline ? "ONLINE" : "OFFLINE"}
                </span>
              </div>

              <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-7">
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Cpu size={14} />
                    Firmware
                  </div>

                  <p className="mt-3 text-lg font-black">
                    {device.firmwareVersion || "-"}
                  </p>
                </div>

                <div className="rounded-[22px] bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Router size={14} />
                    Type
                  </div>

                  <p className="mt-3 text-lg font-black capitalize">
                    {device.type || "-"}
                  </p>
                </div>

                <div className="rounded-[22px] bg-slate-50 p-4 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <Wifi size={14} />
                      Wi-Fi Signal
                    </div>

                    <span className="text-xs font-black text-slate-600">
                      {wifi.label}
                    </span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-950 transition-all duration-500"
                      style={{
                        width: `${wifi.percentage}%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-sm font-black">
                    {device.wifiRssi ?? "-"}{" "}
                    <span className="text-xs font-medium text-slate-400">
                      dBm
                    </span>
                  </p>
                </div>

                <div className="rounded-[22px] bg-slate-50 p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Activity size={14} />
                    Last heartbeat
                  </div>

                  <p className="mt-3 text-sm font-black">
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

      {!loading && devices.length === 0 && (
        <div className="mt-7 flex min-h-80 flex-col items-center justify-center rounded-[30px] border border-dashed border-slate-300 bg-white text-center">
          <Cpu size={34} className="text-slate-300" />

          <p className="mt-4 font-black">Belum ada perangkat</p>

          <p className="mt-1 text-sm text-slate-400">
            Tambahkan REG-001 di Firestore.
          </p>
        </div>
      )}
    </div>
  );
}
