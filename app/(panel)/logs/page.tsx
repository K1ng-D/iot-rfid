"use client";

import {
  Activity,
  Check,
  CircleAlert,
  Search,
  TriangleAlert,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ScanLog } from "@/types/rfid";

export default function LogsPage() {
  const [logs, setLogs] = useState<ScanLog[]>([]);

  const [search, setSearch] = useState("");

  const [resultFilter, setResultFilter] = useState("all");

  const [loading, setLoading] = useState(true);

  // ==========================================================
  // LOAD LOGS
  // ==========================================================

  const loadLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/logs", {
        cache: "no-store",
      });

      const data = await response.json();

      setLogs(data.logs ?? []);
    } catch (error) {
      console.error("[LOGS]", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // POLLING
  // ==========================================================

  useEffect(() => {
    void loadLogs();

    const interval = window.setInterval(() => {
      void loadLogs();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadLogs]);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchResult = resultFilter === "all" || log.result === resultFilter;

      const matchSearch =
        !keyword ||
        [
          log.uid,
          log.employeeName ?? "",
          log.code,
          log.message,
          log.readerType ?? "",
        ].some((value) => value.toLowerCase().includes(keyword));

      return matchResult && matchSearch;
    });
  }, [logs, search, resultFilter]);

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="mx-auto max-w-[1500px]">
      <p className="max-w-2xl text-sm leading-6 text-slate-500">
        Riwayat aktivitas reader RFID dengan sistem. Gunakan halaman ini untuk
        monitoring dan troubleshooting.
      </p>

      <section className="mt-7 overflow-hidden rounded-[28px] border border-slate-200 bg-white">
        {/* HEADER */}

        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div>
            <h2 className="text-lg font-black tracking-[-0.03em]">
              Scan Activity
            </h2>

            <p className="mt-1 text-xs text-slate-400">100 aktivitas terbaru</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {/* SEARCH */}

            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari UID / nama..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none focus:border-slate-400 sm:w-64"
              />
            </div>

            {/* FILTER */}

            <select
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none"
            >
              <option value="all">Semua</option>

              <option value="success">Success</option>

              <option value="warning">Warning</option>

              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* LOG LIST */}

        <div className="divide-y divide-slate-100">
          {filteredLogs.map((log) => {
            const Icon =
              log.result === "success"
                ? Check
                : log.result === "warning"
                  ? TriangleAlert
                  : CircleAlert;

            return (
              <article
                key={log.id}
                className="grid gap-4 p-5 transition hover:bg-slate-50/60 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6"
              >
                {/* ICON */}

                <div
                  className={[
                    "flex size-11 items-center justify-center rounded-2xl",
                    log.result === "success"
                      ? "bg-emerald-50 text-emerald-600"
                      : log.result === "warning"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-rose-50 text-rose-600",
                  ].join(" ")}
                >
                  <Icon size={18} />
                </div>

                {/* CONTENT */}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-black">{log.uid}</p>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                      {log.code}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm font-semibold text-slate-600">
                    {log.message}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-400">
                    <span>{log.employeeName ?? "Tanpa karyawan"}</span>

                    <span>
                      {log.readerType === "registration"
                        ? "Registration Reader"
                        : "RFID Reader"}
                    </span>
                  </div>
                </div>

                {/* TIME */}

                <time className="text-xs font-bold text-slate-400 sm:text-right">
                  {log.createdAt
                    ? new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",

                        timeStyle: "medium",
                      }).format(new Date(log.createdAt))
                    : "-"}
                </time>
              </article>
            );
          })}
        </div>

        {/* EMPTY */}

        {!loading && filteredLogs.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <Activity size={32} className="text-slate-300" />

            <p className="mt-4 font-black">Belum ada aktivitas</p>

            <p className="mt-1 text-sm text-slate-400">
              Scan RFID akan muncul di sini.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
