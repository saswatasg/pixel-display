"use client";

import { useState } from "react";
import type { AppStatus, Preset } from "@/lib/types";
import { deletePreset } from "@/lib/api";
import { Button, Card, Slider } from "./ui";

interface Props {
  status: AppStatus | null;
  presets: Preset[];
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onPresetChange: () => void;
}

export function HomeTab({ status, presets, onSend, onPresetChange }: Props) {
  const [powerOn, setPowerOn] = useState(true);
  const [brightness, setBrightness] = useState(50);
  const [busy, setBusy] = useState<string | null>(null);

  const connected = Boolean(status?.bridgeOnline && status.bridge?.device.connected);

  async function removePreset(id: string) {
    if (!confirm("Delete this preset?")) return;
    await deletePreset(id);
    onPresetChange();
  }

  async function togglePower() {
    const next = !powerOn;
    setBusy("power");
    const ok = await onSend("screen", { power: next ? "on" : "off" });
    if (ok) setPowerOn(next);
    setBusy(null);
  }

  async function changeBrightness(value: number) {
    setBrightness(value);
    if (value % 5 === 0 || value === 100) {
      await onSend("brightness", { value });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-zinc-100">
              {connected ? "Display is on" : "Display unavailable"}
            </p>
            <p className="text-sm text-zinc-400">
              {status?.bridge?.device.name ?? "Pixel Display"} ·{" "}
              {status?.bridge?.device.displaySize}x{status?.bridge?.device.displaySize}
            </p>
          </div>
          <Button onClick={togglePower} disabled={busy === "power" || !connected} variant={powerOn ? "ghost" : "primary"}>
            {powerOn ? "Screen off" : "Screen on"}
          </Button>
        </div>
        <div className="mt-4">
          <Slider
            label="Brightness"
            value={brightness}
            min={5}
            max={100}
            onChange={changeBrightness}
            format={(v) => `${v}%`}
          />
        </div>
      </Card>

      <Card title="Presets">
        {presets.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No presets yet. Open Text, Clock or Effects, set it up, then tap "Save as preset".
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <div key={preset.id} className="relative">
                <button
                  type="button"
                  disabled={busy === preset.id || !connected}
                  onClick={async () => {
                    setBusy(preset.id);
                    await onSend(preset.action, preset.payload);
                    setBusy(null);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-zinc-800/60 px-3 py-3 pr-8 text-left text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:opacity-40"
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => removePreset(preset.id)}
                  className="absolute right-1.5 top-1.5 rounded p-1 text-zinc-500 transition-colors hover:text-red-400"
                  aria-label={`Delete ${preset.name}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Connection">
        <div className="space-y-1.5 text-sm text-zinc-400">
          <p>
            Bridge:{" "}
            <span className={status?.bridgeOnline ? "text-emerald-400" : "text-red-400"}>
              {status?.bridgeOnline ? "online" : "offline"}
            </span>
          </p>
          <p>
            Device address:{" "}
            <span className="font-mono text-xs text-zinc-300">
              {status?.bridge?.device.address ?? "—"}
            </span>
          </p>
          {status?.bridge?.device.lastError && (
            <p className="text-amber-400">Last error: {status.bridge.device.lastError}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
