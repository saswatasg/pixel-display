import { test } from "node:test";
import assert from "node:assert/strict";
import { exportLibrary, importLibrary, validateBackup } from "../lib/library-backup";
test("library import validates files, merges existing scenes, and preserves data on quota failure", () => {
  const store = new Map<string, string>(); let failKey = "";
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem(k: string) { return store.get(k) ?? null; },
    setItem(k: string, v: string) { if (k === failKey) throw new Error("quota"); store.set(k, v); },
  } });
  const old = { id: "old-id", name: "My clock", action: "clock", payload: { style: 1 }, createdAt: 1, updatedAt: 1 };
  store.set("pixel-display:presets:v2", JSON.stringify([old]));
  const backup = { version: 1, presets: [{ ...old, name: "Imported clock" }], frame: [], history: [] };
  assert.equal(importLibrary(backup), 1);
  assert.equal(exportLibrary().presets[0].id, "old-id");
  assert.equal(exportLibrary().presets.length, 2);
  assert.notEqual(exportLibrary().presets[1].id, "old-id");
  assert.equal(importLibrary(backup), 0);
  assert.throws(() => validateBackup({ ...backup, version: 2 }), /version/);
  assert.throws(() => validateBackup({ ...backup, presets: [{ ...old, action: "reset" }] }), /invalid scene/);
  assert.throws(() => validateBackup({ ...backup, frame: [{ name: "Remote", url: "https://example.org/photo.png" }] }), /invalid image/);
  const before = JSON.stringify(exportLibrary());
  failKey = "pixel-display:frame:v2";
  assert.throws(() => importLibrary({ ...backup, presets: [{ ...old, name: "Must roll back" }] }), /blocked or full/);
  assert.equal(JSON.stringify(exportLibrary()), before);
});
