import { NextResponse } from "next/server";
import { deletePreset, listPresets, savePreset } from "@/lib/presets";
import type { Preset } from "@/lib/types";

export const dynamic = "force-dynamic";

async function findPreset(id: string): Promise<Preset | null> {
  const presets = await listPresets();
  return presets.find((p) => p.id === id) ?? null;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Partial<Preset> & { meta?: { pinned?: boolean; plays?: number } };
  try {
    body = (await request.json()) as Partial<Preset> & { meta?: { pinned?: boolean; plays?: number } };
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  try {
    const existing = await findPreset(id);
    if (!existing) return NextResponse.json({ error: "preset not found" }, { status: 404 });
    if (!body.name?.trim() || !body.action) {
      return NextResponse.json({ error: "name and action are required" }, { status: 400 });
    }
    const meta = body.meta ?? {};
    const updated: Preset = {
      ...existing,
      name: body.name.trim(),
      action: body.action,
      payload: (body.payload ?? {}) as Record<string, unknown>,
      updatedAt: Date.now(),
      ...(typeof meta.pinned === "boolean" ? { pinned: meta.pinned } : {}),
      ...(typeof meta.plays === "number" ? { plays: meta.plays } : {}),
    };
    await savePreset(updated);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "update failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deletePreset(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}