"use client";

import { useState, type ReactNode } from "react";
import { ANIMATION_STYLES } from "@/lib/types";
import { Button, Card, Icon, ICONS, type IconName } from "./ui";
import { ColorPicker } from "./ColorPicker";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

export function MoreTab({ connected, onSend, onToast }: Props) {
  const [open, setOpen] = useState<string | null>("chronograph");

  const sections: { id: string; icon: IconName; title: string; desc: string; render: ReactNode }[] = [
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