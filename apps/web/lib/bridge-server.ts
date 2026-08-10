import type { AppStatus, BridgeStatus } from "./types";

export const BRIDGE_URL = process.env.BRIDGE_URL ?? "";
export const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY ?? "";
export const BRIDGE_CONFIGURED = Boolean(BRIDGE_URL && BRIDGE_API_KEY);

const TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function bridgeHeaders(): Record<string, string> {
  return { "X-API-Key": BRIDGE_API_KEY };
}

export async function fetchBridgeStatus(): Promise<AppStatus> {
  if (!BRIDGE_CONFIGURED) {
    return {
      bridgeOnline: false,
      configured: false,
      reason: "BRIDGE_URL / BRIDGE_API_KEY not set on the server",
      fetchedAt: Date.now(),
    };
  }
  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/status`, {
      headers: bridgeHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const bridge = (await res.json()) as BridgeStatus;
      return { bridgeOnline: true, configured: true, bridge, fetchedAt: Date.now() };
    }
    return {
      bridgeOnline: false,
      configured: true,
      reason: `bridge returned HTTP ${res.status}`,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    return {
      bridgeOnline: false,
      configured: true,
      reason: err instanceof Error ? err.message : "bridge unreachable",
      fetchedAt: Date.now(),
    };
  }
}
