import { NextResponse } from "next/server";
import { BLOB_READY, addToCollection, getCollection, removeFromCollection } from "@/lib/blob-store";

export const dynamic = "force-dynamic";

const PAST_LIMIT = 10;

function notReady() {
  return NextResponse.json({ ok: false, error: "cloud media storage is not configured (BLOB_READ_WRITE_TOKEN)" }, { status: 503 });
}

export async function GET() {
  if (!BLOB_READY) return notReady();
  try {
    return NextResponse.json({ ok: true, media: await getCollection("past") });
  } catch (err) {
    return NextResponse.json(
      { ok: false, media: [], error: err instanceof Error ? err.message : "storage error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!BLOB_READY) return notReady();
  let body: { name?: string; dataUrl?: string };
  try {
    body = (await request.json()) as { name?: string; dataUrl?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON {name, dataUrl}" }, { status: 400 });
  }
  if (!body.name || !body.dataUrl) {
    return NextResponse.json({ ok: false, error: "name and dataUrl are required" }, { status: 400 });
  }
  try {
    const result = await addToCollection("past", body.name, body.dataUrl, PAST_LIMIT, "past");
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, item: result.item });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "upload failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!BLOB_READY) return notReady();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  try {
    const result = await removeFromCollection("past", id);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}