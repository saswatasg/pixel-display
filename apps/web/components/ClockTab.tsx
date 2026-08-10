"use client";

import { useState } from "react";
import { CLOCK_STYLES } from "@/lib/types";
import { createPreset } from "@/lib/api";
import { Button, Card, Toggle } from "./ui";
import { ColorPicker } from "./ColorPicker";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

export function ClockTab({ connected, onSend, onToast }: Props) {
  const [style, setStyle] = useState(0);
  const [color, setColor] = useState("#FFFFFF");
  const [format24h, setFormat24h] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [syncTime, setSyncTime] = useState(true);
  const [busy, setBusy] = useState(false);

  const payload = () => ({ style, color, format24h, showDate, syncTime });

  async function send() {
    setBusy(true);
    const ok = await onSend("clock", payload());
    if (ok) onToast("Clock set");
    setBusy(false);
  }

  async function savePreset() {
    const name = prompt("Preset name", `Clock style ${style + 1}`);
    if (!name) return;
    try {
      await createPreset(name, "clock", payload());
      onToast("Preset saved");
    } catch {
      onToast("Failed to save preset");
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Clock face">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(CLOCK_STYLES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStyle(Number(key))}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-[10px] font-medium transition-colors ${
                style === Number(key)
                  ? "border-amber-400 bg-amber-500/15 text-amber-300"
                  : "border-white/10 bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <span className="font-mono text-lg leading-none" style={{ color: style === Number(key) ? color : undefined }}>
                {String(Number(key) + 1).padStart(2, "0")}
              </span>
              <span className="mt-1">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Options">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-zinc-300">Color</p>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-2">
            <Toggle label="24-hour format" checked={format24h} onChange={setFormat24h} />
            <Toggle label="Show date" checked={showDate} onChange={setShowDate} />
            <Toggle label="Sync to device time" checked={syncTime} onChange={setSyncTime} />
          </div>
          <div className="flex gap-2">
            <Button onClick={send} disabled={busy || !connected}>
              {busy ? "Setting…" : "Set clock"}
            </Button>
            <Button variant="ghost" onClick={savePreset} disabled={busy}>
              Save as preset
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
