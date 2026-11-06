import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreset, listPresets, updatePreset, deletePreset, getPrefs, savePrefs } from "../lib/api";
import { listFrameMedia, uploadFrameMedia, deleteFrameMedia, addPastImage, listPastImages } from "../lib/media";
import { DEFAULT_PREFS } from "../lib/prefs";

test("libraries and settings persist locally without calling a server", async () => {
  const data = new Map<string, string>(); let blocked = false;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, value: string) { if (blocked) throw new Error("blocked"); data.set(key, value); },
  } });
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: () => { throw new Error("Unexpected network request"); } });
  assert.deepEqual(await listPresets(), []);
  const preset = await createPreset("Clock", "clock", { style: 2 });
  assert.ok(preset?.id);
  await updatePreset(preset.id, preset.name, preset.action, preset.payload, { pinned: true, plays: 3 });
  assert.equal((await listPresets())[0].plays, 3);
  assert.ok((await listPresets())[0].pinned);
  assert.ok(await deletePreset(preset.id)); assert.deepEqual(await listPresets(), []);
  await savePrefs({ ...DEFAULT_PREFS, brightness: 80 });
  assert.equal((await getPrefs()).brightness, 80);
  const image = "data:image/png;base64,test";
  for (let i = 0; i < 4; i++) assert.ok((await uploadFrameMedia(image, `photo ${i}`)).ok);
  assert.equal((await uploadFrameMedia(image, "overflow")).ok, false);
  const photos = await listFrameMedia(); assert.equal(photos.length, 4);
  assert.ok((await deleteFrameMedia(photos[0].id)).ok);
  assert.equal((await listFrameMedia()).length, 3);
  for (let i = 0; i < 30; i++) await addPastImage(image, `past ${i}`);
  assert.equal((await listPastImages()).length, 24);
  data.set("pixel-display:presets:v2", "corrupt JSON");
  assert.deepEqual(await listPresets(), []);
  blocked = true;
  await assert.rejects(createPreset("Clock", "clock", {}), /blocked or full/);
  assert.equal((await uploadFrameMedia(image, "blocked")).ok, false);
});
