"use client";

import { useState } from "react";
import { TEXT_MODES } from "@/lib/types";
import { createPreset } from "@/lib/api";
import { Button, Card, Icon, ICONS, Segmented, Slider } from "./ui";
import { ColorPicker } from "./ColorPicker";
import { PresetDialog } from "./PresetDialog";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

const MODE_OPTIONS = Object.entries(TEXT_MODES).map(([k, label]) => ({
  value: Number(k),
  label,
}));

const COLOR_OPTIONS = [
  { value: 0, label: "White" },
  { value: 1, label: "Custom" },
  { value: 3, label: "Rainbow" },
] as const;

export function TextTab({ connected, onSend, onToast }: Props) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState(1);
  const [size, setSize] = useState(16);
  const [speed, setSpeed] = useState(95);
  const [colorMode, setColorMode] = useState<(typeof COLOR_OPTIONS)[number]["value"]>(1);
  const [color, setColor] = useState("#FFFFFF");
  const [bgEnabled, setBgEnabled] = useState(false);
  const [bgColor, setBgColor] = useState("#000000");
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const payload = () => ({
    text,
    size,
    mode,
    speed,
    color_mode: colorMode,
    color,
    bg_color: bgEnabled ? bgColor : null,
  });

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const ok = await onSend("text", payload());
    setBusy(false);
    if (ok) onToast("Text sent to display");
  }

  async function savePreset(name: string) {
    await createPreset(name, "text", payload());
    onToast("Preset saved");
  }

  return (
    <div className="space-y-5">
      {/* Live marquee preview */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Icon d={ICONS.clockDisplay} className="h-4 w-4" />
            <span className="text-xs">On the display</span>
          </div>
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-amber-300">
            {text.length}/60
          </span>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-black p-4">
          <div
            className="whitespace-nowrap font-bold"
            style={{
              color,
              background: bgEnabled ? bgColor : "transparent",
              fontSize: `${size}px`,
              animationDuration: `${Math.max(1, 140 - speed * 1.2)}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
              animationName: mode === 2 ? "marquee-reverse" : "marquee",
            }}
          >
            {text.trim() || <span className="text-zinc-600">Preview</span>}
          </div>
          <style>{`@keyframes marquee{from{transform:translateX(100%)}to{transform:translateX(-100%)}}@keyframes marquee-reverse{from{transform:translateX(-100%)}to{transform:translateX(100%)}}`}</style>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          Approx. preview — the display renders with its own 32×32 font and animation.
        </p>
      </Card>

      {/* Message */}
      <Card
        icon={<Icon d={ICONS.text} className="h-5 w-5" />}
        title="Message"
        subtitle="Up to 60 characters"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 60))}
          rows={2}
          placeholder="Type something to show…"
          className="w-full resize-none rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={send} disabled={!text.trim() || busy || !connected}>
            <Icon d={ICONS.zap} className="h-4 w-4" />
            {busy ? "Sending…" : "Send to display"}
          </Button>
          <Button variant="ghost" onClick={() => setDialogOpen(true)} disabled={!text.trim()}>
            <Icon d={ICONS.plus} className="h-4 w-4" /> Save
          </Button>
        </div>
      </Card>

      {/* Style */}
      <Card icon={<Icon d={ICONS.sparkle} className="h-5 w-5" />} title="Style" subtitle="Animation, size and color">
        <div className="space-y-4">
          <Segmented label="Animation" options={MODE_OPTIONS} value={mode} onChange={setMode} />

          <div className="grid grid-cols-2 gap-4">
            <Slider label="Font size" value={size} min={8} max={24} onChange={setSize} format={(v) => `${v}px`} />
            <Slider
              label="Speed"
              value={speed}
              min={1}
              max={100}
              onChange={setSpeed}
              format={(v) => (v === 1 ? "slow" : v === 100 ? "fast" : `${v}`)}
            />
          </div>

          <Segmented label="Text color" options={[...COLOR_OPTIONS]} value={colorMode} onChange={setColorMode} />
          {colorMode === 1 && <ColorPicker value={color} onChange={setColor} />}

          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-sm text-zinc-300">Background color</span>
              <span
                onClick={() => setBgEnabled(!bgEnabled)}
                className={`flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${
                  bgEnabled ? "bg-amber-500" : "bg-zinc-700"
                }`}
                role="switch"
                aria-checked={bgEnabled}
              >
                <span
                  className={`mx-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    bgEnabled ? "translate-x-5" : ""
                  }`}
                />
              </span>
            </div>
            {bgEnabled && (
              <div className="animate-fade-in">
                <ColorPicker value={bgColor} onChange={setBgColor} />
              </div>
            )}
          </div>
        </div>
      </Card>

      <PresetDialog
        open={dialogOpen}
        defaultName={text.slice(0, 24) || "Text scene"}
        onClose={() => setDialogOpen(false)}
        onSave={savePreset}
      />
    </div>
  );
}