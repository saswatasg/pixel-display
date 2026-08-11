import { del, list, put } from "@vercel/blob";
import type { CloudMediaItem } from "./media";

export const BLOB_READY = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const INDEX_KEY = "catalog";

function sanitizeName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, "").replace(/\.+$/, "").trim();
  if (!clean) return "photo.png";
  const base = clean.endsWith(".png") ? clean.slice(0, -4) : clean.replace(/\.[^.]+$/, "") || clean;
  return base + ".png";
}

async function listBlobs(prefix: string): Promise<{ url: string; pathname: string }[]> {
  const found: { url: string; pathname: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const b of page.blobs) found.push({ url: b.url, pathname: b.pathname });
    cursor = page.cursor;
  } while (cursor);
  return found;
}

async function readCatalog(collection: string): Promise<CloudMediaItem[]> {
  const indexPath = `${collection}/${INDEX_KEY}.json`;
  const blobs = await listBlobs(`${collection}/`);
  const index = blobs.find((b) => b.pathname === indexPath);
  if (!index) return [];
  try {
    const res = await fetch(index.url, { cache: "no-store" });
    if (!res.ok) return [];
    const items = (await res.json()) as CloudMediaItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function writeCatalog(collection: string, items: CloudMediaItem[]) {
  await put(`${collection}/${INDEX_KEY}.json`, JSON.stringify(items), {
    contentType: "application/json",
    access: "public",
    addRandomSuffix: false,
  });
}

export async function getCollection(collection: string): Promise<CloudMediaItem[]> {
  return readCatalog(collection);
}

export async function addToCollection(
  collection: string,
  name: string,
  dataUrl: string,
  maxItems: number,
  idPrefix: string,
): Promise<{ ok: boolean; item?: CloudMediaItem; error?: string }> {
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64) return { ok: false, error: "invalid image payload" };
  const cleanName = sanitizeName(name);
  const current = await readCatalog(collection);
  const existing = current.find((it) => it.name === cleanName);
  const id = existing?.id ?? `${idPrefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const pathname = `${collection}/${id}.png`;
  const buffer = Buffer.from(base64, "base64");
  const blob = await put(pathname, buffer, { contentType: "image/png", access: "public", addRandomSuffix: false });
  const item: CloudMediaItem = { id, name: cleanName, url: blob.url, addedAt: Date.now(), size: buffer.length };
  let next = [item, ...current.filter((it) => it.id !== id)];
  const evicted = next.slice(maxItems).map((it) => it.id);
  next = next.slice(0, maxItems);
  await writeCatalog(collection, next);
  for (const evictedId of evicted) {
    try {
      await del(`${collection}/${evictedId}.png`);
    } catch {
      // orphan blob — harmless
    }
  }
  return { ok: true, item };
}

export async function removeFromCollection(collection: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const current = await readCatalog(collection);
  const item = current.find((it) => it.id === id);
  if (!item) return { ok: false, error: "not found" };
  const next = current.filter((it) => it.id !== id);
  await writeCatalog(collection, next);
  try {
    await del(`${collection}/${id}.png`);
  } catch {
    // already gone
  }
  return { ok: true };
}