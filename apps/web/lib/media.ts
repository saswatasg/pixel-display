export interface CloudMediaItem {
  id: string;
  name: string;
  url: string;
  addedAt: number;
  size: number;
}

export async function toPixelDataUrl(f: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(f);
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, 32, 32);
    bitmap.close();
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
}

async function bodyOf<T>(res: Response, fallback?: unknown): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return fallback as T;
  }
}

export async function listFrameMedia(): Promise<CloudMediaItem[]> {
  try {
    const res = await fetch("/api/media", { cache: "no-store" });
    const data = await bodyOf<{ ok: boolean; media?: CloudMediaItem[]; error?: string }>(res, {});
    return data.media ?? [];
  } catch {
    return [];
  }
}

export async function uploadFrameMedia(
  dataUrl: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dataUrl }),
    });
    return await bodyOf<{ ok: boolean; error?: string }>(res, { ok: false, error: "Upload failed" });
  } catch {
    return { ok: false, error: "Network error — upload not saved" };
  }
}

export async function deleteFrameMedia(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/media?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return await bodyOf<{ ok: boolean; error?: string }>(res, { ok: false, error: "Remove failed" });
  } catch {
    return { ok: false, error: "Network error — not removed" };
  }
}

export async function listPastImages(): Promise<CloudMediaItem[]> {
  try {
    const res = await fetch("/api/past", { cache: "no-store" });
    const data = await bodyOf<{ ok: boolean; media?: CloudMediaItem[]; error?: string }>(res, {});
    return data.media ?? [];
  } catch {
    return [];
  }
}

export async function addPastImage(
  dataUrl: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/past", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dataUrl }),
    });
    return await bodyOf<{ ok: boolean; error?: string }>(res, { ok: false, error: "Save failed" });
  } catch {
    return { ok: false, error: "Network error — not saved" };
  }
}

export async function deletePastImage(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/past?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return await bodyOf<{ ok: boolean; error?: string }>(res, { ok: false, error: "Remove failed" });
  } catch {
    return { ok: false, error: "Network error — not removed" };
  }
}