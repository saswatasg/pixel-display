"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CLOCK_STYLES } from "@/lib/types";
import { createPreset } from "@/lib/api";
import type { AppPrefs } from "@/lib/prefs";
import type { PrefsPatch } from "@/lib/usePrefs";
import { Button, Card, Icon, ICONS, Toggle } from "./ui";
import { ColorPicker } from "./ColorPicker";
import { PresetDialog } from "./PresetDialog";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
  prefs?: AppPrefs | null;
  ready?: boolean;
  onPref?: (patch: PrefsPatch) => void;
}

export function ClockTab({ connected, onSend, onToast, prefs, ready, onPref }: Props) {
  const [style, setStyle] = useState(0);
  const [color, setColor] = useState("#FFFFFF");
  const [format24h, setFormat24h] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [syncTime, setSyncTime] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const applied = useRef(false);

  useEffect(() => {
    if (!ready || !prefs || applied.current) return;
    applied.current = true;
    setStyle(prefs.clock.style);
    setColor(prefs.clock.color);
    setFormat24h(prefs.clock.format24h);
    setShowDate(prefs.clock.showDate);
  }, [ready, prefs]);

  const payload = () => ({ style, color, format24h, showDate, syncTime });

  async function send() {
    setBusy(true);
    const ok = await onSend("clock", payload());
    setBusy(false);
    if (ok) onToast("Clock set");
  }

  async function savePreset(name: string) {
    await createPreset(name, "clock", payload());
    onToast("Preset saved");
  }

  return (
    <div className="space-y-5">
      <Card icon={<Icon d={ICONS.clock} className="h-5 w-5" />} title="Clock face" subtitle="8 styles to choose from">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(CLOCK_STYLES).map(([key, label]) => {
            const n = Number(key);
            const active = style === n;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStyle(n);
                  onPref?.({ clock: { style: n } });
                }}
                aria-pressed={active}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition-all ${
                  active
                    ? "border-amber-400 bg-amber-500/15 shadow-[0_0_20px_-6px_rgba(245,158,11,0.5)]"
                    : "border-white/[0.08] bg-zinc-800/50 text-zinc-400 hover:border-white/20 hover:bg-zinc-800"
                }`}
              >
                <ClockGlyph style={n} color={active ? color : "#71717a"} />
                <span className={`px-1 font-mono text-[9px] ${active ? "text-amber-300" : "text-zinc-500"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card icon={<Icon d={ICONS.sparkle} className="h-5 w-5" />} title="Options">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-zinc-300">Color</p>
            <ColorPicker
              value={color}
              onChange={(v) => {
                setColor(v);
                onPref?.({ clock: { color: v } });
              }}
            />
          </div>
          <div className="space-y-2">
            <Toggle
              label="24-hour format"
              description="Show 14:05 instead of 2:05 PM"
              checked={format24h}
              onChange={(v) => {
                setFormat24h(v);
                onPref?.({ clock: { format24h: v } });
              }}
            />
            <Toggle
              label="Show date"
              description="Display the current date too"
              checked={showDate}
              onChange={(v) => {
                setShowDate(v);
                onPref?.({ clock: { showDate: v } });
              }}
            />
            <Toggle label="Sync to device time" description="Push your Mac's time to the display" checked={syncTime} onChange={setSyncTime} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={send} disabled={busy || !connected}>
              <Icon d={ICONS.zap} className="h-4 w-4" />
              {busy ? "Sending…" : "Set clock"}
            </Button>
            <Button variant="ghost" onClick={() => setDialogOpen(true)}>
              <Icon d={ICONS.plus} className="h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      </Card>

      <PresetDialog
        open={dialogOpen}
        defaultName={`Clock style ${style + 1}`}
        onClose={() => setDialogOpen(false)}
        onSave={savePreset}
      />
    </div>
  );
}

const HANDS: Record<number, ReactNode> = {
  0: <ClockAnalog color="currentColor" />,
  1: <ClockTextDigital color="currentColor" />,
  2: <ClockBars color="currentColor" />,
  3: <ClockDigitalWin color="currentColor" />,
  4: <ClockMinimal color="currentColor" />,
  5: <ClockAnalog2 color="currentColor" />,
  6: <ClockText color="currentColor" />,
  7: <ClockDigitalWin color="currentColor" />,
};

function ClockGlyph({ style, color }: { style: number; color: string }) {
  const glyph = HANDS[style] ?? <ClockAnalog color={color} />;
  return (
    <span style={{ color }} className="flex h-8 w-8 items-center justify-center text-zinc-400">
      {glyph}
    </span>
  );
}

function ClockAnalog({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke={color} strokeWidth="1.6">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ClockAnalog2({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke={color} strokeWidth="2.2">
      <path d="M12 2v20M2 12h20" />
    </svg>
  );
}

function ClockTextDigital({ color }: { color: string }) {
  return (
    <span className="font-mono text-[10px] font-bold" style={{ color }}>
      88:88
    </span>
  );
}

function ClockDigitalWin({ color }: { color: string }) {
  return (
    <span className="font-mono text-[11px] font-bold leading-none" style={{ color }}>
      8:8
    </span>
  );
}

function ClockText({ color }: { color: string }) {
  return (
    <span className="font-mono text-[10px] font-bold" style={{ color }}>
      HH:MM
    </span>
  );
}

function ClockMinimal({ color }: { color: string }) {
  return (
    <span className="font-mono text-[10px] font-bold" style={{ color }}>
      08:00
    </span>
  );
}

function ClockBars({
  color,
}: {
  color: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill={color}>
      <rect x="3" y="10" width="4" height="8" rx="1" />
      <rect x="10" y="5" width="4" height="13" rx="1" />
      <rect x="17" y="8" width="4" height="10" rx="1" />
    </svg>
  );
}