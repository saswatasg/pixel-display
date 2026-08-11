import type { AppStatus, ActionResult, Preset } from "./types";

let lockRedirecting = false;

async function request(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401 && !lockRedirecting) {
    // Session expired mid-session — send the visitor back to the lock screen.
    lockRedirecting = true;
    const dest = new URL("/login", window.location.origin);
    window.location.assign(dest.toString());
  }
  return res;
}

const json = async <T,>(res: Response): Promise<T> => (await res.json()) as T;

export async function getStatus(): Promise<AppStatus> {
  return json<AppStatus>(await request("/api/status", { cache: "no-store" }));
}

export async function sendAction(action: string, payload: Record<string, unknown>): Promise<ActionResult> {
  return json<ActionResult>(
    await request(`/api/action/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function sendFile(action: string, file: File): Promise<ActionResult> {
  const form = new FormData();
  form.append("file", file);
  return json<ActionResult>(await request(`/api/action/${action}`, { method: "POST", body: form }));
}

export async function listPresets(): Promise<Preset[]> {
  return json<Preset[]>(await request("/api/presets", { cache: "no-store" }));
}

export async function createPreset(name: string, action: string, payload: Record<string, unknown>): Promise<Preset> {
  return json<Preset>(
    await request("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, action, payload }),
    }),
  );
}

export async function deletePreset(id: string): Promise<void> {
  await request(`/api/presets/${id}`, { method: "DELETE" });
}

export async function updatePreset(
  id: string,
  name: string,
  action: string,
  payload: Record<string, unknown>,
  meta?: { pinned?: boolean; plays?: number },
): Promise<Preset> {
  return json<Preset>(
    await request(`/api/presets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, action, payload, meta }),
    }),
  );
}