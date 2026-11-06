// iDotMatrix protocol port from idotmatrix 0.0.9 by derkalle4 and contributors.
// Modified: TypeScript packet encoding for the browser. GPL-3.0; see LICENSE.
export const SERVICE_UUID = "000000fa-0000-1000-8000-00805f9b34fb";
export const READ_UUID = "0000fa03-0000-1000-8000-00805f9b34fb";
export const WRITE_UUID = "0000fa02-0000-1000-8000-00805f9b34fb";
export type Payload = Record<string, unknown>;

export function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function integer(value: unknown, fallback: number, min: number, max: number): number {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Expected a number from ${min} to ${max}.`);
  return n;
}
export function rgb(value: unknown = "#FFFFFF"): number[] {
  if (typeof value !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) throw new Error("Invalid color.");
  let hex = value.slice(1);
  if (hex.length === 3) hex = [...hex].map(c => c + c).join("");
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
}
function packet(...bytes: number[]) { return new Uint8Array(bytes); }
export function timePacket(now = new Date()): Uint8Array {
  return packet(11, 0, 1, 128, now.getFullYear() % 100, now.getMonth() + 1, now.getDate(), (now.getDay() + 6) % 7 + 1, now.getHours(), now.getMinutes(), now.getSeconds());
}
export function commandPackets(action: string, p: Payload): Uint8Array[] {
  switch (action) {
    case "sync-time": return [timePacket()];
    case "brightness": return [packet(5, 0, 4, 128, integer(p.value, 50, 5, 100))];
    case "screen":
      if (p.power !== "on" && p.power !== "off") throw new Error("Choose screen on or off.");
      return [packet(5, 0, 7, 1, p.power === "on" ? 1 : 0)];
    case "flip": return [packet(5, 0, 6, 128, p.enabled ? 1 : 0)];
    case "clock": return [packet(8, 0, 6, 1, integer(p.style, 0, 0, 7) | (p.showDate !== false ? 128 : 0) | (p.format24h !== false ? 64 : 0), ...rgb(p.color)), ...(p.syncTime !== false ? [timePacket()] : [])];
    case "fullscreen-color": return [packet(7, 0, 2, 2, ...rgb(p.color ?? "#000000"))];
    case "chronograph": {
      const mode = ["reset", "start", "pause", "resume"].indexOf(String(p.mode ?? "start"));
      if (mode < 0) throw new Error("Invalid stopwatch mode.");
      return [packet(5, 0, 9, 128, mode)];
    }
    case "countdown": {
      const seconds = p.cancel ? 0 : integer(p.seconds, 0, 1, 3599);
      return [packet(7, 0, 8, 128, p.cancel ? 0 : 1, Math.floor(seconds / 60), seconds % 60)];
    }
    case "scoreboard": {
      const a = integer(p.score1, 0, 0, 999), b = integer(p.score2, 0, 0, 999);
      return [packet(8, 0, 10, 128, a & 255, a >> 8, b & 255, b >> 8)];
    }
    case "animation": {
      const colors = p.colors ?? ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"];
      if (!Array.isArray(colors) || colors.length < 2 || colors.length > 7) throw new Error("Choose 2 to 7 colors.");
      return [packet(6 + colors.length, 0, 3, 2, integer(p.style, 0, 0, 6), integer(p.speed, 90, 0, 255), colors.length, ...colors.flatMap(c => rgb(c)))];
    }
    case "reset": return [packet(4, 0, 3, 128), packet(5, 0, 4, 128, 80)];
    default: throw new Error(`Unknown display command: ${action}`);
  }
}
export function textPacket(bitmaps: Uint8Array, count: number, p: Payload): Uint8Array {
  if (count < 1 || count > 60 || bitmaps.length !== count * 68) throw new Error("Use 1 to 60 characters.");
  const metadata = packet(count, 0, 0, 1, integer(p.mode, 1, 0, 8), integer(p.speed, 95, 0, 255), integer(p.color_mode, 1, 0, 5), ...rgb(p.color), p.bg_color ? 1 : 0, ...rgb(p.bg_color ?? "#000000"));
  const body = concat(metadata, bitmaps);
  const head = new Uint8Array(16), view = new DataView(head.buffer);
  view.setUint16(0, body.length + 16, true);
  head[2] = 3;
  view.setUint32(5, body.length, true);
  view.setUint32(9, crc32(body), true);
  head[15] = 12;
  return concat(head, body);
}
export function imagePackets(png: Uint8Array): Uint8Array[] {
  const total = png.length + Math.ceil(png.length / 4096);
  if (!png.length || total > 32767) throw new Error("Image is too large for the display.");
  const out: Uint8Array[] = [];
  for (let i = 0; i < png.length; i += 4096) {
    const head = new Uint8Array(9), view = new DataView(head.buffer);
    view.setUint16(0, total, true);
    head[4] = i ? 2 : 0;
    view.setUint32(5, png.length, true);
    out.push(concat(head, png.slice(i, i + 4096)));
  }
  return out;
}
export function gifPackets(gif: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < gif.length; i += 4096) {
    const chunk = gif.slice(i, i + 4096);
    const head = new Uint8Array(16), view = new DataView(head.buffer);
    view.setUint16(0, chunk.length + 16, true);
    head[2] = 1; head[4] = i ? 2 : 0;
    view.setUint32(5, gif.length, true);
    view.setUint32(9, crc32(gif), true);
    head.set([5, 0, 13], 13);
    out.push(concat(head, chunk));
  }
  return out;
}

/** Content sends must wake the panel; native modes must leave DIY draw mode. */
export function prepareContent(action: string): Uint8Array[] {
  if (!["text", "clock", "animation", "fullscreen-color", "chronograph", "countdown", "scoreboard", "image", "gif"].includes(action)) return [];
  return [packet(5, 0, 7, 1, 1), packet(5, 0, 4, 1, action === "image" ? 1 : 0)];
}
