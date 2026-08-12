"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStatus, Preset } from "@/lib/types";
import { getStatus, listPresets, sendAction } from "@/lib/api";
import { usePrefs } from "@/lib/usePrefs";
import { NavBar, type Tab } from "@/components/NavBar";
import { StatusBar } from "@/components/StatusBar";
import { HomeTab } from "@/components/HomeTab";
import { TextTab } from "@/components/TextTab";
import { ImageTab } from "@/components/ImageTab";
import { ClockTab } from "@/components/ClockTab";
import { MoreTab } from "@/components/MoreTab";
import { WeatherTab } from "@/components/WeatherTab";
import { Icon, ICONS, Skeleton, Toast, Wordmark, type ToastType } from "@/components/ui";

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null);
  const [online, setOnline] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { prefs, ready: prefsReady, updatePrefs } = usePrefs();

  const refreshPresets = useCallback(async () => {
    setPresets(await listPresets());
  }, []);

  // Adaptive status polling: 3s when healthy, back off (3s → 30s, with jitter)
  // while the bridge is unreachable, and pause entirely while the tab is
  // hidden so background tabs aren't churning the API.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hidden = document.hidden;
    let failures = 0;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled || hidden) return;
      const base = 3000 * Math.min(2 ** failures, 8);
      timer = setTimeout(() => void tick(), base + Math.random() * 1000);
    };

    const tick = async () => {
      const next = await getStatus();
      if (cancelled) return;
      setStatus(next);
      failures = next.bridgeOnline ? 0 : failures + 1;
      scheduleNext();
    };

    const onVisibility = () => {
      hidden = document.hidden;
      if (hidden) {
        if (timer) clearTimeout(timer);
      } else {
        failures = 0;
        void tick();
      }
    };

    void tick();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const connected = Boolean(status?.bridgeOnline && status.bridge?.device.connected);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshStatus = useCallback(async () => {
    setStatus(await getStatus());
  }, []);

  const onSend = useCallback(
    async (action: string, payload: Record<string, unknown>): Promise<boolean> => {
      const res = await sendAction(action, payload);
      if (!res.ok) {
        showToast(res.error ?? "Command failed", "error");
        void refreshStatus();
        return false;
      }
      void refreshStatus();
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

      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200 animate-fade-up">
          <Icon d={ICONS.alert} className="h-4 w-4 shrink-0" />
          You&apos;re offline — commands won&apos;t reach the display until you reconnect.
        </div>
      )}

      <div key={tab} className="animate-fade-up">
        {tab === "home" && (
          <HomeTab
            status={status}
            presets={presets}
            onSend={onSend}
            onPresetChange={refreshPresets}
            prefs={prefs}
            ready={prefsReady}
            onPref={updatePrefs}
          />
        )}
        {tab === "text" && (
          <TextTab connected={connected} onSend={onSend} onToast={showToast} prefs={prefs} ready={prefsReady} onPref={updatePrefs} />
        )}
        {tab === "image" && <ImageTab connected={connected} onSend={onSend} onToast={showToast} />}
        {tab === "clock" && (
          <ClockTab connected={connected} onSend={onSend} onToast={showToast} prefs={prefs} ready={prefsReady} onPref={updatePrefs} />
        )}
        {tab === "weather" && (
          <WeatherTab connected={connected} onSend={onSend} onToast={showToast} prefs={prefs} ready={prefsReady} onPref={updatePrefs} />
        )}
        {tab === "more" && (
          <MoreTab
            connected={connected}
            automation={status?.bridge?.automation}
            onSend={onSend}
            onToast={showToast}
            prefs={prefs}
            ready={prefsReady}
            onPref={updatePrefs}
          />
        )}
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