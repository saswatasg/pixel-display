"use client";

import { useCallback, useEffect, useState } from "react";
import { sendFile } from "@/lib/api";
import { Button, Card, Icon, ICONS } from "./ui";
import { PixelPreview } from "./PixelPreview";
import { DisplayBezel } from "./DisplayBezel";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

interface PastImage {
  id: string;
  name: string;
  dataUrl: string;
  at: number;
}

const HISTORY_KEY = "pixel-display:past-images:v1";
const HISTORY_LIMIT = 10;

function loadHistory(): PastImage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PastImage[];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: PastImage[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // storage full/blocked — history is best-effort
  }
}

export function ImageTab({ connected, onSend, onToast }: Props) {
  const [fileInfo, setFileInfo] = useState<{ file: File | null }>({ file: null });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState<PastImage[]>([]);

  const file = fileInfo.file;

  const isGif = Boolean(file && (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")));

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const toPixelDataUrl = useCallback(async (f: File): Promise<string | null> => {
    try {
      const bitmap = await createImageBitmap(f);
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        return null;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, 0, 0, 32, 32);
      bitmap.close();
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);

  const remember = useCallback(
    async (f: File) => {
      const dataUrl = await toPixelDataUrl(f);
      if (!dataUrl) return;
      setHistory((prev) => {
        const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: f.name, dataUrl, at: Date.now() }, ...prev].slice(0, HISTORY_LIMIT);
        saveHistory(next);
        return next;
      });
    },
    [toPixelDataUrl],
  );

  const pick = useCallback(
    (f: File | null) => {
      setFileInfo({ file: f && f.type.startsWith("image/") ? f : null });
      if (f && f.type.startsWith("image/")) remember(f);
    },
    [remember],
  );

  const deletePast = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const sendPast = useCallback(
    async (p: PastImage) => {
      const res = await fetch(p.dataUrl);
      const blob = await res.blob();
      const f = new File([blob], p.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
      const sent = await sendFile("image", f);
      if (sent.ok) onToast("Past image sent to display");
      else onToast(sent.error ?? "Send failed");
    },
    [onToast],
  );

  async function send() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await sendFile(isGif ? "gif" : "image", file);
      if (res.ok) onToast(isGif ? "GIF sent to display" : "Image sent to display");
      else onToast(res.error ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveToFrame() {
    if (!file || isGif) return;
    setSaving(true);
    try {
      const res = await sendFile("media-add", file);
      if (res.ok) onToast("Saved to photo frame");
      else onToast(res.error ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card icon={<Icon d={ICONS.image} className="h-5 w-5" />} title="Upload" subtitle="PNG · JPG · GIF — max 5 MB">
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
          onClick={() =>
            (document.getElementById("image-input") as HTMLInputElement | null)?.click()
          }
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-12 text-center transition-all ${
            dragging
              ? "border-amber-400 bg-amber-500/10 scale-[0.99]"
              : "border-white/20 hover:border-white/40 hover:bg-white/[0.02]"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <Icon d={ICONS.image} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {file ? file.name : "Drop an image or GIF"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {file
                ? `${(file.size / 1024).toFixed(0)} KB · ${isGif ? "GIF" : "image"}`
                : "or tap to browse from your device"}
            </p>
          </div>
          <input
            id="image-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </div>

        {file && (
          <div className="mt-5 flex flex-col items-center gap-4 animate-fade-up">
            <DisplayBezel
              label={isGif ? "FIRST FRAME" : "32 × 32 PREVIEW"}
              powered={connected}
            >
              <PixelPreview file={file} />
            </DisplayBezel>
            <p className="max-w-xs text-center text-xs text-zinc-500">
              This is exactly what your display will show — every pixel maps 1:1 onto the 32×32 grid.
            </p>
            <div className="flex gap-2">
              <Button onClick={send} disabled={busy || !connected}>
                {busy ? "Uploading…" : `Send ${isGif ? "GIF" : "image"}`}
              </Button>
              {!isGif && (
                <Button variant="ghost" onClick={saveToFrame} disabled={saving || !connected} title="Keep in the photo frame for slideshows">
                  {saving ? "Saving…" : "Save to frame"}
                </Button>
              )}
              <Button variant="ghost" onClick={() => pick(null)}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </Card>

      {history.length > 0 && (
        <Card
          title="Past images"
          subtitle={`Pixel-converted uploads kept on this device — newest ${HISTORY_LIMIT} only`}
          icon={<Icon d={ICONS.copy} className="h-5 w-5" />}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {history.map((p) => (
              <div key={p.id} className="group w-28 shrink-0">
                <div className="relative overflow-hidden rounded-lg border border-white/15 bg-black">
                  <img src={p.dataUrl} alt={p.name} className="aspect-square w-full" style={{ imageRendering: "pixelated" }} />
                  <button
                    type="button"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => deletePast(p.id)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-zinc-950/80 text-zinc-400 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Icon d={ICONS.trash} className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1.5 truncate text-[11px] text-zinc-500" title={p.name}>
                  {p.name}
                </p>
                <Button size="sm" variant="ghost" className="mt-1 w-full" disabled={!connected} onClick={() => sendPast(p)}>
                  <Icon d={ICONS.play} className="h-3 w-3" /> Send
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Tips" icon={<Icon d={ICONS.sparkle} className="h-5 w-5" />}>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex gap-2">
            <span className="text-amber-400">·</span>
            <span>Square images (32×32 or larger) look best.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400">·</span>
            <span>Images are resized and processed on the bridge before upload.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400">·</span>
            <span>GIFs are re-encoded at 32×32 with nearest-neighbour scaling.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400">·</span>
            <span>Presets aren&apos;t available for images/GIFs.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}