"use client";

import { useCallback, useRef, useState } from "react";
import { sendFile } from "@/lib/api";
import { Button, Card } from "./ui";
import { PixelPreview } from "./PixelPreview";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

export function ImageTab({ connected, onSend, onToast }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGif = file?.type === "image/gif" || file?.name.toLowerCase().endsWith(".gif");

  const pick = useCallback((f: File | null) => {
    if (f && !f.type.startsWith("image/")) return;
    setFile(f);
  }, []);

  async function send() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await sendFile(isGif ? "gif" : "image", file);
      if (res.ok) onToast(isGif ? "GIF sent to display" : "Image sent to display");
      else onToast(res.error ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Upload">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
            dragging ? "border-amber-400 bg-amber-500/10" : "border-white/20 hover:border-white/40"
          }`}
        >
          <p className="text-sm font-medium text-zinc-200">
            {file ? file.name : "Drop an image or GIF here"}
          </p>
          <p className="text-xs text-zinc-500">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB · ${isGif ? "GIF" : "image"} · max 5 MB`
              : "or tap to browse · PNG / JPG / GIF"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </div>

        {file && (
          <div className="mt-4 flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <PixelPreview file={file} />
            </div>
            <p className="text-xs text-zinc-500">
              Preview shows the {isGif ? "first frame of the GIF" : "image"} scaled to 32×32 — the
              display shows exactly this pixel grid.
            </p>
            <div className="flex gap-2">
              <Button onClick={send} disabled={busy || !connected}>
                {busy ? "Uploading…" : `Send ${isGif ? "GIF" : "image"}`}
              </Button>
              <Button variant="ghost" onClick={() => setFile(null)}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Tips">
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-400">
          <li>Images are resized and processed on the bridge before upload.</li>
          <li>Square images (32×32 or larger) look best.</li>
          <li>GIFs are re-encoded at 32×32 with nearest-neighbor scaling.</li>
          <li>Presets are not available for images/GIFs in v1.</li>
        </ul>
      </Card>
    </div>
  );
}
