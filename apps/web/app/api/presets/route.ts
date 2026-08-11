import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { listPresets, savePreset } from "@/lib/presets";
import type { Preset } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listPresets());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "storage error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: Partial<Preset>;
  try {
    body = (await request.json()) as Partial<Preset>;
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (!body.name?.trim() || !body.action) {
    return NextResponse.json({ error: "name and action are required" }, { status: 400 });
  }
  const now = Date.now();
  const preset: Preset = {
    id: randomUUID(),
    name: body.name.trim(),
    action: body.action,
    payload: (body.payload ?? {}) as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await savePreset(preset);
    return NextResponse.json(preset, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}