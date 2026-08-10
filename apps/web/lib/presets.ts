import { kv } from "@vercel/kv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Preset } from "./types";

const KV_READY = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const PRESET_KEY = "presets";
const FILE_PATH = path.join(process.cwd(), "data", "presets.json");

async function readFileFallback(): Promise<Preset[]> {
  try {
    return JSON.parse(await readFile(FILE_PATH, "utf-8")) as Preset[];
  } catch {
    return [];
  }
}

async function writeFileFallback(presets: Preset[]): Promise<void> {
  await mkdir(path.dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(presets, null, 2), "utf-8");
}

export async function listPresets(): Promise<Preset[]> {
  if (KV_READY) {
    const stored = await kv.get<Preset[]>(PRESET_KEY);
    return stored ?? [];
  }
  return readFileFallback();
}

export async function savePreset(preset: Preset): Promise<Preset[]> {
  const presets = await listPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) presets[idx] = preset;
  else presets.push(preset);
  if (KV_READY) {
    await kv.set(PRESET_KEY, presets);
  } else {
    await writeFileFallback(presets);
  }
  return presets;
}

export async function deletePreset(id: string): Promise<Preset[]> {
  const presets = (await listPresets()).filter((p) => p.id !== id);
  if (KV_READY) {
    await kv.set(PRESET_KEY, presets);
  } else {
    await writeFileFallback(presets);
  }
  return presets;
}
