import type { AppStatus, ActionResult, Preset } from "./types";
import { DEFAULT_PREFS, type AppPrefs } from "./prefs";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

/** Client-side gate mirroring the bridge's 5 MB upload cap. */
export function validateUpload(file: File): string | null {
  if (!file.type || !ALLOWED_IMAGE_TYPES.has(file.type)) {
    return `${file.name} is not a supported image type`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name} is larger than 5 MB`;
  }
  return null;
}

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

/** Never throws on fetch/parse failures; returns a safe fallback instead. */
async function bodyOf<T>(res: Response, fallback?: unknown): Promise<{ status: number; body: T }> {
  try {
    return { status: res.status, body: (await res.json()) as T };
  } catch {
    return { status: res.status, body: fallback as T };
  }
}

function isActionResult(x: unknown): x is ActionResult {
  return typeof x === "object" && x !== null && "ok" in x;
}

export const OFFLINE_STATUS: AppStatus = {
  bridgeOnline: false,
  configured: true,
  reason: "Can't reach the app right now — check your connection.",
  fetchedAt: 0,
};

export async function getStatus(): Promise<AppStatus> {
  try {
    const res = await request("/api/status", { cache: "no-store" });
    const { status, body } = await bodyOf<AppStatus>(res, OFFLINE_STATUS);
    return status === 200 ? body : { ...OFFLINE_STATUS, reason: "Bridge status unavailable right now." };
  } catch {
    return OFFLINE_STATUS;
  }
}

export async function sendAction(action: string, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await request(`/api/action/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const { body } = await bodyOf<unknown>(res, {});
    if (isActionResult(body)) return body;
    return { ok: false, sent: false, action, error: "Unexpected response from the server." };
  } catch {
    return { ok: false, sent: false, action, error: "Network error — command not sent." };
  }
}

export async function sendFile(action: string, file: File): Promise<ActionResult> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await request(`/api/action/${action}`, { method: "POST", body: form });
    const { body } = await bodyOf<unknown>(res, {});
    if (isActionResult(body)) return body;
    return { ok: false, sent: false, action, error: "Unexpected response from the server." };
  } catch {
    return { ok: false, sent: false, action, error: "Network error — upload not sent." };
  }
}

export async function listPresets(): Promise<Preset[]> {
  const res = await request("/api/presets", { cache: "no-store" });
  const { body } = await bodyOf<Preset[]>(res, []);
  return Array.isArray(body) ? body : [];
}

async function requirePreset(res: Response, fallback: Preset): Promise<Preset | null> {
  const { status, body } = await bodyOf<Preset | { error?: string }>(res, {});
  if (status === 200 && body && "id" in body) return body as Preset;
  return null;
}

export async function createPreset(
  name: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<Preset | null> {
  const res = await request("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, action, payload }),
  });
  return requirePreset(res, {} as Preset);
}

export async function deletePreset(id: string): Promise<boolean> {
  const res = await request(`/api/presets/${id}`, { method: "DELETE" });
  return res.ok;
}

export async function updatePreset(
  id: string,
  name: string,
  action: string,
  payload: Record<string, unknown>,
  meta?: { pinned?: boolean; plays?: number },
): Promise<Preset | null> {
  const res = await request(`/api/presets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, action, payload, meta }),
  });
  return requirePreset(res, {} as Preset);
}

export async function getPrefs(): Promise<AppPrefs> {
  try {
    const res = await request("/api/prefs", { cache: "no-store" });
    const { body } = await bodyOf<{ prefs?: AppPrefs }>(res, {});
    return body?.prefs ?? DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: AppPrefs): Promise<void> {
  try {
    await request("/api/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
  } catch {
    // Persisting prefs is best-effort; local state still applies this session.
  }
}