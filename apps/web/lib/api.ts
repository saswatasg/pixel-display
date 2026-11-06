import type { AppStatus, ActionResult, Preset } from "./types";
import { sanitizePrefs, DEFAULT_PREFS, type AppPrefs } from "./prefs";
import { bluetooth } from "./bluetooth/client";
import { readLocal, writeLocal } from "./local-store";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"]);
export function validateUpload(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return `${file.name} is not a supported image type`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 5 MB`;
  return null;
}
export async function getStatus(): Promise<AppStatus> { return bluetooth.status(); }
export async function sendAction(action: string, payload: Record<string, unknown>): Promise<ActionResult> {
  return bluetooth.action(action, payload);
}
export async function sendFile(action: string, file: File): Promise<ActionResult> {
  const issue = validateUpload(file);
  if (issue) return { ok: false, sent: false, action, error: issue };
  return bluetooth.file(action, file);
}
export async function listPresets(): Promise<Preset[]> {
  const stored = readLocal<unknown>("presets:v2", []);
  return Array.isArray(stored) ? stored.filter(p => p && typeof p.id === "string" && typeof p.name === "string" && typeof p.action === "string" && p.payload && typeof p.payload === "object") : [];
}
export async function createPreset(name: string, action: string, payload: Record<string, unknown>): Promise<Preset | null> {
  const preset: Preset = { id: crypto.randomUUID(), name, action, payload, createdAt: Date.now(), updatedAt: Date.now() };
  writeLocal("presets:v2", [...await listPresets(), preset]);
  return preset;
}
export async function deletePreset(id: string): Promise<boolean> {
  writeLocal("presets:v2", (await listPresets()).filter(p => p.id !== id));
  return true;
}
export async function updatePreset(id: string, name: string, action: string, payload: Record<string, unknown>, meta?: { pinned?: boolean; plays?: number }): Promise<Preset | null> {
  const all = await listPresets(), old = all.find(p => p.id === id);
  if (!old) return null;
  const updated = { ...old, name, action, payload, ...meta, updatedAt: Date.now() };
  writeLocal("presets:v2", all.map(p => p.id === id ? updated : p));
  return updated;
}
export async function getPrefs(): Promise<AppPrefs> { return sanitizePrefs(readLocal("prefs:v2", DEFAULT_PREFS)); }
export async function savePrefs(prefs: AppPrefs): Promise<void> { writeLocal("prefs:v2", sanitizePrefs(prefs)); }
