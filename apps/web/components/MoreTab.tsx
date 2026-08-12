"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ANIMATION_STYLES, type AutomationStatus } from "@/lib/types";
import { createPreset, validateUpload } from "@/lib/api";
import type { AppPrefs } from "@/lib/prefs";
import type { PrefsPatch } from "@/lib/usePrefs";
import { Button, Card, Icon, ICONS, Slider, type IconName, Spinner, Toggle } from "./ui";
import { ColorPicker } from "./ColorPicker";
import { PresetDialog } from "./PresetDialog";
import {
  deleteFrameMedia,
  listFrameMedia,
  toPixelDataUrl,
  uploadFrameMedia,
  type CloudMediaItem,
} from "@/lib/media";

const FRAME_LIMIT = 4;

interface Props {
  connected: boolean;
  automation?: AutomationStatus;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
  prefs?: AppPrefs | null;
  ready?: boolean;
  onPref?: (patch: PrefsPatch) => void;
}

export function MoreTab({ connected, automation, onSend, onToast, prefs, ready, onPref }: Props) {
  const [open, setOpen] = useState<string | null>("schedule");

  const sections: { id: string; icon: IconName; title: string; desc: string; render: ReactNode }[] = [
    {
      id: "schedule",
      icon: "clock",
      title: "Schedule",
      desc: "One daily timeline: weather by day, clock at night, wake at 8 AM.",
      render: <SchedulePanel connected={connected} automation={automation} onSend={onSend} onToast={onToast} />,
    },
    {
      id: "stockticker",
      icon: "sparkle",
      title: "Stock ticker",
      desc: "Line up symbols and scroll prices on the display.",
      render: <StockTickerPanel connected={connected} onSend={onSend} onToast={onToast} prefs={prefs} ready={ready} onPref={onPref} />,
    },
    {
      id: "photoframe",
      icon: "image",
      title: "Photo frame",
      desc: "Store images in the cloud and cycle them like a slideshow.",
      render: <PhotoFramePanel connected={connected} onSend={onSend} onToast={onToast} prefs={prefs} ready={ready} onPref={onPref} />,
    },
    {
      id: "chronograph",
      icon: "timer",
      title: "Chronograph",
      desc: "Start, pause and reset a stopwatch on the display.",
      render: <ChronographPanel connected={connected} onSend={onSend} onToast={onToast} />,
    },
    {
      id: "countdown",
      icon: "timer",
      title: "Countdown",
      desc: "Set a minute/second countdown timer.",
      render: <CountdownPanel connected={connected} onSend={onSend} onToast={onToast} />,
    },
    {
      id: "color",
      icon: "zap",
      title: "Fullscreen color",
      desc: "Fill the whole matrix with one color.",
      render: <FullscreenPanel connected={connected} onSend={onSend} onToast={onToast} />,
    },
    {
      id: "animation",
      icon: "sparkle",
      title: "Animated effects",
      desc: "Auto-running rainbow and noise patterns.",
      render: <AnimationPanel connected={connected} onSend={onSend} onToast={onToast} />,
    },
    {
      id: "scoreboard",
      icon: "scoreboard",
      title: "Scoreboard",
      desc: "Two numbers up to 999 — great for games.",
      render: <ScoreboardPanel connected={connected} onSend={onSend} onToast={onToast} />,
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const isOpen = open === section.id;
        return (
          <Card key={section.id} className="">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : section.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isOpen ? "bg-amber-500/15 text-amber-400" : "bg-white/[0.04] text-zinc-400"
                }`}
              >
                <Icon d={ICONS[section.icon]} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-100">{section.title}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500">{section.desc}</span>
              </span>
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {isOpen && <div className="animate-fade-in border-t border-white/[0.06] px-5 py-4">{section.render}</div>}
          </Card>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{children}</p>;
}

function StockTickerPanel({
  connected,
  onSend,
  onToast,
  prefs,
  ready,
  onPref,
}: Pick<Props, "connected" | "onSend" | "onToast" | "prefs" | "ready" | "onPref">) {
  const [symbols, setSymbols] = useState("AAPL, NVDA");
  const [color, setColor] = useState("#7CFF6B");
  const [interval, setIntervalMin] = useState(10);
  const [speed, setSpeed] = useState(80);
  const [busy, setBusy] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const applied = useRef(false);

  useEffect(() => {
    if (!ready || !prefs || applied.current) return;
    applied.current = true;
    setSymbols(prefs.ticker.symbols);
    setColor(prefs.ticker.color);
    setIntervalMin(prefs.ticker.interval);
    setSpeed(prefs.ticker.speed);
  }, [ready, prefs]);

  const list = () => symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  const savePreset = async (name: string) => {
    const syms = list();
    if (syms.length === 0) {
      onToast("Add at least one symbol");
      return;
    }
    await createPreset(name, "stocks", { symbols: syms, color, interval, speed });
    onToast("Ticker saved as preset");
  };

  const apply = async () => {
    const syms = list();
    if (syms.length === 0) {
      onToast("Add at least one symbol");
      return;
    }
    if (syms.length > FRAME_LIMIT) {
      onToast(`Up to ${FRAME_LIMIT} symbols on the ticker`);
      return;
    }
    setBusy(true);
    try {
      const ok = await onSend("stocks", { symbols: syms, color, interval, speed });
      if (ok) onToast(`Ticker on — ${syms.join(", ")}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Symbols — up to {FRAME_LIMIT}, comma separated</SectionLabel>
        <input
          type="text"
          value={symbols}
          onChange={(e) => {
            setSymbols(e.target.value);
            onPref?.({ ticker: { symbols: e.target.value } });
          }}
          placeholder="AAPL, NVDA or RELIANCE.NS, TCS.NS, INFY.NS, HDFCBANK.NS"
          className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-2.5 font-mono text-sm uppercase text-zinc-100 placeholder:font-sans placeholder:normal-case placeholder:text-zinc-600 outline-none focus:border-amber-500"
          aria-label="Stock symbols"
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          Indian listings work too — NSE: <span className="font-mono">.NS</span> (e.g. RELIANCE.NS, TCS.NS) · BSE:{" "}
          <span className="font-mono">.BO</span>. The display rotates one symbol at a time showing today&apos;s %
          change, refreshed every {interval} min.
        </p>
      </div>
      <div>
        <SectionLabel>Ticker color</SectionLabel>
        <ColorPicker
          value={color}
          onChange={(v) => {
            setColor(v);
            onPref?.({ ticker: { color: v } });
          }}
        />
      </div>
      <Slider
        label="Refresh quotes"
        value={interval}
        min={5}
        max={120}
        step={5}
        onChange={(v) => {
          setIntervalMin(v);
          onPref?.({ ticker: { interval: v } });
        }}
        format={(v) => `${v} min`}
        marks={[5, 30, 60, 120]}
      />
      <Slider
        label="Scroll speed"
        value={speed}
        min={10}
        max={255}
        step={5}
        onChange={(v) => {
          setSpeed(v);
          onPref?.({ ticker: { speed: v } });
        }}
        format={(v) => String(v)}
        marks={[10, 80, 160, 255]}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={apply} disabled={busy || !connected}>
          {busy ? <Spinner className="h-4 w-4" /> : <Icon d={ICONS.play} className="h-4 w-4" />}
          Start ticker
        </Button>
        <Button variant="ghost" disabled={busy || !connected} onClick={() => setSavingPreset(true)}>
          <Icon d={ICONS.star} className="h-4 w-4" /> Save
        </Button>
        <Button
          variant="ghost"
          disabled={busy || !connected}
          onClick={async () => {
            const ok = await onSend("automation-off", {});
            if (ok) onToast("Ticker stopped");
          }}
        >
          Stop
        </Button>
      </div>
      <PresetDialog
        defaultName={`Ticker — ${list().slice(0, 3).join(", ")}`}
        open={savingPreset}
        onClose={() => setSavingPreset(false)}
        onSave={savePreset}
      />
    </div>
  );
}

function PhotoFramePanel({
  connected,
  onSend,
  onToast,
  prefs,
  ready,
  onPref,
}: Pick<Props, "connected" | "onSend" | "onToast" | "prefs" | "ready" | "onPref">) {
  const [media, setMedia] = useState<CloudMediaItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [intervalSec, setIntervalSec] = useState(20);
  const [shuffle, setShuffle] = useState(false);
  const applied = useRef(false);

  useEffect(() => {
    if (!ready || !prefs || applied.current) return;
    applied.current = true;
    setIntervalSec(prefs.frame.interval);
    setShuffle(prefs.frame.shuffle);
  }, [ready, prefs]);

  const refresh = useCallback(async () => {
    try {
      setMedia(await listFrameMedia());
    } catch {
      setMedia([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadFile = async (file: File) => {
    const issue = file.type.startsWith("image/") ? validateUpload(file) : `${file.name} is not an image`;
    if (issue) {
      onToast(issue);
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await toPixelDataUrl(file);
      if (!dataUrl) {
        onToast("Could not read that image");
        return;
      }
      const res = await uploadFrameMedia(dataUrl, file.name);
      if (res.ok) {
        onToast("Saved to photo frame (cloud) — " + file.name);
        refresh();
      } else {
        onToast(res.error ?? "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    const res = await deleteFrameMedia(id);
    if (res.ok) {
      onToast("Removed from frame");
      refresh();
    } else {
      onToast(res.error ?? "Remove failed");
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      const synced = await onSend("media-sync", {});
      if (!synced) {
        onToast("Photo frame could not be started (bridge offline)");
        return;
      }
      const ok = await onSend("slideshow", { interval: intervalSec, shuffle });
      if (ok) onToast("Photo frame on");
    } finally {
      setBusy(false);
    }
  };

  const power = async (mode: "on" | "off") => {
    setBusy(true);
    try {
      const ok = await onSend("screen", { power: mode });
      if (ok) onToast(mode === "off" ? "Display powered off — automations stopped" : "Display powered on");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Photos are stored in the cloud and converted to 32×32 pixels</span>
        <span className="font-mono">{media === null ? "…" : `${media.length} / ${FRAME_LIMIT}`}</span>
      </div>
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors ${
          media === null || (media?.length ?? 0) < FRAME_LIMIT
            ? "border-white/20 text-zinc-400 hover:border-amber-400/60 hover:text-zinc-200"
            : "pointer-events-none border-white/5 text-zinc-600"
        }`}
      >
        <Icon d={ICONS.plus} className="h-4 w-4" />
        {uploading
          ? "Uploading…"
          : (media?.length ?? 0) >= FRAME_LIMIT
            ? `Frame full (${FRAME_LIMIT} photos) — remove one first`
            : "Upload a photo to the frame"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {media === null ? (
        <Spinner className="mx-auto block" />
      ) : media.length === 0 ? (
        <p className="text-center text-xs text-zinc-500">Frame is empty — upload a photo first.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {media.map((m) => (
            <div key={m.id} className="group w-16 shrink-0">
              <div className="relative overflow-hidden rounded-lg border border-white/15 bg-black">
                <img src={m.url} alt={m.name} className="aspect-square w-full" style={{ imageRendering: "pixelated" }} />
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => remove(m.id)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-zinc-950/80 text-zinc-400 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <Icon d={ICONS.close} className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-1 truncate text-[10px] text-zinc-500" title={m.name}>
                {m.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {media && media.length > 0 && (
        <>
          <Slider
            label="Photo interval"
            value={intervalSec}
            min={5}
            max={300}
            step={5}
            onChange={(v) => {
              setIntervalSec(v);
              onPref?.({ frame: { interval: v } });
            }}
            format={(v) => `${v}s`}
            marks={[5, 20, 60, 120, 300]}
          />
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Shuffle photos
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => {
                setShuffle(e.target.checked);
                onPref?.({ frame: { shuffle: e.target.checked } });
              }}
              className="h-4 w-4 accent-amber-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={start} disabled={busy || !connected}>
              {busy ? <Spinner className="h-4 w-4" /> : <Icon d={ICONS.play} className="h-4 w-4" />}
              Start frame
            </Button>
            <Button
              variant="ghost"
              disabled={busy || !connected}
              onClick={async () => {
                const ok = await onSend("slideshow-next", {});
                if (ok) onToast("Next photo");
              }}
            >
              Next
            </Button>
            <Button
              variant="ghost"
              disabled={busy || !connected}
              onClick={async () => {
                const ok = await onSend("automation-off", {});
                if (ok) onToast("Frame stopped");
              }}
            >
              Stop
            </Button>
          </div>
        </>
      )}

      <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Display power</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy || !connected}
            onClick={() => power("off")}
            className="!bg-red-500/15 !text-red-300 hover:!bg-red-500/25"
          >
            <Icon d={ICONS.power} className="h-3.5 w-3.5" /> Turn off display
          </Button>
          <Button size="sm" variant="ghost" disabled={busy || !connected} onClick={() => power("on")}>
            <Icon d={ICONS.power} className="h-3.5 w-3.5" /> Turn on
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Powering off also stops the slideshow and any other automation — the display stays off until you turn it
          back on.
        </p>
      </div>
    </div>
  );
}

interface Slot {
  start: string;
  end: string;
  program: string;
  config: Record<string, unknown>;
}

const SLOT_PROGRAMS = ["weather", "stocks", "slideshow", "clock", "effect", "text"];

const DEFAULT_SLOTS: Slot[] = [
  { start: "08:00", end: "20:00", program: "clock", config: {} },
  { start: "20:00", end: "23:59", program: "effect", config: {} },
];

const SORTED = (slots: Slot[]) => [...slots].sort((a, b) => a.start.localeCompare(b.start));

function SchedulePanel({
  connected,
  automation,
  onSend,
  onToast,
}: Pick<Props, "connected" | "automation" | "onSend" | "onToast">) {
  const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS);
  const [wakeEnabled, setWakeEnabled] = useState(true);
  const [wakeTime, setWakeTime] = useState("08:00");
  const [wakeProgram, setWakeProgram] = useState<"clock" | "image">("clock");
  const [busy, setBusy] = useState(false);

  // Seed the editor from the live schedule once it arrives.
  useEffect(() => {
    if (automation?.schedule && automation.schedule.length > 0) {
      setSlots(
        SORTED(
          automation.schedule.map((s) => ({
            start: s.start,
            end: s.end,
            program: s.program,
            config: s.config ?? {},
          })),
        ),
      );
    }
  }, [automation?.schedule]);

  useEffect(() => {
    if (automation?.wake) {
      setWakeEnabled(automation.wake.enabled);
      setWakeTime(automation.wake.time);
      setWakeProgram(automation.wake.program);
    }
  }, [automation?.wake]);

  const setSlot = (i: number, patch: Partial<Slot>) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const applySchedule = async () => {
    const valid = slots.every((s) => /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end));
    if (!valid) {
      onToast("Times must use HH:MM");
      return;
    }
    setBusy(true);
    try {
      const ok = await onSend("schedule", {
        enabled: true,
        slots: slots.map((s) => ({ start: s.start, end: s.end, program: s.program, config: s.config })),
      });
      if (ok) onToast("Schedule applied");
    } finally {
      setBusy(false);
    }
  };

  const applyWake = async () => {
    if (!/^\d{2}:\d{2}$/.test(wakeTime)) {
      onToast("Time must use HH:MM");
      return;
    }
    setBusy(true);
    try {
      const ok = await onSend("wake", { enabled: wakeEnabled, time: wakeTime, program: wakeProgram });
      if (ok) onToast(wakeEnabled ? `Wake set for ${wakeTime} IST` : "Wake disabled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Day timeline — earliest matching time wins (times can wrap past midnight)</SectionLabel>
        <div className="space-y-2">
          {SORTED(slots).map((slot, i) => {
            const sortedIdx = slots.indexOf(slot);
            return (
              <div key={`${slot.start}-${slot.program}-${i}`} className="flex items-center gap-2">
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) => setSlot(sortedIdx, { start: e.target.value })}
                  className="w-[92px] rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-amber-500"
                  aria-label={`Slot ${i + 1} start`}
                />
                <span className="text-zinc-600">→</span>
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) => setSlot(sortedIdx, { end: e.target.value })}
                  className="w-[92px] rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-amber-500"
                  aria-label={`Slot ${i + 1} end`}
                />
                <select
                  value={slot.program}
                  onChange={(e) => setSlot(sortedIdx, { program: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500"
                  aria-label={`Slot ${i + 1} program`}
                >
                  {SLOT_PROGRAMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Remove slot"
                  onClick={() => setSlots((prev) => prev.filter((_, idx) => idx !== sortedIdx))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-500 hover:text-red-400"
                >
                  <Icon d={ICONS.trash} className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSlots((prev) => [...prev, { start: "08:00", end: "20:00", program: "clock", config: {} }])
            }
          >
            <Icon d={ICONS.plus} className="h-3.5 w-3.5" /> Add slot
          </Button>
          <div className="grow" />
          <Button onClick={applySchedule} disabled={busy || !connected || slots.length === 0}>
            {busy ? <Spinner className="h-4 w-4" /> : <Icon d={ICONS.play} className="h-4 w-4" />}
            Apply schedule
          </Button>
          <Button
            variant="ghost"
            disabled={busy || !connected}
            onClick={async () => {
              const ok = await onSend("automation-off", {});
              if (ok) {
                onToast("Schedule cleared");
                setSlots(DEFAULT_SLOTS);
              }
            }}
          >
            Stop
          </Button>
        </div>
        {automation?.enabled && automation.error && (
          <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
            Last run failed: {automation.error}
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-white/[0.08] bg-zinc-950/50 p-4">
        <SectionLabel>Morning wake (IST)</SectionLabel>
        <Toggle
          label="Wake the display every morning"
          description="Turns the display back on at the set time — even if it was powered off."
          checked={wakeEnabled}
          onChange={setWakeEnabled}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <SectionLabel>Time (IST)</SectionLabel>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-2.5 font-mono text-sm text-zinc-200 outline-none focus:border-amber-500"
              aria-label="Wake time"
            />
          </div>
          <div>
            <SectionLabel>Show at wake</SectionLabel>
            <select
              value={wakeProgram}
              onChange={(e) => setWakeProgram(e.target.value as "clock" | "image")}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-amber-500"
              aria-label="Wake program"
            >
              <option value="clock">Clock</option>
              <option value="image">Photo (last frame photo)</option>
            </select>
          </div>
        </div>
        <Button onClick={applyWake} disabled={busy || !connected}>
          {wakeEnabled ? "Schedule wake" : "Disable wake"}
        </Button>
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Runs on the bridge at {wakeTime} IST every day. It only starts the{" "}
          {wakeProgram === "clock" ? "clock" : "photo frame"} if nothing was already scheduled, so a running
          program is never replaced. Setting the wake after its time has passed schedules it for the next morning
          instead of firing immediately.
        </p>
      </div>
    </div>
  );
}

function ChronographPanel({
  connected,
  onSend,
  onToast,
}: Pick<Props, "connected" | "onSend" | "onToast">) {
  const actions: { mode: string; label: string; variant: "primary" | "ghost" }[] = [
    { mode: "start", label: "Start", variant: "primary" },
    { mode: "pause", label: "Pause", variant: "ghost" },
    { mode: "resume", label: "Resume", variant: "ghost" },
    { mode: "reset", label: "Reset", variant: "ghost" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.mode}
          variant={a.variant}
          disabled={!connected}
          onClick={async () => {
            const ok = await onSend("chronograph", { mode: a.mode });
            if (ok) onToast(`Chronograph ${a.label.toLowerCase()}`);
          }}
        >
          <Icon d={a.mode === "start" ? ICONS.play : a.mode === "pause" ? ICONS.pause : a.mode === "reset" ? ICONS.reset : ICONS.play} className="h-4 w-4" />
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function CountdownPanel({ connected, onSend, onToast }: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        <NumberField value={minutes} onChange={setMinutes} max={99} label="min" />
        <span className="pb-5 text-xl text-zinc-600">:</span>
        <NumberField value={seconds} onChange={setSeconds} max={59} label="sec" />
        <Button
          className="ml-2"
          disabled={!connected || (minutes === 0 && seconds === 0)}
          onClick={async () => {
            const ok = await onSend("countdown", { seconds: minutes * 60 + seconds });
            if (ok) onToast("Countdown started");
          }}
        >
          Start
        </Button>
        <Button
          variant="ghost"
          disabled={!connected}
          onClick={async () => {
            const ok = await onSend("countdown", { cancel: true });
            if (ok) onToast("Countdown cancelled");
          }}
        >
          Cancel
        </Button>
      </div>
      <div className="flex justify-center gap-1.5">
        {[30, 60, 300].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setMinutes(Math.floor(s / 60));
              setSeconds(s % 60);
            }}
            className="rounded-lg bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {s >= 60 ? `${Math.floor(s / 60)}m` : `${s}s`}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberField({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
        className="w-20 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-center font-mono text-2xl text-zinc-100 outline-none focus:border-amber-500"
        aria-label={label}
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">{label}</span>
    </div>
  );
}

function FullscreenPanel({ connected, onSend, onToast }: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [color, setColor] = useState("#000000");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ColorPicker value={color} onChange={setColor} />
      <Button
        disabled={!connected}
        onClick={async () => {
          const ok = await onSend("fullscreen-color", { color });
          if (ok) onToast("Color applied");
        }}
      >
        Apply
      </Button>
    </div>
  );
}

function AnimationPanel({ connected, onSend, onToast }: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(90);
  const [savingPreset, setSavingPreset] = useState(false);
  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Pattern</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {Object.entries(ANIMATION_STYLES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStyle(Number(key))}
              aria-pressed={style === Number(key)}
              className={`rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                style === Number(key)
                  ? "bg-amber-500 text-zinc-950 shadow-[0_4px_14px_-4px_rgba(245,158,11,0.6)]"
                  : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Slider
        label="Animation speed"
        value={speed}
        min={1}
        max={255}
        step={5}
        onChange={setSpeed}
        format={(v) => String(v)}
        marks={[1, 90, 180, 255]}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!connected}
          onClick={async () => {
            const ok = await onSend("animation", { style, colors: null, speed });
            if (ok) onToast("Effect playing");
          }}
        >
          <Icon d={ICONS.play} className="h-4 w-4" /> Play effect
        </Button>
        <Button variant="ghost" disabled={!connected} onClick={() => setSavingPreset(true)}>
          <Icon d={ICONS.star} className="h-4 w-4" /> Save
        </Button>
      </div>
      <PresetDialog
        defaultName={`Effect — ${ANIMATION_STYLES[style as keyof typeof ANIMATION_STYLES] ?? style}`}
        open={savingPreset}
        onClose={() => setSavingPreset(false)}
        onSave={async (name) => {
          await createPreset(name, "animation", { style, colors: null, speed });
          onToast("Effect saved as preset");
        }}
      />
    </div>
  );
}

function ScoreboardPanel({ connected, onSend, onToast }: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);

  const bump = (setter: (fn: (v: number) => number) => void, delta: number) => {
    setter((v) => Math.max(0, Math.min(999, v + delta)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-6">
        {[score1, score2].map((score, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600">{i === 0 ? "Team A" : "Team B"}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => bump(i === 0 ? setScore1 : setScore2, -1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-800/70 text-lg font-bold text-zinc-200 transition-transform hover:bg-zinc-700 active:scale-90"
                aria-label={`Decrease team ${i === 0 ? "A" : "B"}`}
              >
                −
              </button>
              <span className="w-14 rounded-xl border border-white/[0.08] bg-zinc-950 py-2 text-center font-mono text-2xl font-bold text-amber-300">
                {score}
              </span>
              <button
                type="button"
                onClick={() => bump(i === 0 ? setScore1 : setScore2, 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-800/70 text-lg font-bold text-zinc-200 transition-transform hover:bg-zinc-700 active:scale-90"
                aria-label={`Increase team ${i === 0 ? "A" : "B"}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center">
        <Button
          disabled={!connected}
          onClick={async () => {
            const ok = await onSend("scoreboard", { score1, score2 });
            if (ok) onToast("Scoreboard updated");
          }}
        >
          <Icon d={ICONS.scoreboard} className="h-4 w-4" /> Show on display
        </Button>
      </div>
    </div>
  );
}