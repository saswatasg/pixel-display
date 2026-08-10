"use client";

import { useState } from "react";
import { ANIMATION_STYLES } from "@/lib/types";
import { Button, Card, Slider, Toggle } from "./ui";
import { ColorPicker } from "./ColorPicker";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

export function MoreTab({ connected, onSend, onToast }: Props) {
  return (
    <div className="space-y-4">
      <ChronographCard onSend={onSend} onToast={onToast} connected={connected} />
      <CountdownCard onSend={onSend} onToast={onToast} connected={connected} />
      <FullscreenCard onSend={onSend} onToast={onToast} connected={connected} />
      <AnimationCard onSend={onSend} onToast={onToast} connected={connected} />
      <ScoreboardCard onSend={onSend} onToast={onToast} connected={connected} />
    </div>
  );
}

function ChronographCard({
  connected,
  onSend,
  onToast,
}: Pick<Props, "connected" | "onSend" | "onToast">) {
  return (
    <Card title="Chronograph (stopwatch)">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["start", "Start"],
            ["pause", "Pause"],
            ["resume", "Resume"],
            ["reset", "Reset"],
          ] as const
        ).map(([mode, label]) => (
          <Button
            key={mode}
            variant={mode === "reset" ? "ghost" : "primary"}
            disabled={!connected}
            onClick={async () => {
              const ok = await onSend("chronograph", { mode });
              if (ok) onToast("Chronograph " + label.toLowerCase());
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function CountdownCard({
  connected,
  onSend,
  onToast,
}: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);

  return (
    <Card title="Countdown timer">
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={59}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
          className="w-20 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-center font-mono text-xl text-zinc-100 outline-none focus:border-amber-500"
        />
        <span className="text-xl text-zinc-500">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={seconds}
          onChange={(e) => setSeconds(Math.max(0, Math.min(59, Number(e.target.value))))}
          className="w-20 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-center font-mono text-xl text-zinc-100 outline-none focus:border-amber-500"
        />
        <Button
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
    </Card>
  );
}

function FullscreenCard({
  connected,
  onSend,
  onToast,
}: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [color, setColor] = useState("#000000");
  return (
    <Card title="Fullscreen color">
      <div className="flex items-center gap-3">
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
    </Card>
  );
}

function AnimationCard({
  connected,
  onSend,
  onToast,
}: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [style, setStyle] = useState(0);
  return (
    <Card title="Animated effect">
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(ANIMATION_STYLES).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStyle(Number(key))}
            className={`rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
              style === Number(key) ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Button
        className="mt-3"
        disabled={!connected}
        onClick={async () => {
          const ok = await onSend("animation", { style, colors: null });
          if (ok) onToast("Effect playing");
        }}
      >
        Play effect
      </Button>
    </Card>
  );
}

function ScoreboardCard({
  connected,
  onSend,
  onToast,
}: Pick<Props, "connected" | "onSend" | "onToast">) {
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  return (
    <Card title="Scoreboard">
      <div className="flex items-center justify-center gap-6">
        {(
          [
            [score1, setScore1],
            [score2, setScore2],
          ] as const
        ).map(([score, setScore], i) => (
          <div key={i} className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setScore(Math.max(0, score - 1))}>
              −
            </Button>
            <span className="w-12 text-center font-mono text-2xl text-zinc-100">{score}</span>
            <Button variant="ghost" onClick={() => setScore(Math.min(999, score + 1))}>
              +
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center">
        <Button
          disabled={!connected}
          onClick={async () => {
            const ok = await onSend("scoreboard", { score1, score2 });
            if (ok) onToast("Scoreboard updated");
          }}
        >
          Send score
        </Button>
      </div>
    </Card>
  );
}
