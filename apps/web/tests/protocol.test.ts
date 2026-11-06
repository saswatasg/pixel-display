import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { commandPackets, prepareContent, crc32, gifPackets, imagePackets, textPacket, timePacket, SERVICE_UUID } from "../lib/bluetooth/protocol";
import { rgbPng } from "../lib/bluetooth/render";

const bytes = (action: string, p = {}) => [...commandPackets(action, p)[0]];
test("core commands match the pinned Python driver's wire format", () => {
  assert.deepEqual(bytes("brightness", { value: 75 }), [5, 0, 4, 128, 75]);
  assert.deepEqual(bytes("screen", { power: "off" }), [5, 0, 7, 1, 0]);
  assert.deepEqual(bytes("flip", { enabled: true }), [5, 0, 6, 128, 1]);
  assert.deepEqual(bytes("clock", { style: 7, color: "#123456", showDate: false, format24h: true }), [8, 0, 6, 1, 71, 18, 52, 86]);
  assert.deepEqual(bytes("countdown", { seconds: 125 }), [7, 0, 8, 128, 1, 2, 5]);
  assert.deepEqual(bytes("countdown", { cancel: true }), [7, 0, 8, 128, 0, 0, 0]);
  assert.deepEqual(bytes("scoreboard", { score1: 999, score2: 256 }), [8, 0, 10, 128, 231, 3, 0, 1]);
  assert.deepEqual(bytes("chronograph", { mode: "resume" }), [5, 0, 9, 128, 3]);
  assert.deepEqual(bytes("fullscreen-color", { color: "#abc" }), [7, 0, 2, 2, 170, 187, 204]);
  assert.equal(SERVICE_UUID, "000000fa-0000-1000-8000-00805f9b34fb");
});
test("invalid values are rejected before encoding", () => {
  for (const p of [{ value: 0 }, { value: NaN }, { value: 101 }, { value: 5.5 }]) assert.throws(() => bytes("brightness", p));
  assert.throws(() => bytes("scoreboard", { score1: 1000 }));
  assert.throws(() => bytes("screen", { power: "maybe" }));
  assert.throws(() => bytes("animation", { colors: ["#fff"] }));
  assert.throws(() => bytes("clock", { color: "garbage" }));
});
test("animation retains the firmware-specific length byte", () => {
  assert.deepEqual(bytes("animation", { style: 2, speed: 150, colors: ["#FF0000", "#00FF00"] }), [8, 0, 3, 2, 2, 150, 2, 255, 0, 0, 0, 255, 0]);
});
test("time sync uses local device time and Monday-based weekday", () => {
  assert.deepEqual([...timePacket(new Date(2026, 10, 6, 12, 34, 56))], [11, 0, 1, 128, 26, 11, 6, 5, 12, 34, 56]);
});
test("CRC and text metadata match independent reference vector", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const bitmap = new Uint8Array(68); bitmap.set([5, 255, 255, 255]); bitmap[4] = 0x81;
  const data = textPacket(bitmap, 1, { mode: 1, speed: 95, color_mode: 1, color: "#FF0000" });
  const view = new DataView(data.buffer);
  assert.equal(view.getUint16(0, true), data.length);
  assert.equal(view.getUint32(5, true), data.length - 16);
  assert.equal(view.getUint32(9, true), crc32(data.slice(16)));
  assert.deepEqual([...data.slice(16, 30)], [1, 0, 0, 1, 1, 95, 1, 255, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(data.slice(30), bitmap);
});
test("image headers and continuation preserve all payload bytes", () => {
  const png = Uint8Array.from({ length: 5000 }, (_, i) => i & 255);
  const parts = imagePackets(png);
  assert.equal(parts.length, 2);
  assert.deepEqual([...parts[0].slice(0, 9)], [138, 19, 0, 0, 0, 136, 19, 0, 0]);
  assert.equal(parts[1][4], 2);
  assert.deepEqual(Buffer.concat(parts.map(p => Buffer.from(p.slice(9)))), Buffer.from(png));
});
test("GIF chunks carry lengths, CRC and continuation flags", () => {
  const gif = new Uint8Array(5000).fill(42), parts = gifPackets(gif);
  assert.equal(parts.length, 2);
  parts.forEach((p, i) => {
    const v = new DataView(p.buffer);
    assert.equal(v.getUint16(0, true), p.length);
    assert.equal(v.getUint32(5, true), gif.length);
    assert.equal(v.getUint32(9, true), crc32(gif));
    assert.equal(p[4], i ? 2 : 0);
  });
});
test("PNG encoder emits RGB, valid chunks, and black-composited transparency", async () => {
  const png = await rgbPng(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128]), 2, 1);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png[25], 2); // PNG color type: RGB, not RGBA
  let at = 8; const idat: Buffer[] = [];
  while (at < png.length) {
    const v = new DataView(png.buffer, png.byteOffset + at), n = v.getUint32(0);
    const type = Buffer.from(png.slice(at + 4, at + 8)).toString();
    assert.equal(v.getUint32(n + 8), crc32(png.slice(at + 4, at + 8 + n)));
    if (type === "IDAT") idat.push(Buffer.from(png.slice(at + 8, at + 8 + n)));
    at += n + 12;
  }
  assert.deepEqual([...inflateSync(Buffer.concat(idat))], [0, 255, 0, 0, 0, 128, 0]);
});

test("content wakes the screen and leaves the previous drawing mode", () => {
  for (const action of ["text", "clock", "animation", "fullscreen-color", "scoreboard", "countdown", "chronograph", "gif"]) {
    assert.deepEqual(prepareContent(action).map(p => [...p]), [[5, 0, 7, 1, 1], [5, 0, 4, 1, 0]]);
  }
  assert.deepEqual(prepareContent("image").map(p => [...p]), [[5, 0, 7, 1, 1], [5, 0, 4, 1, 1]]);
  for (const action of ["screen", "brightness", "sync-time", "flip"]) assert.deepEqual(prepareContent(action), []);
});
