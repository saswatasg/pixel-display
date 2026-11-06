import { readLocal, writeLocal } from "./local-store";
import type { Preset } from "./types";
import type { CloudMediaItem } from "./media";
const ACTIONS = new Set(["text", "clock", "image", "animation", "fullscreen-color", "weather", "countdown", "chronograph", "scoreboard", "brightness"]);
export interface LibraryBackup { version: 1; presets: Preset[]; frame: CloudMediaItem[]; history: CloudMediaItem[]; }
export function exportLibrary(): LibraryBackup {
  return { version: 1, presets: readLocal("presets:v2", []), frame: readLocal("frame:v2", []), history: readLocal("past:v2", []) };
}
export function validateBackup(raw: unknown): LibraryBackup {
  if (!raw || typeof raw !== "object" || !("version" in raw) || raw.version !== 1) throw new Error("Choose a Pixel Display backup (version 1).");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.presets) || r.presets.length > 200 || !Array.isArray(r.frame) || r.frame.length > 4 || !Array.isArray(r.history) || r.history.length > 24) throw new Error("This backup has an invalid library.");
  const presets = r.presets.map((p: Preset) => {
    if (!p || typeof p.name !== "string" || p.name.length > 80 || !ACTIONS.has(p.action) || !p.payload || typeof p.payload !== "object" || Array.isArray(p.payload)) throw new Error("This backup contains an invalid scene.");
    if (p.action === "image" && (typeof p.payload.url !== "string" || !p.payload.url.startsWith("data:image/png;base64,") || p.payload.url.length > 40000)) throw new Error("Image scenes must contain a local pixel image.");
    return { id: crypto.randomUUID(), name: p.name.trim() || "Imported scene", action: p.action, payload: p.payload, createdAt: Date.now(), updatedAt: Date.now(), pinned: p.pinned === true, plays: typeof p.plays === "number" && Number.isSafeInteger(p.plays) && p.plays >= 0 ? p.plays : 0 };
  });
  const media = (items: CloudMediaItem[]) => items.map(m => {
    if (!m || typeof m.name !== "string" || typeof m.url !== "string" || !m.url.startsWith("data:image/png;base64,") || m.url.length > 40000) throw new Error("This backup contains an invalid image.");
    return { id: crypto.randomUUID(), name: m.name.slice(0, 100), url: m.url, size: m.url.length, addedAt: Date.now() };
  });
  return { version: 1, presets, frame: media(r.frame), history: media(r.history) };
}
/** Merge instead of replacing existing scenes. Roll back if a storage write fails. */
export function importLibrary(raw: unknown): number {
  const backup = validateBackup(raw), old = exportLibrary();
  const unique = <T,>(a: T[], b: T[], key: (v: T) => string) => [...a, ...b].filter((v, i, all) => all.findIndex(x => key(x) === key(v)) === i);
  const scenes = unique(old.presets, backup.presets, p => JSON.stringify([p.name, p.action, p.payload]));
  const frame = unique(old.frame, backup.frame, m => m.url).slice(0, 4);
  const history = unique(old.history, backup.history, m => m.url).slice(-24);
  const keys = ["presets:v2", "frame:v2", "past:v2"];
  const previous = [old.presets, old.frame, old.history];
  const values = [scenes, frame, history];
  let written = 0;
  try { for (; written < keys.length; written++) writeLocal(keys[written], values[written]); }
  catch (e) { for (let i = written - 1; i >= 0; i--) writeLocal(keys[i], previous[i]); throw e; }
  return scenes.length - old.presets.length;
}
