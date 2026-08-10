import { NextResponse } from "next/server";
import { deletePreset, listPresets, savePreset } from "@/lib/presets";
import type { Preset } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Partial<Preset>;
  const presets = await listPresets();
  const existing = presets.find((p) => p.id === id);
  if (!existing) return NextResponse.json({ error: "preset not found" }, { status: 404 });
  if (!body.name?.trim() || !body.action) {
    return NextResponse.json({ error: "name and action are required" }, { status: 400 });
  }
  const updated: Preset = {
    ...existing,
    name: body.name.trim(),
    action: body.action,
    payload: (body.payload ?? {}) as Record<string, unknown>,
    updatedAt: Date.now(),
  };
  await savePreset(updated);
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletePreset(id);
  return NextResponse.json({ ok: true });
}
