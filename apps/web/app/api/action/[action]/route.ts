import { NextResponse } from "next/server";
import { BRIDGE_API_KEY, BRIDGE_CONFIGURED, BRIDGE_URL, bridgeFetch } from "@/lib/bridge-server";
import type { ActionResult } from "@/lib/types";

export const dynamic = "force-dynamic";
// Let a big GIF upload / slow bridge round-trip finish inside the function
// budget (Vercel's default is 10s, our bridge timeout is 25s).
export const maxDuration = 30;

// Only actions the app actually uses may be forwarded to the bridge; anything
// else is rejected here so internal/administrative bridge endpoints can't be
// reached through the public web layer.
const ALLOWED_ACTIONS = new Set([
  "text",
  "image",
  "gif",
  "clock",
  "brightness",
  "screen",
  "flip",
  "chronograph",
  "countdown",
  "fullscreen-color",
  "animation",
  "scoreboard",
  "sync-time",
  "reset",
  "weather",
  "stocks",
  "slideshow",
  "slideshow-next",
  "scene",
  "schedule",
  "automation-off",
  "wake",
  "media-sync",
]);

async function forward(action: string, body: FormData | Record<string, unknown>) {
  try {
    const isForm = body instanceof FormData;
    const res = await bridgeFetch(`${BRIDGE_URL}/actions/${action}`, {
      method: "POST",
      headers: isForm
        ? { "X-API-Key": BRIDGE_API_KEY }
        : { "X-API-Key": BRIDGE_API_KEY, "Content-Type": "application/json" },
      body: isForm ? (body as FormData) : JSON.stringify(body),
    }, 25_000);
    const text = await res.text();
    let detail = "";
    if (text) {
      try {
        const json = JSON.parse(text) as { detail?: unknown };
        if (typeof json.detail === "string") detail = json.detail;
      } catch {
        // non-JSON body (e.g. a platform proxy error) — keep detail empty so we
        // never echo raw bridge output to clients.
      }
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, sent: false, action, error: detail || `bridge error: ${res.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json(JSON.parse(text || "{}") as ActionResult);
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "bridge timeout" : "bridge unreachable";
    return NextResponse.json({ ok: false, sent: false, action, error: message }, { status: 502 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, sent: false, action, error: "action not allowed" }, { status: 403 });
  }
  if (!BRIDGE_CONFIGURED) {
    return NextResponse.json(
      { ok: false, sent: false, action, error: "bridge not configured (BRIDGE_URL / BRIDGE_API_KEY)" },
      { status: 502 },
    );
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return forward(action, form);
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return forward(action, body);
}
