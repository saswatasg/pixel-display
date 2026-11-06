import { parseGIF, decompressFrames } from "gifuct-js";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { concat, crc32, integer, textPacket, type Payload } from "./protocol";

function canvas(width: number, height: number) {
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser cannot process images.");
  return { canvas: c, ctx };
}
let fontReady: Promise<FontFace> | undefined;
export async function renderText(p: Payload): Promise<Uint8Array> {
  const text = String(p.text ?? "").trim();
  const chars = [...text];
  if (!chars.length || chars.length > 60) throw new Error("Use 1 to 60 characters.");
  const size = integer(p.size, 16, 8, 32);
  fontReady ??= new FontFace("PixelRain", "url(/fonts/Rain-DRM3.otf)").load().then(f => { document.fonts.add(f); return f; }).catch(e => { fontReady = undefined; throw e; });
  await fontReady;
  const { ctx } = canvas(16, 32);
  ctx.font = `${size}px PixelRain`;
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const bitmaps = new Uint8Array(chars.length * 68);
  chars.forEach((ch, i) => {
    ctx.clearRect(0, 0, 16, 32);
    ctx.fillStyle = "white";
    const metrics = ctx.measureText(ch);
    ctx.fillText(ch, 8, (32 + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
    const pixels = ctx.getImageData(0, 0, 16, 32).data;
    bitmaps.set([5, 255, 255, 255], i * 68);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
      if (pixels[(y * 16 + x) * 4 + 3] >= 128) bitmaps[i * 68 + 4 + y * 2 + (x >> 3)] |= 1 << (x % 8);
    }
  });
  return textPacket(bitmaps, chars.length, p);
}
function pngChunk(type: string, body: Uint8Array) {
  const name = new TextEncoder().encode(type);
  const out = new Uint8Array(body.length + 12), view = new DataView(out.buffer);
  view.setUint32(0, body.length); out.set(name, 4); out.set(body, 8);
  view.setUint32(out.length - 4, crc32(concat(name, body)));
  return out;
}
/** Encode true-color RGB PNG: firmware corrupts canvas's usual RGBA PNGs. */
export async function rgbPng(rgba: Uint8ClampedArray, width = 32, height = 32): Promise<Uint8Array> {
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 2;
  const scanlines = new Uint8Array(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const src = (y * width + x) * 4, dest = y * (width * 3 + 1) + 1 + x * 3;
    const a = rgba[src + 3] / 255;
    for (let c = 0; c < 3; c++) scanlines[dest + c] = Math.round(rgba[src + c] * a);
  }
  const stream = new Blob([scanlines]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return concat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", compressed), pngChunk("IEND", new Uint8Array()));
}
export async function renderImage(file: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  try {
    const { ctx } = canvas(32, 32);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, 32, 32);
    return rgbPng(ctx.getImageData(0, 0, 32, 32).data);
  } finally { bitmap.close(); }
}
export async function renderGif(file: Blob): Promise<Uint8Array> {
  const gif = parseGIF(await file.arrayBuffer());
  // Bound memory before decompression; a small compressed file can contain huge rasters.
  const w = gif.lsd.width, h = gif.lsd.height;
  const imageFrames = gif.frames.filter(f => "image" in f);
  const frameCount = imageFrames.length;
  for (const frame of imageFrames) {
    if (!("image" in frame)) continue;
    const d = frame.image.descriptor;
    if (!d.width || !d.height || d.width > w || d.height > h || d.left + d.width > w || d.top + d.height > h) throw new Error("GIF contains invalid frame dimensions.");
  }
  if (!frameCount || w * h * frameCount > 16_000_000 || frameCount > 500) throw new Error("GIF is too complex. Use a shorter or smaller animation.");
  const frames = decompressFrames(gif, true);
  const source = canvas(w, h), target = canvas(32, 32);
  target.ctx.imageSmoothingEnabled = false;
  const encoder = GIFEncoder();
  let previous: ImageData | undefined;
  for (const frame of frames) {
    if (frame.disposalType === 3) previous = source.ctx.getImageData(0, 0, w, h);
    const patch = canvas(frame.dims.width, frame.dims.height);
    patch.ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height), 0, 0);
    source.ctx.drawImage(patch.canvas, frame.dims.left, frame.dims.top);
    target.ctx.fillStyle = "black"; target.ctx.fillRect(0, 0, 32, 32);
    target.ctx.drawImage(source.canvas, 0, 0, 32, 32);
    const pixels = target.ctx.getImageData(0, 0, 32, 32).data;
    const palette = quantize(pixels, 256);
    encoder.writeFrame(applyPalette(pixels, palette), 32, 32, { palette, delay: Math.max(20, frame.delay || 100), repeat: 0 });
    if (frame.disposalType === 2) source.ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    if (frame.disposalType === 3 && previous) source.ctx.putImageData(previous, 0, 0);
  }
  encoder.finish();
  return encoder.bytes();
}
