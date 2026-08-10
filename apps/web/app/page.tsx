"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStatus, Preset } from "@/lib/types";
import { getStatus, listPresets, sendAction } from "@/lib/api";
import { NavBar, type Tab } from "@/components/NavBar";
import { StatusBar } from "@/components/StatusBar";
import { HomeTab } from "@/components/HomeTab";
import { TextTab } from "@/components/TextTab";
import { ImageTab } from "@/components/ImageTab";
import { ClockTab } from "@/components/ClockTab";
import { MoreTab } from "@/components/MoreTab";
import { WeatherTab } from "@/components/WeatherTab";
import { Skeleton, Toast, Wordmark, type ToastType } from "@/components/ui";

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatus(await getStatus());
  }, []);

  const refreshPresets = useCallback(async () => {
    setPresets(await listPresets());
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshPresets();
    const interval = setInterval(refreshStatus, 3000);
    return () => clearInterval(interval);
  }, [refreshStatus, refreshPresets]);

  const connected = Boolean(status?.bridgeOnline && status.bridge?.device.connected);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const onSend = useCallback(
    async (action: string, payload: Record<string, unknown>): Promise<boolean> => {
      const res = await sendAction(action, payload);
      if (!res.ok) {
        showToast(res.error ?? "Command failed", "error");
        refreshStatus();
        return false;
      }
      refreshStatus();
      return true;
    },
    [refreshStatus, showToast],
  );

  return (
    <main className="relative mx-auto min-h-screen max-w-md px-4 pb-32 pt-5">
      {/* decorative grid backdrop */}
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <header className="mb-6 flex items-center justify-between gap-3">
        <Wordmark />
        <StatusBar status={status} />
      </header>

      <div key={tab} className="animate-fade-up">
        {tab === "home" && (
          <HomeTab status={status} presets={presets} onSend={onSend} onPresetChange={refreshPresets} />
        )}
        {tab === "text" && <TextTab connected={connected} onSend={onSend} onToast={showToast} />}
        {tab === "image" && <ImageTab connected={connected} onSend={onSend} onToast={showToast} />}
        {tab === "clock" && <ClockTab connected={connected} onSend={onSend} onToast={showToast} />}
        {tab === "weather" && <WeatherTab connected={connected} onSend={onSend} onToast={showToast} />}
        {tab === "more" && <MoreTab connected={connected} onSend={onSend} onToast={showToast} />}
      </div>

      {status === null && (
        <div className="mt-5 space-y-3 animate-fade-in">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <NavBar active={tab} onSelect={setTab} />
    </main>
  );
}