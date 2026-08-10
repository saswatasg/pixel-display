import { NextResponse } from "next/server";
import { BRIDGE_API_KEY, BRIDGE_CONFIGURED, BRIDGE_URL, bridgeFetch } from "@/lib/bridge-server";
import type { MediaItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!BRIDGE_CONFIGURED) {
    return NextResponse.json({ ok: false, media: [], error: "bridge not configured" }, { status: 502 });
  }
  try {
    const res = await bridgeFetch(`${BRIDGE_URL}/actions/media-list`, {
      headers: { "X-API-Key": BRIDGE_API_KEY },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, media: [], error: `bridge returned HTTP ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as { ok: boolean; media: MediaItem[] };
    return NextResponse.json({ ok: true, media: data.media ?? [] });
  } catch (err) {
    return NextResponse.json(
      { ok: false, media: [], error: err instanceof Error ? err.message : "bridge unreachable" },
      { status: 502 },
    );
  }
}