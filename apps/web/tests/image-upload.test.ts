import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { bluetooth } from "../lib/bluetooth/client";
import { crc32 } from "../lib/bluetooth/protocol";

test("image upload uses acknowledged fragments and transfers a complete decodable RGB PNG", async () => {
  let connected = false;
  const writes: { data: Uint8Array; acknowledged: boolean; at: number }[] = [];
  const writer = {
    properties: { write: true, writeWithoutResponse: true },
    async writeValueWithResponse(data: Uint8Array) { writes.push({ data: data.slice(), acknowledged: true, at: performance.now() }); },
    async writeValueWithoutResponse(data: Uint8Array) { writes.push({ data: data.slice(), acknowledged: false, at: performance.now() }); },
  };
  const device = {
    id: "image-test", name: "IDM-image-test", addEventListener() {}, removeEventListener() {},
    gatt: {
      get connected() { return connected; },
      async connect() { connected = true; return this; },
      disconnect() { connected = false; },
      async getPrimaryService() { return { async getCharacteristic() { return writer; } }; },
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { isSecureContext: true } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { bluetooth: { async requestDevice() { return device; } } } });
  const rgba = new Uint8ClampedArray(32 * 32 * 4);
  let seed = 12345;
  for (let i = 0; i < rgba.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    rgba[i] = i % 4 === 3 ? 255 : seed >>> 24;
  }
  let closed = false;
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => ({ close() { closed = true; } }) });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement() { return { getContext() { return { drawImage() {}, getImageData() { return { data: rgba }; } }; } }; },
  } });
  await bluetooth.connect();
  const result = await bluetooth.file("image", new File(["fixture"], "fixture.png", { type: "image/png" }));
  assert.equal(result.ok, true, result.error);
  assert.ok(closed);
  assert.ok(writes.length > 100); // realistic photo-sized transfer, not one tiny command
  assert.ok(writes.every(w => w.acknowledged)); // the previous implementation failed here
  assert.ok(writes.every(w => w.data.length <= 20));
  assert.deepEqual([...writes[0].data], [5, 0, 7, 1, 1]);
  assert.deepEqual([...writes[1].data], [5, 0, 4, 1, 1]);
  assert.ok(writes[2].at - writes[1].at >= 45, "firmware needs time to enter image mode");
  const packet = Buffer.concat(writes.slice(2).map(w => Buffer.from(w.data)));
  const pngLength = packet.readUInt32LE(5);
  assert.equal(packet.length, pngLength + 9);
  assert.equal(packet.readUInt16LE(0), pngLength + 1);
  const png = packet.subarray(9);
  assert.equal(png[25], 2); // RGB, never RGBA
  const compressed: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const n = png.readUInt32BE(at), kind = png.toString("ascii", at + 4, at + 8);
    assert.equal(png.readUInt32BE(at + n + 8), crc32(png.subarray(at + 4, at + n + 8)));
    if (kind === "IDAT") compressed.push(png.subarray(at + 8, at + 8 + n));
    at += n + 12;
  }
  const rows = inflateSync(Buffer.concat(compressed));
  for (let y = 0; y < 32; y++) {
    assert.equal(rows[y * 97], 0);
    for (let x = 0; x < 32; x++) for (let c = 0; c < 3; c++) assert.equal(rows[y * 97 + 1 + x * 3 + c], rgba[(y * 32 + x) * 4 + c]);
  }

  // Panels that expose only write-without-response need explicit per-fragment pacing.
  writes.length = 0; writer.properties.write = false;
  assert.ok((await bluetooth.file("image", new File(["fixture"], "fixture.png", { type: "image/png" }))).ok);
  assert.ok(writes.every(w => !w.acknowledged));
  for (let i = 3; i < writes.length; i++) assert.ok(writes[i].at - writes[i - 1].at >= 10, "unacknowledged fragments must not form an unpaced burst");
  bluetooth.disconnect(true);
});
