import { list, put } from "@vercel/blob";
import type { Preset } from "./types";

const PRESETS_PATH = "presets/index.json";

async function readCat(): Promise<Preset[]> {
  try {
    const found = await list({ prefix: PRESETS_PATH, limit: 10 });
    const index = found.blobs.find((b) => b.pathname === PRESETS_PATH);
    if (!index) return [];
    const res = await fetch(index.url, { cache: "no-store" });
    if (!res.ok) return [];
    const items = (await res.json()) as Preset[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function writeCat(presets: Preset[]): Promise<void> {
  await put(PRESETS_PATH, JSON.stringify(presets), {
    contentType: "application/json",
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function listPresets(): Promise<Preset[]> {
  return readCat();
}

export async function savePreset(preset: Preset): Promise<Preset[]> {
  const presets = await readCat();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) presets[idx] = preset;
  else presets.push(preset);
  await writeCat(presets);
  return presets;
}

export async function deletePreset(id: string): Promise<Preset[]> {
  const presets = (await readCat()).filter((p) => p.id !== id);
  await writeCat(presets);
  return presets;
}