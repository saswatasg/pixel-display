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

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function listFrameMedia(): Promise<CloudMediaItem[]> {
  const res = await fetch("/api/media", { cache: "no-store" });
  const data = await json<{ ok: boolean; media?: CloudMediaItem[]; error?: string }>(res);
  return data.media ?? [];
}

export async function uploadFrameMedia(dataUrl: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, dataUrl }),
  });
  const data = await json<{ ok: boolean; error?: string }>(res);
  return data;
}

export async function deleteFrameMedia(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/media?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return json<{ ok: boolean; error?: string }>(res);
}

export async function listPastImages(): Promise<CloudMediaItem[]> {
  const res = await fetch("/api/past", { cache: "no-store" });
  const data = await json<{ ok: boolean; media?: CloudMediaItem[]; error?: string }>(res);
  return data.media ?? [];
}

export async function addPastImage(dataUrl: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/past", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, dataUrl }),
  });
  return json<{ ok: boolean; error?: string }>(res);
}

export async function deletePastImage(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/past?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return json<{ ok: boolean; error?: string }>(res);
}
