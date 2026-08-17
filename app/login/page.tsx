"use client";

import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { auth } from "@/lib/firebase-auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [checkingAuth, setCheckingAuth] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
        return;
      }

      setCheckingAuth(false);
    });

    return unsubscribe;
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);

      await signInWithEmailAndPassword(auth, email.trim(), password);

      router.replace("/dashboard");
    } catch {
      setError("Email atau password salah. Silakan periksa kembali.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="size-9 animate-spin rounded-full border-4 border-[#dbe7f3] border-t-[#007BFF]" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_18%,#a9c9f2_0%,#d6e6fa_30%,#edf4fd_62%,#f4f7fb_100%)] px-5 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,123,255,0.10),_transparent_45%)]" />

      <div className="w-full max-w-[430px]">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <Image
              src="/images/nexty-labs-logo.png"
              alt="Nexty Labs"
              width={180}
              height={72}
              priority
              className="h-auto w-[155px] object-contain"
            />
          </div>

          <h1 className="text-3xl font-black tracking-[-0.04em] text-[#101828]">
            Selamat Datang
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Masuk untuk mengakses RFID Attendance Control Center.
          </p>
        </div>

        <div className="rounded-[28px] border border-[#dce6f1] bg-white p-6 shadow-[0_18px_55px_rgba(15,47,83,0.08)] sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-bold text-[#344054]"
              >
                Email
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98a2b3]"
                />

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@nextylabs.com"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-2xl border border-[#d0d9e5] bg-white pl-11 pr-4 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#007BFF] focus:ring-4 focus:ring-[#007BFF]/10"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-bold text-[#344054]"
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98a2b3]"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                  className="h-12 w-full rounded-2xl border border-[#d0d9e5] bg-white pl-11 pr-12 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#007BFF] focus:ring-4 focus:ring-[#007BFF]/10"
                />

                <button
                  type="button"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#98a2b3] transition hover:text-[#475467]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#b42318]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#007BFF] text-sm font-bold text-white shadow-lg shadow-[#007BFF]/20 transition hover:bg-[#006ee6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-[#98a2b3]">
          RFID Attendance System
        </p>
      </div>
    </main>
  );
}
