"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  Search,
  UserRound,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AttendanceRecord } from "@/types/rfid";

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

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit",

    timeZone: "Asia/Jakarta",
  }).format(date);
}

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

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const todayKey = getTodayKey();

  const loadAttendance = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance", {
        cache: "no-store",
      });

      const data = await response.json();

      setAttendance(data.attendance ?? []);
    } catch (error) {
      console.error("[ATTENDANCE]", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAttendance();

    const interval = window.setInterval(() => {
      void loadAttendance();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [loadAttendance]);

  const todayAttendance = useMemo(
    () => attendance.filter((item) => item.dateKey === todayKey),
    [attendance, todayKey],
  );

  const completedToday = useMemo(
    () => todayAttendance.filter((item) => item.status === "completed").length,
    [todayAttendance],
  );

  const stillInside = useMemo(
    () => todayAttendance.filter((item) => item.status === "checked_in").length,
    [todayAttendance],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return attendance;
    }

    return attendance.filter((item) =>
      [
        item.employeeName,
        item.employeeCode,
        item.department,
        item.position,
        item.rfidUid,
        item.dateKey,
      ].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [attendance, search]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">
          Pantau jam masuk dan jam pulang karyawan berdasarkan scan kartu RFID.
        </p>
      </div>

      {/* STAT CARDS */}

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <article className="rounded-[26px] border border-slate-200 bg-white p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <CalendarDays size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em]">
            {todayAttendance.length}
          </p>

          <p className="mt-1 text-xs font-bold text-slate-400">
            Hadir hari ini
          </p>
        </article>

        <article className="rounded-[26px] border border-slate-200 bg-white p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em]">
            {completedToday}
          </p>

          <p className="mt-1 text-xs font-bold text-slate-400">Sudah pulang</p>
        </article>

        <article className="rounded-[26px] border border-slate-200 bg-white p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Clock3 size={19} />
          </div>

          <p className="mt-6 text-3xl font-black tracking-[-0.04em]">
            {stillInside}
          </p>

          <p className="mt-1 text-xs font-bold text-slate-400">
            Belum absen pulang
          </p>
        </article>
      </div>

      {/* TABLE */}

      <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-black tracking-[-0.03em]">
              Riwayat Absensi
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              {filtered.length} data absensi
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

        {/* DESKTOP */}

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Karyawan
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Tanggal
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Jam Masuk
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Jam Pulang
                </th>

                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-100">
                        <UserRound size={17} />
                      </div>

                      <div>
                        <p className="text-sm font-black">
                          {item.employeeName}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {item.employeeCode} · {item.department}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5 text-sm font-bold text-slate-600">
                    {item.dateKey}
                  </td>

                  <td className="px-6 py-5">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                      <LogIn size={14} />

                      {formatTime(item.checkInAt)}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    {item.checkOutAt ? (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                        <LogOut size={14} />

                        {formatTime(item.checkOutAt)}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        Belum pulang
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-5">
                    <span
                      className={[
                        "inline-flex rounded-full px-3 py-1.5 text-[10px] font-black",
                        item.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700",
                      ].join(" ")}
                    >
                      {item.status === "completed" ? "SELESAI" : "CHECKED IN"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE */}

        <div className="divide-y divide-slate-100 lg:hidden">
          {filtered.map((item) => (
            <article key={item.id} className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100">
                  <UserRound size={17} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {item.employeeName}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {item.employeeCode}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                    Masuk
                  </p>

                  <p className="mt-2 text-sm font-black text-emerald-800">
                    {formatTime(item.checkInAt)}
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                    Pulang
                  </p>

                  <p className="mt-2 text-sm font-black text-blue-800">
                    {item.checkOutAt ? formatTime(item.checkOutAt) : "-"}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs font-semibold text-slate-400">
                {formatDateTime(item.updatedAt)}
              </p>
            </article>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <CalendarDays size={34} className="text-slate-300" />

            <p className="mt-4 font-black">Belum ada absensi</p>

            <p className="mt-1 text-sm text-slate-400">
              Scan kartu RFID terdaftar untuk membuat absensi.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
