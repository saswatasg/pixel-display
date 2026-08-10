import { NextResponse } from "next/server";
import { BRIDGE_API_KEY, BRIDGE_CONFIGURED, BRIDGE_URL, bridgeFetch } from "@/lib/bridge-server";
import type { ActionResult } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { error: text.slice(0, 200) };
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, sent: false, action, error: "bridge error: " + res.status },
        { status: 502 },
      );
    }
    return NextResponse.json(json as ActionResult);
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
