"use client";

import {
  Activity,
  BarChart3,
  CalendarCheck2,
  Cpu,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Settings,
  Users,
  X,
} from "lucide-react";

import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase-auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

// ============================================================
// MENU
// ============================================================

const menuGroups = [
  {
    label: "Overview",

    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
    ],
  },

  {
    label: "Kepegawaian",

    items: [
      {
        href: "/employees",
        label: "Karyawan",
        icon: Users,
      },
    ],
  },

  {
    label: "RFID",

    items: [
      {
        href: "/registration",
        label: "Registrasi RFID",
        icon: ScanLine,
      },

      {
        href: "/rfid-cards",
        label: "Kartu RFID",
        icon: CreditCard,
      },

      {
        href: "/devices",
        label: "Perangkat",
        icon: Cpu,
      },
    ],
  },

  {
    label: "Kehadiran",

    items: [
      {
        href: "/attendance",
        label: "Absensi",
        icon: CalendarCheck2,
      },

      {
        href: "/logs",
        label: "Riwayat Scan",
        icon: Activity,
      },

      {
        href: "/reports",
        label: "Laporan",
        icon: BarChart3,
      },
    ],
  },

  {
    label: "Sistem",

    items: [
      {
        href: "/settings",
        label: "Pengaturan",
        icon: Settings,
      },
    ],
  },
];

const menuItems = menuGroups.flatMap((group) => group.items);

// ============================================================
// TYPES
// ============================================================

interface DashboardShellProps {
  children: React.ReactNode;
}

// ============================================================
// COMPONENT
// ============================================================

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);

    router.replace("/login");
    router.refresh();
  }

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ==========================================================
  // CURRENT MENU
  // ==========================================================

  const currentMenu = menuItems.find(
    (menu) => pathname === menu.href || pathname.startsWith(`${menu.href}/`),
  );

  // ==========================================================
  // ACTIVE
  // ==========================================================

  function isMenuActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#0f172a]">
      {/* ===================================================== */}
      {/* MOBILE OVERLAY */}
      {/* ===================================================== */}

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 bg-[#081f36]/55 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ===================================================== */}
      {/* SIDEBAR */}
      {/* ===================================================== */}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#0d2f53] text-white transition-transform duration-300",

          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* =================================================== */}
        {/* BRAND */}
        {/* =================================================== */}

        <div className="flex h-24 shrink-0 items-center justify-between border-b border-[#274b6d] px-7">
          <Link
            href="/dashboard"
            className="flex items-center"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <Image
              src="/images/nexty-labs-logo.png"
              alt="Nexty Labs"
              width={170}
              height={68}
              priority
              className="h-auto w-[135px] object-contain"
            />
          </Link>

          <button
            type="button"
            aria-label="Tutup sidebar"
            className="flex size-10 items-center justify-center rounded-xl text-[#8ca9c2] transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* =================================================== */}
        {/* MENU */}
        {/* =================================================== */}

        <nav className="flex-1 overflow-y-auto px-4 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-7">
            {menuGroups.map((group) => (
              <div key={group.label}>
                {/* GROUP TITLE */}

                <div className="mb-2.5 px-3 text-[9px] font-black uppercase tracking-[0.19em] text-[#7193b2]">
                  {group.label}
                </div>

                {/* ITEMS */}

                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    const active = isMenuActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={[
                          "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",

                          active
                            ? "bg-[#007BFF] text-white shadow-lg shadow-[#007BFF]/25"
                            : "text-[#d0deeb] hover:bg-white/10 hover:text-white",
                        ].join(" ")}
                      >
                        <Icon
                          size={18}
                          strokeWidth={2.1}
                          className={
                            active
                              ? "text-white"
                              : "text-[#86a4bf] transition group-hover:text-white"
                          }
                        />

                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>

                        {active && (
                          <span className="size-1.5 shrink-0 rounded-full bg-white" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* =================================================== */}
        {/* SYSTEM STATUS */}
        {/* =================================================== */}

        <div className="shrink-0 border-t border-[#274b6d] p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-[#d0deeb] transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} className="text-[#86a4bf]" />

            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ===================================================== */}
      {/* CONTENT */}
      {/* ===================================================== */}

      <div className="lg:pl-[280px]">
        {/* =================================================== */}
        {/* TOPBAR */}
        {/* =================================================== */}

        <header className="sticky top-0 z-30 border-b border-[#dce6f1] bg-[#f4f7fb]/90 backdrop-blur-xl">
          <div className="flex h-[82px] items-center justify-between px-5 sm:px-7 lg:px-9">
            <div className="flex min-w-0 items-center gap-4">
              {/* MOBILE MENU */}

              <button
                type="button"
                aria-label="Buka sidebar"
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#dce6f1] bg-white text-[#0d2f53] shadow-sm lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>

              {/* TITLE */}

              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7c8ca0]">
                  RFID Management
                </p>

                <h1 className="mt-1 truncate text-xl font-black tracking-[-0.035em] text-[#101828] sm:text-2xl">
                  {currentMenu?.label ?? "Control Center"}
                </h1>
              </div>
            </div>

            {/* API STATUS */}

            <div className="hidden items-center gap-2 rounded-full border border-[#bcebd6] bg-[#e9f9f1] px-4 py-2 text-xs font-bold text-[#07875f] sm:flex">
              <span className="size-2 rounded-full bg-[#10b981]" />
              API Ready
            </div>
          </div>
        </header>

        {/* =================================================== */}
        {/* PAGE */}
        {/* =================================================== */}

        <main className="px-5 py-7 sm:px-7 lg:px-9 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
