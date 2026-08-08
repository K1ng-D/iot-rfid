"use client";

import {
  Activity,
  Cpu,
  LayoutDashboard,
  Menu,
  Radio,
  ScanLine,
  Users,
  X,
} from "lucide-react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { useState } from "react";

const menuItems = [
  {
    href: "/dashboard",

    label: "Dashboard",

    icon: LayoutDashboard,
  },

  {
    href: "/employees",

    label: "Karyawan",

    icon: Users,
  },

  {
    href: "/registration",

    label: "Registrasi RFID",

    icon: ScanLine,
  },

  {
    href: "/devices",

    label: "Perangkat",

    icon: Cpu,
  },

  {
    href: "/logs",

    label: "Riwayat Scan",

    icon: Activity,
  },
];

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const currentMenu = menuItems.find(
    (menu) => pathname === menu.href || pathname.startsWith(`${menu.href}/`),
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      {mobileSidebarOpen && (
        <button
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#0b1220] text-white transition-transform duration-300",
          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-24 items-center justify-between border-b border-white/8 px-7">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-[#0b1220] shadow-xl shadow-black/20">
              <Radio size={22} strokeWidth={2.3} />
            </div>

            <div>
              <div className="text-[17px] font-black tracking-[-0.03em]">
                NEXTY RFID
              </div>

              <div className="mt-0.5 text-[10px] font-semibold tracking-[0.18em] text-slate-500">
                CONTROL CENTER
              </div>
            </div>
          </Link>

          <button
            className="flex size-10 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-7">
          <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Workspace
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={[
                  "group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition",
                  active
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "text-slate-400 hover:bg-white/7 hover:text-white",
                ].join(" ")}
              >
                <Icon
                  size={18}
                  strokeWidth={2.1}
                  className={
                    active
                      ? "text-slate-950"
                      : "text-slate-500 transition group-hover:text-white"
                  }
                />

                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.045] p-4">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
              </span>

              <div>
                <p className="text-xs font-bold text-white">System Running</p>

                <p className="mt-0.5 text-[11px] text-slate-500">
                  RFID Management
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f5f7fb]/90 backdrop-blur-xl">
          <div className="flex h-[82px] items-center justify-between px-5 sm:px-7 lg:px-9">
            <div className="flex items-center gap-4">
              <button
                className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  RFID Management
                </p>

                <h1 className="mt-1 text-xl font-black tracking-[-0.035em] text-slate-950 sm:text-2xl">
                  {currentMenu?.label ?? "Control Center"}
                </h1>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" />
              API Ready
            </div>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-7 lg:px-9 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
