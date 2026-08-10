import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { listPresets, savePreset } from "@/lib/presets";
import type { Preset } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listPresets());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Preset>;
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
  await savePreset(preset);
  return NextResponse.json(preset, { status: 201 });
}
