import { readLocal, writeLocal } from "./local-store";

export interface CloudMediaItem {
  id: string;
  name: string;
  url: string;
  addedAt: number;
  size: number;
}

export async function toPixelDataUrl(f: File): Promise<string | null> {
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
}

export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
}

function items(key: string): CloudMediaItem[] {
  const value = readLocal<unknown>(key, []);
  return Array.isArray(value) ? value.filter(m => m && typeof m.id === "string" && typeof m.url === "string" && m.url.startsWith("data:image/png;")) : [];
}
async function add(key: string, dataUrl: string, name: string, limit: number) {
  try {
    if (!dataUrl.startsWith("data:image/png;") || dataUrl.length > 40000) throw new Error("Choose a converted 32×32 PNG image.");
    const old = items(key);
    if (key === "frame:v2" && old.length >= limit) throw new Error("Frame is full. Remove a photo first.");
    const media = { id: crypto.randomUUID(), name, url: dataUrl, size: dataUrl.length, addedAt: Date.now() };
    writeLocal(key, [...old, media].slice(-limit));
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Save failed" }; }
}
async function remove(key: string, id: string) {
  try { writeLocal(key, items(key).filter(m => m.id !== id)); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Remove failed" }; }
}
export async function listFrameMedia(): Promise<CloudMediaItem[]> { return items("frame:v2"); }
export async function uploadFrameMedia(dataUrl: string, name: string) { return add("frame:v2", dataUrl, name, 4); }
export async function deleteFrameMedia(id: string) { return remove("frame:v2", id); }
export async function listPastImages(): Promise<CloudMediaItem[]> { return items("past:v2"); }
export async function addPastImage(dataUrl: string, name: string) { return add("past:v2", dataUrl, name, 24); }
export async function deletePastImage(id: string) { return remove("past:v2", id); }
