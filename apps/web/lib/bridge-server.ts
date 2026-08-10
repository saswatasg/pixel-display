import { Agent } from "undici";
import type { AppStatus, BridgeStatus } from "./types";

export const BRIDGE_URL = process.env.BRIDGE_URL ?? "";
export const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY ?? "";
export const BRIDGE_CONFIGURED = Boolean(BRIDGE_URL && BRIDGE_API_KEY);

const BRIDGE_HOSTNAME =
  process.env.BRIDGE_HOSTNAME ?? (BRIDGE_URL.startsWith("https://") ? BRIDGE_URL.slice(8).split("/")[0] : "");
const BRIDGE_HOST_IPS = (process.env.BRIDGE_HOST_IP ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const TIMEOUT_MS = 8_000;

function buildAgent(ip: string) {
  return new Agent({
    connect: {
      servername: BRIDGE_HOSTNAME,
      lookup: (_hostname: string, _opts: unknown, cb: (err: Error | null, addr: { address: string; family: number }[]) => void) => {
        cb(null, [{ address: ip, family: 4 }]);
      },
    },
  });
}

export async function bridgeFetch(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (BRIDGE_HOST_IPS.length === 0) {
      return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    }
    const ip = BRIDGE_HOST_IPS[Math.floor(Math.random() * BRIDGE_HOST_IPS.length)];
    const agent = buildAgent(ip);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        dispatcher: agent,
        cache: "no-store",
      } as RequestInit);
    } finally {
      agent.close();
    }
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
    const res = await bridgeFetch(`${BRIDGE_URL}/status`, {
      headers: bridgeHeaders(),
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
    const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
    const detail =
      cause && (cause.code || cause.message)
        ? `${cause.code ?? cause.message}${cause.message ? `: ${cause.message}` : ""}`
        : "";
    return {
      bridgeOnline: false,
      configured: true,
      reason: `bridge unreachable: ${err instanceof Error ? err.message : String(err)}${detail ? ` [${detail}]` : ""}`,
      fetchedAt: Date.now(),
    };
  }
}