"use client";

import { useMemo, useState } from "react";
import type { AppStatus, Preset } from "@/lib/types";
import { deletePreset } from "@/lib/api";
import { Button, Card, Icon, ICONS, IconButton, Slider, type IconName } from "./ui";
import { DisplayBezel } from "./DisplayBezel";
import { LiveClock } from "./LiveClock";

interface Props {
  status: AppStatus | null;
  presets: Preset[];
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onPresetChange: () => void;
}

const PRESET_META: Record<string, { icon: IconName; label: string }> = {
  text: { icon: "text", label: "Text" },
  clock: { icon: "clock", label: "Clock" },
  animation: { icon: "sparkle", label: "Effect" },
  "fullscreen-color": { icon: "zap", label: "Color" },
  scoreboard: { icon: "scoreboard", label: "Score" },
  chronograph: { icon: "timer", label: "Timer" },
  countdown: { icon: "timer", label: "Countdown" },
  brightness: { icon: "sun", label: "Light" },
};

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function HomeTab({ status, presets, onSend, onPresetChange }: Props) {
  const [powerOn, setPowerOn] = useState(true);
  const [brightness, setBrightness] = useState(50);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const connected = Boolean(status?.bridgeOnline && status.bridge?.device.connected);
  const address = status?.bridge?.device.address;

  const sortedPresets = useMemo(
    () => [...presets].sort((a, b) => b.createdAt - a.createdAt),
    [presets],
  );

  async function removePreset(id: string) {
    await deletePreset(id);
    setConfirmDelete(null);
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

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-5">
      {/* Hero: live display */}
      <div className="relative">
        <DisplayBezel powered={connected && powerOn}>
          <LiveClock powered={connected && powerOn} size={184} />
        </DisplayBezel>

        {!connected && status && (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-zinc-900/70 px-4 py-3 text-center text-xs text-zinc-400 animate-fade-up">
            {status.reason ?? "The display is unreachable. Keep the bridge running on your Mac."}
          </div>
        )}
      </div>

      {/* Display controls */}
      <Card
        icon={<Icon d={ICONS.power} className="h-5 w-5" />}
        title="Display"
        subtitle={connected ? (powerOn ? "On and ready" : "Powered off") : "Not connected"}
        action={
          <Button
            onClick={togglePower}
            disabled={busy === "power" || !connected}
            variant={powerOn ? "ghost" : "primary"}
            size="sm"
          >
            {powerOn ? "Screen off" : "Screen on"}
          </Button>
        }
      >
        <Slider
          label="Brightness"
          value={brightness}
          min={5}
          max={100}
          step={5}
          onChange={changeBrightness}
          format={(v) => `${v}%`}
          marks={[5, 50, 100]}
        />
      </Card>

      {/* Presets */}
      <Card
        icon={<Icon d={ICONS.zap} className="h-5 w-5" />}
        title="Presets"
        subtitle={presets.length > 0 ? `${presets.length} saved · tap to play` : "One-tap scenes"}
        action={
          presets.length > 0 ? (
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 font-mono text-[11px] text-zinc-300">
              {presets.length}
            </span>
          ) : undefined
        }
      >
        {sortedPresets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
            No presets yet. Build something in{" "}
            <span className="text-zinc-300">Text</span>, <span className="text-zinc-300">Clock</span> or{" "}
            <span className="text-zinc-300">Effects</span>, then save it with the{" "}
            <span className="text-amber-300">＋ Save</span> button.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {sortedPresets.map((preset) => {
              const meta = PRESET_META[preset.action] ?? { icon: "zap" as IconName, label: "Scene" };
              const isBusy = busy === preset.id;
              const confirming = confirmDelete === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`group relative overflow-hidden rounded-xl border transition-all ${
                    confirming
                      ? "border-red-500/50 bg-red-500/10"
                      : "border-white/[0.08] bg-zinc-800/50 hover:border-white/20"
                  }`}
                >
                  <button
                    type="button"
                    disabled={isBusy || !connected}
                    onClick={async () => {
                      setBusy(preset.id);
                      const ok = await onSend(preset.action, preset.payload);
                      setBusy(null);
                      if (!ok) setConfirmDelete(null);
                    }}
                    className={`absolute inset-0 ${confirming ? "pointer-events-none" : ""}`}
                    aria-label={`Play preset ${preset.name}`}
                  />
                  <div className="relative flex flex-col gap-2 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                        <Icon d={ICONS[meta.icon]} className="h-4 w-4" />
                      </span>
                      {confirming ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => removePreset(preset.id)}
                            className="rounded-md bg-red-500/20 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/30"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-md bg-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-600"
                          >
                            Keep
                          </button>
                        </span>
                      ) : (
                        <IconButton
                          icon="trash"
                          label={`Delete ${preset.name}`}
                          onClick={() => setConfirmDelete(preset.id)}
                          className="h-7 w-7 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">{preset.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500">
                        <span className="text-zinc-400">{meta.label}</span>
                        <span>·</span>
                        <span>{formatRelative(preset.createdAt)}</span>
                        {isBusy && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Connection */}
      {address && (
        <Card
          icon={<Icon d={ICONS.link} className="h-5 w-5" />}
          title="Connection"
          subtitle="Bridge → Bluetooth → display"
        >
          <div className="space-y-2.5">
            <Row label="Bridge" value={status?.bridgeOnline ? "online" : "offline"} tone={status?.bridgeOnline ? "good" : "bad"} />
            <Row
              label="Display"
              value={connected ? status?.bridge?.device.name ?? "connected" : "not connected"}
              tone={connected ? "good" : "bad"}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Address</span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
                <span className="max-w-[150px] truncate">{address}</span>
                <IconButton icon={copied ? "check" : "copy"} label="Copy address" onClick={copyAddress} className="h-7 w-7" />
              </span>
            </div>
            <Row
              label="Last action"
              value={
                status?.bridge?.device.lastAction
                  ? `${status.bridge.device.lastAction.action} · ${formatRelative(status.bridge.device.lastAction.at * 1000)}`
                  : "nothing yet"
              }
            />
            {status?.bridge?.device.lastError && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                Last error: {status.bridge.device.lastError}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-zinc-300";
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-xs ${color}`}>{value}</span>
    </div>
  );
}