"use client";

import { useCallback, useEffect, useState } from "react";
import { createPreset, sendFile, validateUpload } from "@/lib/api";
import { Button, Card, Icon, ICONS } from "./ui";
import { PixelPreview } from "./PixelPreview";
import { DisplayBezel } from "./DisplayBezel";
import { addPastImage, deletePastImage, listPastImages, toPixelDataUrl, uploadFrameMedia, type CloudMediaItem } from "@/lib/media";
import { PresetDialog } from "./PresetDialog";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string) => void;
}

export function ImageTab({ connected, onSend, onToast }: Props) {
  const [fileInfo, setFileInfo] = useState<{ file: File | null }>({ file: null });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState<CloudMediaItem[]>([]);
  const [presetImage, setPresetImage] = useState<CloudMediaItem | null>(null);

  const file = fileInfo.file;

  const isGif = Boolean(file && (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")));

  useEffect(() => {
    listPastImages()
      .then((items) => setHistory(items))
      .catch(() => setHistory([]));
  }, []);

  const pick = useCallback(
    async (f: File | null) => {
      if (!f) {
        setFileInfo({ file: null });
        return;
      }
      if (!f.type.startsWith("image/")) {
        onToast(`${f.name} is not an image`);
        return;
      }
      const issue = validateUpload(f);
      if (issue) {
        onToast(issue);
        return;
      }
      setFileInfo({ file: f });
      const dataUrl = await toPixelDataUrl(f);
      if (dataUrl) {
        const res = await addPastImage(dataUrl, f.name);
        if (res.ok) {
          const items = await listPastImages();
          setHistory(items);
        }
      }
    },
    [onToast],
  );

  const deletePast = useCallback(
    async (id: string) => {
      const res = await deletePastImage(id);
      if (res.ok) setHistory(await listPastImages());
    },
    [],
  );

  const sendPast = useCallback(
    async (p: CloudMediaItem) => {
      try {
        const res = await fetch(p.url);
        if (!res.ok) {
          onToast("Could not load that image");
          return;
        }
        const blob = await res.blob();
        const f = new File([blob], p.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
        const sent = await sendFile("image", f);
        if (sent.ok) onToast("Past image sent to display");
        else onToast(sent.error ?? "Send failed");
      } catch {
        onToast("Network error — image not sent");
      }
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

  async function savePreset(name: string) {
    if (!presetImage) return;
    await createPreset(name, "image", { url: presetImage.url, name: presetImage.name });
    onToast("Image saved as preset");
  }

  async function saveToFrame() {
    if (!file || isGif) return;
    setSaving(true);
    try {
      const dataUrl = await toPixelDataUrl(file);
      if (!dataUrl) {
        onToast("Could not read that image");
        return;
      }
      const res = await uploadFrameMedia(dataUrl, file.name);
      if (res.ok) onToast("Saved to photo frame (cloud)");
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
                <Button variant="ghost" onClick={saveToFrame} disabled={saving} title="Keep in the photo frame for slideshows (stored in the cloud)">
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
          subtitle="Pixel-converted uploads kept in the cloud — accessible from anywhere"
          icon={<Icon d={ICONS.copy} className="h-5 w-5" />}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {history.map((p) => (
              <div key={p.id} className="group w-28 shrink-0">
                <div className="relative overflow-hidden rounded-lg border border-white/15 bg-black">
                  <img src={p.url} alt={p.name} className="aspect-square w-full" style={{ imageRendering: "pixelated" }} />
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
                <div className="mt-1 flex gap-1">
                  <Button size="sm" variant="ghost" className="flex-1" disabled={!connected} onClick={() => sendPast(p)}>
                    <Icon d={ICONS.play} className="h-3 w-3" /> Send
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="!px-2"
                    title="Save as a one-tap preset on the home screen"
                    onClick={() => setPresetImage(p)}
                  >
                    <Icon d={ICONS.star} className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <PresetDialog
        defaultName={presetImage ? presetImage.name.replace(/\.[^.]+$/, "") : ""}
        open={presetImage !== null}
        onClose={() => setPresetImage(null)}
        onSave={savePreset}
      />

      <Card title="Tips" icon={<Icon d={ICONS.sparkle} className="h-5 w-5" />}>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex gap-2">
            <span className="text-amber-400">·</span>
            <span>Square images (32×32 or larger) look best.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400">·</span>
            <span>Images are converted to 32×32 here in the app and stored in the cloud.</span>
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