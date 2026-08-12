import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import { DEFAULT_PREFS, sanitizePrefs, type AppPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

const PREFS_PATH = "prefs.json";

async function loadPrefs(): Promise<AppPrefs> {
  try {
    const found = await list({ prefix: PREFS_PATH, limit: 10 });
    const blob = found.blobs.find((b) => b.pathname === PREFS_PATH);
    if (!blob) return DEFAULT_PREFS;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return DEFAULT_PREFS;
    return sanitizePrefs(await res.json());
  } catch {
    return DEFAULT_PREFS;
  }
}

async function persist(prefs: AppPrefs): Promise<void> {
  await put(PREFS_PATH, JSON.stringify(sanitizePrefs(prefs)), {
    contentType: "application/json",
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, prefs: await loadPrefs() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "storage error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON" }, { status: 400 });
  }
  try {
    const prefs = sanitizePrefs(raw);
    await persist(prefs);
    return NextResponse.json({ ok: true, prefs });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}