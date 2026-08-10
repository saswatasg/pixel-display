"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStatus, Preset } from "@/lib/types";
import { getStatus, listPresets, sendAction, deletePreset } from "@/lib/api";
import { NavBar, type Tab } from "@/components/NavBar";
import { StatusBar } from "@/components/StatusBar";
import { HomeTab } from "@/components/HomeTab";
import { TextTab } from "@/components/TextTab";
import { ImageTab } from "@/components/ImageTab";
import { ClockTab } from "@/components/ClockTab";
import { MoreTab } from "@/components/MoreTab";
import { Button, Card, Toast } from "@/components/ui";

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [toast, setToast] = useState<string | null>(null);
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

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const onSend = useCallback(
    async (action: string, payload: Record<string, unknown>): Promise<boolean> => {
      const res = await sendAction(action, payload);
      if (!res.ok) {
        showToast(res.error ?? "Command failed");
        refreshStatus();
        return false;
      }
      refreshStatus();
      return true;
    },
    [refreshStatus, showToast],
  );

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Pixel Display</h1>
          <p className="text-xs text-zinc-500">APEX / iDotMatrix 32×32</p>
        </div>
        <StatusBar status={status} />
      </header>

      {tab === "home" && (
        <HomeTab status={status} presets={presets} onSend={onSend} onPresetChange={refreshPresets} />
      )}
      {tab === "text" && <TextTab connected={connected} onSend={onSend} onToast={showToast} />}
      {tab === "image" && <ImageTab connected={connected} onSend={onSend} onToast={showToast} />}
      {tab === "clock" && <ClockTab connected={connected} onSend={onSend} onToast={showToast} />}
      {tab === "more" && <MoreTab connected={connected} onSend={onSend} onToast={showToast} />}

      <Toast message={toast} />
      <NavBar active={tab} onSelect={setTab} />
    </main>
  );
}
