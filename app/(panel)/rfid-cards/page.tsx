"use client";

import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CreditCard,
  Link2Off,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RfidCard } from "@/types/rfid";

// ============================================================
// TYPES
// ============================================================

type StatusFilter = "all" | "active" | "inactive";

type CardStatus = "active" | "inactive";

interface ToastState {
  type: "success" | "error";
  message: string;
}

interface RfidCardsResponse {
  success?: boolean;
  cards?: RfidCard[];
  message?: string;
}

interface CardActionResponse {
  success?: boolean;
  code?: string;
  status?: CardStatus;
  message?: string;
}

// ============================================================
// CONFIG
// ============================================================

const PAGE_SIZE = 10;

// ============================================================
// HELPERS
// ============================================================

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

// ============================================================

function getStatusLabel(status: RfidCard["status"]) {
  return status === "active" ? "Aktif" : "Nonaktif";
}

// ============================================================
// PAGE
// ============================================================

export default function RfidCardsPage() {
  const [cards, setCards] = useState<RfidCard[]>([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [loadError, setLoadError] = useState("");

  // ==========================================================
  // STATUS ACTION
  // ==========================================================

  const [statusTarget, setStatusTarget] = useState<RfidCard | null>(null);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ==========================================================
  // UNLINK
  // ==========================================================

  const [deleteTarget, setDeleteTarget] = useState<RfidCard | null>(null);

  const [deleting, setDeleting] = useState(false);

  // ==========================================================
  // TOAST
  // ==========================================================

  const [toast, setToast] = useState<ToastState | null>(null);

  const requestRunningRef = useRef(false);

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

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  // ==========================================================
  // LOAD CARDS
  // ==========================================================

  const loadCards = useCallback(async (manualRefresh = false) => {
    if (requestRunningRef.current) {
      return;
    }

    requestRunningRef.current = true;

    if (manualRefresh) {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/rfid-cards", {
        cache: "no-store",

        headers: {
          Accept: "application/json",
        },
      });

      const data = (await response.json()) as RfidCardsResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil data kartu RFID.");
      }

      setCards(Array.isArray(data.cards) ? data.cards : []);

      setLoadError("");
    } catch (error) {
      console.error("[RFID CARDS]", error);

      setLoadError(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data kartu RFID.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestRunningRef.current = false;
    }
  }, []);

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    void loadCards();

    return () => {
      requestRunningRef.current = false;
    };
  }, [loadCards]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const activeCount = useMemo(() => {
    return cards.filter((card) => card.status === "active").length;
  }, [cards]);

  const inactiveCount = useMemo(() => {
    return cards.filter((card) => card.status === "inactive").length;
  }, [cards]);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredCards = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return cards.filter((card) => {
      const matchesStatus =
        statusFilter === "all" || card.status === statusFilter;

      const matchesSearch =
        !keyword ||
        [card.uid, card.employeeName, card.employeeCode, card.employeeId].some(
          (value) => value.toLowerCase().includes(keyword),
        );

      return matchesStatus && matchesSearch;
    });
  }, [cards, search, statusFilter]);

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredCards.slice(start, start + PAGE_SIZE);
  }, [filteredCards, currentPage]);

  const paginationStart =
    filteredCards.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;

  const paginationEnd = Math.min(currentPage * PAGE_SIZE, filteredCards.length);

  // ==========================================================
  // FILTER STATE
  // ==========================================================

  const hasFilter = search.trim() !== "" || statusFilter !== "all";

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setCurrentPage(1);
  }

  // ==========================================================
  // STATUS MODAL
  // ==========================================================

  function openStatusModal(card: RfidCard) {
    setStatusTarget(card);
  }

  function closeStatusModal() {
    if (updatingStatus) {
      return;
    }

    setStatusTarget(null);
  }

  // ==========================================================
  // UPDATE STATUS
  // ==========================================================

  async function updateCardStatus() {
    if (!statusTarget || updatingStatus) {
      return;
    }

    const nextStatus: CardStatus =
      statusTarget.status === "active" ? "inactive" : "active";

    setUpdatingStatus(true);

    try {
      const response = await fetch(
        `/api/rfid-cards/${encodeURIComponent(statusTarget.uid)}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      const data = (await response.json()) as CardActionResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal memperbarui status kartu RFID.");
      }

      setStatusTarget(null);

      await loadCards();

      showToast(
        "success",
        data.message ??
          (nextStatus === "active"
            ? "Kartu RFID berhasil diaktifkan."
            : "Kartu RFID berhasil dinonaktifkan."),
      );
    } catch (error) {
      console.error("[RFID CARD STATUS]", error);

      showToast(
        "error",
        error instanceof Error
          ? error.message
          : "Gagal memperbarui status kartu RFID.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  // ==========================================================
  // DELETE MODAL
  // ==========================================================

  function openDeleteModal(card: RfidCard) {
    setDeleteTarget(card);
  }

  function closeDeleteModal() {
    if (deleting) {
      return;
    }

    setDeleteTarget(null);
  }

  // ==========================================================
  // UNLINK CARD
  // ==========================================================

  async function unlinkCard() {
    if (!deleteTarget || deleting) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/rfid-cards/${encodeURIComponent(deleteTarget.uid)}`,
        {
          method: "DELETE",

          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = (await response.json()) as CardActionResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal melepas kartu RFID.");
      }

      setDeleteTarget(null);

      await loadCards();

      showToast("success", data.message ?? "Kartu RFID berhasil dilepas.");
    } catch (error) {
      console.error("[RFID CARD UNLINK]", error);

      showToast(
        "error",
        error instanceof Error ? error.message : "Gagal melepas kartu RFID.",
      );
    } finally {
      setDeleting(false);
    }
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
            Memuat kartu RFID...
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
      <div className="mx-auto max-w-[1500px]">
        {/* =================================================== */}
        {/* HEADER */}
        {/* =================================================== */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="max-w-2xl text-sm leading-6 text-[#52657a]">
              Kelola kartu RFID yang terhubung dengan karyawan, blokir kartu
              sementara, atau lepaskan kartu untuk registrasi ulang.
            </p>
          </div>

          <Link
            href="/registration"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#007BFF] px-5 text-sm font-black text-white shadow-lg shadow-[#007BFF]/20 transition hover:-translate-y-0.5 hover:bg-[#006ee6]"
          >
            <Plus size={17} />
            Registrasi Kartu
          </Link>
        </div>

        {/* =================================================== */}
        {/* ERROR */}
        {/* =================================================== */}

        {loadError && (
          <div className="mt-5 flex flex-col gap-4 rounded-[20px] border border-[#ffd5d5] bg-[#fff0f0] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CircleAlert
                size={18}
                className="mt-0.5 shrink-0 text-[#ef4444]"
              />

              <div>
                <p className="text-sm font-black text-[#b42318]">
                  Gagal memuat kartu RFID
                </p>

                <p className="mt-1 text-xs font-semibold leading-5 text-[#d92d20]">
                  {loadError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadCards(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#d92d20]"
            >
              <RefreshCw size={14} />
              Coba Lagi
            </button>
          </div>
        )}

        {/* =================================================== */}
        {/* SUMMARY */}
        {/* =================================================== */}

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {/* TOTAL */}

          <article className="rounded-[26px] border border-[#153d62] bg-[#0d2f53] p-6 shadow-[0_12px_40px_rgba(13,47,83,0.08)]">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#007BFF] text-white">
              <CreditCard size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-white">
              {cards.length}
            </p>

            <p className="mt-1 text-xs font-bold text-[#b7cada]">Total kartu</p>
          </article>

          {/* ACTIVE */}

          <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e9f9f1] text-[#10b981]">
              <BadgeCheck size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
              {activeCount}
            </p>

            <p className="mt-1 text-xs font-bold text-[#8291a4]">Kartu aktif</p>
          </article>

          {/* INACTIVE */}

          <article className="rounded-[26px] border border-[#dce6f1] bg-white p-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff7e5] text-[#f59e0b]">
              <PowerOff size={19} />
            </div>

            <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#101828]">
              {inactiveCount}
            </p>

            <p className="mt-1 text-xs font-bold text-[#8291a4]">
              Kartu nonaktif
            </p>
          </article>
        </div>

        {/* =================================================== */}
        {/* LIST */}
        {/* =================================================== */}

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#dce6f1] bg-white shadow-[0_12px_40px_rgba(30,64,100,0.04)]">
          {/* ================================================ */}
          {/* HEADER */}
          {/* ================================================ */}

          <div className="border-b border-[#edf2f7] p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007BFF]">
                    RFID Management
                  </p>

                  <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#101828]">
                    Daftar Kartu RFID
                  </h2>

                  <p className="mt-1 text-xs text-[#8291a4]">
                    {filteredCards.length} kartu ditemukan
                  </p>
                </div>

                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => void loadCards(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6f1] bg-white px-4 text-xs font-black text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={refreshing ? "animate-spin" : ""}
                  />

                  {refreshing ? "Memperbarui..." : "Refresh"}
                </button>
              </div>

              {/* ============================================ */}
              {/* FILTER */}
              {/* ============================================ */}

              <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_190px_auto]">
                {/* SEARCH */}

                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#007BFF]"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari UID, nama, kode karyawan..."
                    className="h-11 w-full rounded-2xl border border-[#dce6f1] bg-[#f7fafd] pl-11 pr-4 text-sm font-semibold text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                  />
                </div>

                {/* STATUS */}

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="h-11 rounded-2xl border border-[#dce6f1] bg-[#f7fafd] px-4 text-sm font-semibold text-[#52657a] outline-none transition focus:border-[#007BFF] focus:bg-white focus:ring-4 focus:ring-[#007BFF]/10"
                >
                  <option value="all">Semua Status</option>

                  <option value="active">Aktif</option>

                  <option value="inactive">Nonaktif</option>
                </select>

                {/* RESET */}

                {hasFilter && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#dce6f1] bg-white px-4 text-sm font-bold text-[#64748b] transition hover:border-[#007BFF] hover:bg-[#eaf4ff] hover:text-[#007BFF]"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ================================================ */}
          {/* DESKTOP TABLE */}
          {/* ================================================ */}

          {paginatedCards.length > 0 && (
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#edf2f7] bg-[#f7fafd]">
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                      Kartu RFID
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                      Pemilik
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                      Tanggal Registrasi
                    </th>

                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                      Status
                    </th>

                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.12em] text-[#7f8fa3]">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedCards.map((card) => (
                    <tr
                      key={card.id}
                      className="border-b border-[#edf2f7] transition last:border-0 hover:bg-[#f7fafd]"
                    >
                      {/* RFID */}

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div
                            className={[
                              "flex size-11 shrink-0 items-center justify-center rounded-2xl",

                              card.status === "active"
                                ? "bg-[#007BFF] text-white"
                                : "bg-[#f1f5f9] text-[#94a3b8]",
                            ].join(" ")}
                          >
                            <CreditCard size={17} />
                          </div>

                          <div>
                            <p className="font-mono text-sm font-black tracking-wide text-[#172033]">
                              {card.uid}
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-[#94a3b8]">
                              RFID UID
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* OWNER */}

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf4ff] text-[#007BFF]">
                            <UserRound size={15} />
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate text-sm font-black text-[#334155]">
                              {card.employeeName || "Tanpa karyawan"}
                            </p>

                            <p className="mt-1 text-[11px] font-semibold text-[#8291a4]">
                              {card.employeeCode || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* DATE */}

                      <td className="px-6 py-5">
                        <p className="text-xs font-bold text-[#52657a]">
                          {formatDateTime(card.registeredAt)}
                        </p>
                      </td>

                      {/* STATUS */}

                      <td className="px-6 py-5">
                        <span
                          className={[
                            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black",

                            card.status === "active"
                              ? "bg-[#e9f9f1] text-[#07875f]"
                              : "bg-[#fff7e5] text-[#b77900]",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "size-1.5 rounded-full",

                              card.status === "active"
                                ? "bg-[#10b981]"
                                : "bg-[#f59e0b]",
                            ].join(" ")}
                          />

                          {getStatusLabel(card.status).toUpperCase()}
                        </span>
                      </td>

                      {/* ACTION */}

                      <td className="px-6 py-5">
                        <div className="flex justify-end gap-2">
                          {/* ACTIVATE / DEACTIVATE */}

                          <button
                            type="button"
                            onClick={() => openStatusModal(card)}
                            className={[
                              "inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition",

                              card.status === "active"
                                ? "border-[#f8e4b4] bg-white text-[#b77900] hover:bg-[#fff7e5]"
                                : "border-[#cfe0ff] bg-white text-[#007BFF] hover:bg-[#eaf4ff]",
                            ].join(" ")}
                          >
                            {card.status === "active" ? (
                              <>
                                <PowerOff size={14} />
                                Nonaktifkan
                              </>
                            ) : (
                              <>
                                <Power size={14} />
                                Aktifkan
                              </>
                            )}
                          </button>

                          {/* UNLINK */}

                          <button
                            type="button"
                            onClick={() => openDeleteModal(card)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#ffdede] bg-white px-3 text-xs font-black text-[#ef4444] transition hover:border-[#ef4444] hover:bg-[#fff0f0]"
                          >
                            <Link2Off size={14} />
                            Lepas
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================ */}
          {/* MOBILE */}
          {/* ================================================ */}

          {paginatedCards.length > 0 && (
            <div className="divide-y divide-[#edf2f7] lg:hidden">
              {paginatedCards.map((card) => (
                <article key={card.id} className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={[
                        "flex size-11 shrink-0 items-center justify-center rounded-2xl",

                        card.status === "active"
                          ? "bg-[#007BFF] text-white"
                          : "bg-[#f1f5f9] text-[#94a3b8]",
                      ].join(" ")}
                    >
                      <CreditCard size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm font-black tracking-wide text-[#172033]">
                        {card.uid}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <UserRound
                          size={13}
                          className="shrink-0 text-[#8291a4]"
                        />

                        <p className="truncate text-xs font-black text-[#52657a]">
                          {card.employeeName || "Tanpa karyawan"}
                        </p>
                      </div>

                      <p className="mt-1 text-[10px] font-semibold text-[#94a3b8]">
                        {card.employeeCode || "-"}
                      </p>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black",

                        card.status === "active"
                          ? "bg-[#e9f9f1] text-[#07875f]"
                          : "bg-[#fff7e5] text-[#b77900]",
                      ].join(" ")}
                    >
                      {getStatusLabel(card.status).toUpperCase()}
                    </span>
                  </div>

                  {/* REGISTERED */}

                  <div className="mt-4 rounded-2xl border border-[#edf2f7] bg-[#f7fafd] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">
                      Terdaftar
                    </p>

                    <p className="mt-2 text-xs font-black text-[#334155]">
                      {formatDateTime(card.registeredAt)}
                    </p>
                  </div>

                  {/* ACTIONS */}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openStatusModal(card)}
                      className={[
                        "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-black",

                        card.status === "active"
                          ? "bg-[#fff7e5] text-[#b77900]"
                          : "bg-[#eaf4ff] text-[#007BFF]",
                      ].join(" ")}
                    >
                      {card.status === "active" ? (
                        <>
                          <PowerOff size={14} />
                          Nonaktifkan
                        </>
                      ) : (
                        <>
                          <Power size={14} />
                          Aktifkan
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openDeleteModal(card)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#fff0f0] text-xs font-black text-[#ef4444]"
                    >
                      <Link2Off size={14} />
                      Lepas
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* ================================================ */}
          {/* EMPTY */}
          {/* ================================================ */}

          {filteredCards.length === 0 && (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-[22px] bg-[#eaf4ff] text-[#007BFF]">
                <CreditCard size={27} />
              </div>

              <p className="mt-4 font-black text-[#172033]">
                {hasFilter ? "Kartu tidak ditemukan" : "Belum ada kartu RFID"}
              </p>

              <p className="mt-1 max-w-sm text-sm leading-6 text-[#8291a4]">
                {hasFilter
                  ? "Tidak ada kartu yang sesuai dengan pencarian atau filter yang digunakan."
                  : "Registrasikan kartu RFID untuk karyawan agar kartu muncul di halaman ini."}
              </p>

              {hasFilter ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#007BFF] px-4 text-xs font-black text-white"
                >
                  <RotateCcw size={14} />
                  Reset Filter
                </button>
              ) : (
                <Link
                  href="/registration"
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#007BFF] px-4 text-xs font-black text-white"
                >
                  <Plus size={14} />
                  Registrasi Kartu
                </Link>
              )}
            </div>
          )}

          {/* ================================================ */}
          {/* PAGINATION */}
          {/* ================================================ */}

          {filteredCards.length > 0 && (
            <div className="flex flex-col gap-4 border-t border-[#edf2f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs font-semibold text-[#8291a4]">
                Menampilkan{" "}
                <span className="font-black text-[#334155]">
                  {paginationStart}
                </span>{" "}
                -{" "}
                <span className="font-black text-[#334155]">
                  {paginationEnd}
                </span>{" "}
                dari{" "}
                <span className="font-black text-[#334155]">
                  {filteredCards.length}
                </span>{" "}
                kartu
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setCurrentPage((current) => Math.max(1, current - 1))
                  }
                  className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex h-9 min-w-20 items-center justify-center rounded-xl bg-[#f7fafd] px-3 text-xs font-black text-[#334155]">
                  {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((current) =>
                      Math.min(totalPages, current + 1),
                    )
                  }
                  className="flex size-9 items-center justify-center rounded-xl border border-[#dce6f1] bg-white text-[#64748b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ===================================================== */}
      {/* STATUS MODAL */}
      {/* ===================================================== */}

      {statusTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0d2f53]/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div
                className={[
                  "flex size-14 items-center justify-center rounded-[20px]",

                  statusTarget.status === "active"
                    ? "bg-[#fff7e5] text-[#f59e0b]"
                    : "bg-[#eaf4ff] text-[#007BFF]",
                ].join(" ")}
              >
                {statusTarget.status === "active" ? (
                  <PowerOff size={22} />
                ) : (
                  <Power size={22} />
                )}
              </div>

              <button
                type="button"
                disabled={updatingStatus}
                onClick={closeStatusModal}
                className="flex size-9 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b] disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <h2 className="mt-5 text-xl font-black tracking-[-0.03em] text-[#172033]">
              {statusTarget.status === "active"
                ? "Nonaktifkan kartu?"
                : "Aktifkan kartu?"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Kartu{" "}
              <span className="font-mono font-black text-[#172033]">
                {statusTarget.uid}
              </span>{" "}
              milik{" "}
              <span className="font-black text-[#172033]">
                {statusTarget.employeeName || "karyawan"}
              </span>{" "}
              akan{" "}
              {statusTarget.status === "active"
                ? "dinonaktifkan"
                : "diaktifkan"}
              .
            </p>

            {/* INFO */}

            <div
              className={[
                "mt-5 rounded-2xl border p-4",

                statusTarget.status === "active"
                  ? "border-[#f8e4b4] bg-[#fff7e5]"
                  : "border-[#cfe0ff] bg-[#f4f8ff]",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                {statusTarget.status === "active" ? (
                  <CircleAlert
                    size={17}
                    className="mt-0.5 shrink-0 text-[#f59e0b]"
                  />
                ) : (
                  <CircleCheck
                    size={17}
                    className="mt-0.5 shrink-0 text-[#007BFF]"
                  />
                )}

                <p
                  className={[
                    "text-xs font-bold leading-5",

                    statusTarget.status === "active"
                      ? "text-[#9a6700]"
                      : "text-[#175cd3]",
                  ].join(" ")}
                >
                  {statusTarget.status === "active"
                    ? "Kartu tetap terhubung ke karyawan, tetapi tidak dapat digunakan untuk check-in maupun check-out sampai diaktifkan kembali."
                    : "Setelah diaktifkan, kartu dapat digunakan kembali untuk proses absensi."}
                </p>
              </div>
            </div>

            {/* ACTION */}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={updatingStatus}
                onClick={closeStatusModal}
                className="h-12 rounded-2xl border border-[#dce6f1] bg-white text-sm font-bold text-[#64748b] disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => void updateCardStatus()}
                className={[
                  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60",

                  statusTarget.status === "active"
                    ? "bg-[#f59e0b] hover:bg-[#d97706]"
                    : "bg-[#007BFF] hover:bg-[#006ee6]",
                ].join(" ")}
              >
                {updatingStatus ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Memproses...
                  </>
                ) : statusTarget.status === "active" ? (
                  <>
                    <PowerOff size={15} />
                    Nonaktifkan
                  </>
                ) : (
                  <>
                    <Power size={15} />
                    Aktifkan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* UNLINK MODAL */}
      {/* ===================================================== */}

      {deleteTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0d2f53]/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#fff0f0] text-[#ef4444]">
                <Link2Off size={22} />
              </div>

              <button
                type="button"
                disabled={deleting}
                onClick={closeDeleteModal}
                className="flex size-9 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b] disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <h2 className="mt-5 text-xl font-black tracking-[-0.03em] text-[#172033]">
              Lepas kartu RFID?
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Kartu{" "}
              <span className="font-mono font-black text-[#172033]">
                {deleteTarget.uid}
              </span>{" "}
              akan dilepas dari{" "}
              <span className="font-black text-[#172033]">
                {deleteTarget.employeeName || "karyawan"}
              </span>
              .
            </p>

            <div className="mt-5 rounded-[20px] border border-[#edf2f7] bg-[#f7fafd] p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[#007BFF]">
                  <CreditCard size={17} />
                </div>

                <div className="min-w-0">
                  <p className="font-mono text-sm font-black text-[#172033]">
                    {deleteTarget.uid}
                  </p>

                  <p className="mt-1 truncate text-xs font-semibold text-[#8291a4]">
                    {deleteTarget.employeeName || "Tanpa karyawan"} ·{" "}
                    {deleteTarget.employeeCode || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#f8e4b4] bg-[#fff7e5] p-4">
              <div className="flex items-start gap-3">
                <CircleAlert
                  size={17}
                  className="mt-0.5 shrink-0 text-[#f59e0b]"
                />

                <p className="text-xs font-bold leading-5 text-[#9a6700]">
                  Karyawan tetap tersimpan dan riwayat absensi tidak akan
                  dihapus. Setelah kartu dilepas, karyawan dapat mendaftarkan
                  kartu RFID baru.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={closeDeleteModal}
                className="h-12 rounded-2xl border border-[#dce6f1] bg-white text-sm font-bold text-[#64748b] disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => void unlinkCard()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ef4444] text-sm font-black text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Melepas...
                  </>
                ) : (
                  <>
                    <Link2Off size={15} />
                    Lepas Kartu
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* TOAST */}
      {/* ===================================================== */}

      {toast && (
        <div className="fixed right-4 top-4 z-[150] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6">
          <div
            className={[
              "flex items-start gap-3 rounded-[18px] border bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)]",

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
                <CircleCheck size={17} />
              ) : (
                <CircleAlert size={17} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[#172033]">
                {toast.type === "success" ? "Berhasil" : "Terjadi kesalahan"}
              </p>

              <p className="mt-1 text-xs font-semibold leading-5 text-[#64748b]">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9]"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
