import type { AppStatus, ActionResult, Preset } from "./types";

export async function getStatus(): Promise<AppStatus> {
  const res = await fetch("/api/status", { cache: "no-store" });
  return (await res.json()) as AppStatus;
}

export async function sendAction(action: string, payload: Record<string, unknown>): Promise<ActionResult> {
  const res = await fetch(`/api/action/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as ActionResult;
}

export async function sendFile(action: string, file: File): Promise<ActionResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/action/${action}`, {
    method: "POST",
    body: form,
  });
  return (await res.json()) as ActionResult;
}

export async function listPresets(): Promise<Preset[]> {
  const res = await fetch("/api/presets", { cache: "no-store" });
  return (await res.json()) as Preset[];
}

export async function createPreset(name: string, action: string, payload: Record<string, unknown>): Promise<Preset> {
  const res = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, action, payload }),
  });
  return (await res.json()) as Preset;
}

export async function deletePreset(id: string): Promise<void> {
  await fetch(`/api/presets/${id}`, { method: "DELETE" });
}

export async function updatePreset(
  id: string,
  name: string,
  action: string,
  payload: Record<string, unknown>,
  meta?: { pinned?: boolean; plays?: number },
): Promise<Preset> {
  const res = await fetch(`/api/presets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, action, payload, meta }),
  });
  return (await res.json()) as Preset;
}
