"use client";

import { useState } from "react";
import { TEXT_MODES } from "@/lib/types";
import { createPreset } from "@/lib/api";
import { Button, Card, Slider } from "./ui";
import { ColorPicker } from "./ColorPicker";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

export function TextTab({ connected, onSend, onToast }: Props) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState(1);
  const [size, setSize] = useState(16);
  const [speed, setSpeed] = useState(95);
  const [colorMode, setColorMode] = useState<0 | 1 | 3>(1);
  const [color, setColor] = useState("#FFFFFF");
  const [bgEnabled, setBgEnabled] = useState(false);
  const [bgColor, setBgColor] = useState("#000000");
  const [busy, setBusy] = useState(false);

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
    if (ok) onToast("Text sent to display");
    setBusy(false);
  }

  async function savePreset() {
    const name = prompt("Preset name", text.slice(0, 24) || "Text");
    if (!name) return;
    try {
      await createPreset(name, "text", payload());
      onToast("Preset saved");
    } catch {
      onToast("Failed to save preset");
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Message">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Type something…"
          className="w-full resize-none rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={send} disabled={!text.trim() || busy || !connected}>
            {busy ? "Sending…" : "Send to display"}
          </Button>
          <Button variant="ghost" onClick={savePreset} disabled={!text.trim() || busy}>
            Save as preset
          </Button>
        </div>
      </Card>

      <Card title="Text style">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm text-zinc-300">Animation</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TEXT_MODES).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(Number(key))}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    mode === Number(key)
                      ? "bg-amber-500 text-zinc-950"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Slider label="Font size" value={size} min={8} max={24} onChange={setSize} format={(v) => `${v}px`} />
          <Slider label="Speed" value={speed} min={1} max={100} onChange={setSpeed} />

          <div>
            <p className="mb-1.5 text-sm text-zinc-300">Text color</p>
            <div className="mb-3 flex gap-1.5">
              {(
                [
                  [0, "White"],
                  [1, "Custom"],
                  [3, "Rainbow"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColorMode(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    colorMode === key ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {colorMode === 1 && <ColorPicker value={color} onChange={setColor} />}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setBgEnabled(!bgEnabled)}
              className="mb-2 text-sm text-zinc-300 underline decoration-dotted underline-offset-4"
            >
              {bgEnabled ? "Background color on" : "Background color off"}
            </button>
            {bgEnabled && <ColorPicker value={bgColor} onChange={setBgColor} />}
          </div>
        </div>
      </Card>
    </div>
  );
}
