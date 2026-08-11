"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton, Toast, Wordmark, type ToastType } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setToast({ message: data?.error ?? "Login failed", type: "error" });
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="w-full max-w-xs">
        <div className="mb-8 text-center">
          <Wordmark className="mx-auto justify-center" />
          <p className="mt-2 text-sm text-zinc-500">This display is locked — enter your PIN.</p>
        </div>
        <form
          onSubmit={submit}
          className="card-lift space-y-3 rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 backdrop-blur-sm"
        >
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            aria-label="Access PIN"
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-zinc-100 placeholder:tracking-normal placeholder:text-zinc-600 outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!pin || busy}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" /> Unlocking…
              </span>
            ) : (
              "Unlock"
            )}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-zinc-600">
          Tip: the app never sends your PIN anywhere except the login check.
        </p>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}