"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ANIMATION_STYLES } from "@/lib/types";
import type { MediaItem } from "@/lib/types";
import { sendFile } from "@/lib/api";
import { Button, Card, Icon, ICONS, Slider, type IconName, Spinner } from "./ui";
import { ColorPicker } from "./ColorPicker";

const FRAME_LIMIT = 4;

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

export function MoreTab({ connected, onSend, onToast }: Props) {
  const [open, setOpen] = useState<string | null>("chronograph");

  const sections: { id: string; icon: IconName; title: string; desc: string; render: ReactNode }[] = [
    {
      id: "stockticker",
      icon: "sparkle",
      title: "Stock ticker",
      desc: "Line up symbols and scroll prices on the display.",
      render: <StockTickerPanel connected={connected} onSend={onSend} onToast={onToast} />,
    },
    {
      id: "photoframe",
      icon: "image",
      title: "Photo frame",
      desc: "Store images on the bridge and cycle them like a slideshow.",
      render: <PhotoFramePanel connected={connected} onSend={onSend} onToast={onToast} />,
    },
    {
      id: "scenes",
      icon: "clock",
      title: "Scene scheduler",
      desc: "Time-of-day playlist: weather by day, clock at night, …",
      render: <SceneSchedulerPanel connected={connected} onSend={onSend} onToast={onToast} />,
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

function StockTickerPanel({ connected, onSend, onToast }: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [symbols, setSymbols] = useState("AAPL, NVDA");
  const [color, setColor] = useState("#7CFF6B");
  const [interval, setIntervalMin] = useState(10);
  const [busy, setBusy] = useState(false);

  const list = () => symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

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
      const ok = await onSend("stocks", { symbols: syms, color, interval });
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
          onChange={(e) => setSymbols(e.target.value)}
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
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <Slider
        label="Refresh quotes"
        value={interval}
        min={5}
        max={120}
        step={5}
        onChange={setIntervalMin}
        format={(v) => `${v} min`}
        marks={[5, 30, 60, 120]}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={apply} disabled={busy || !connected}>
          {busy ? <Spinner className="h-4 w-4" /> : <Icon d={ICONS.play} className="h-4 w-4" />}
          Start ticker
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
    </div>
  );
}

function PhotoFramePanel({ connected, onSend, onToast }: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [intervalSec, setIntervalSec] = useState(20);
  const [shuffle, setShuffle] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/media", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; media: MediaItem[] };
      setMedia(data.media ?? []);
    } catch {
      setMedia([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const res = await sendFile("media-add", file);
      if (res.ok) {
        onToast("Saved to photo frame — " + file.name);
        refresh();
      } else {
        onToast(res.error ?? "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const remove = async (name: string) => {
    const ok = await onSend("media-remove", { name });
    if (ok) {
      onToast(`Removed ${name}`);
      refresh();
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      const ok = await onSend("slideshow", { interval: intervalSec, shuffle });
      if (ok) onToast("Photo frame on");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Photos are converted to 32×32 pixels on the bridge</span>
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
        <div className="flex flex-wrap gap-1.5">
          {media.map((m) => (
            <span
              key={m.name}
              className="group flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300"
            >
              {m.name}
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                onClick={() => remove(m.name)}
                className="text-zinc-600 transition-colors hover:text-red-400"
              >
                <Icon d={ICONS.close} className="h-3 w-3" />
              </button>
            </span>
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
            onChange={setIntervalSec}
            format={(v) => `${v}s`}
            marks={[5, 20, 60, 120, 300]}
          />
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Shuffle photos
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
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
    </div>
  );
}

interface SceneEntry {
  start: string;
  end: string;
  program: string;
}

const SCENE_PROGRAMS = ["weather", "stocks", "slideshow", "clock", "effect", "text"];

function SceneSchedulerPanel({ connected, onSend, onToast }: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [entries, setEntries] = useState<SceneEntry[]>([
    { start: "08:00", end: "20:00", program: "clock" },
    { start: "20:00", end: "23:59", program: "effect" },
  ]);
  const [busy, setBusy] = useState(false);

  const setEntry = (i: number, patch: Partial<SceneEntry>) => {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  const apply = async () => {
    const valid = entries.every((e) => /^\d{2}:\d{2}$/.test(e.start) && /^\d{2}:\d{2}$/.test(e.end));
    if (!valid) {
      onToast("Times must use HH:MM");
      return;
    }
    setBusy(true);
    try {
      const ok = await onSend("scene", {
        enabled: true,
        playlist: entries.map((e) => ({ start: e.start, end: e.end, program: e.program })),
      });
      if (ok) onToast("Scenes scheduled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionLabel>Playlist — earliest matching time wins (times can wrap past midnight)</SectionLabel>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              value={entry.start}
              onChange={(e) => setEntry(i, { start: e.target.value })}
              className="w-[92px] rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-amber-500"
              aria-label={`Entry ${i + 1} start`}
            />
            <span className="text-zinc-600">→</span>
            <input
              type="time"
              value={entry.end}
              onChange={(e) => setEntry(i, { end: e.target.value })}
              className="w-[92px] rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-amber-500"
              aria-label={`Entry ${i + 1} end`}
            />
            <select
              value={entry.program}
              onChange={(e) => setEntry(i, { program: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500"
              aria-label={`Entry ${i + 1} program`}
            >
              {SCENE_PROGRAMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Remove entry"
              onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-500 hover:text-red-400"
            >
              <Icon d={ICONS.trash} className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setEntries((prev) => [...prev, { start: "08:00", end: "20:00", program: "clock" }])
          }
        >
          <Icon d={ICONS.plus} className="h-3.5 w-3.5" /> Add slot
        </Button>
        <div className="grow" />
        <Button onClick={apply} disabled={busy || !connected || entries.length === 0}>
          {busy ? <Spinner className="h-4 w-4" /> : <Icon d={ICONS.play} className="h-4 w-4" />}
          Apply scenes
        </Button>
        <Button
          variant="ghost"
          disabled={busy || !connected}
          onClick={async () => {
            const ok = await onSend("automation-off", {});
            if (ok) onToast("Scenes stopped");
          }}
        >
          Stop
        </Button>
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
      <Button
        disabled={!connected}
        onClick={async () => {
          const ok = await onSend("animation", { style, colors: null });
          if (ok) onToast("Effect playing");
        }}
      >
        <Icon d={ICONS.play} className="h-4 w-4" /> Play effect
      </Button>
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