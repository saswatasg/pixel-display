import { test } from "node:test";
import assert from "node:assert/strict";
import { bluetooth, bluetoothSupport } from "../lib/bluetooth/client";
import { SERVICE_UUID, WRITE_UUID } from "../lib/bluetooth/protocol";

// The fake GATT device exercises real controller queueing and lifecycle, without radio access.
test("Bluetooth lifecycle, queue ordering, disconnects and retry behavior", async () => {
  const calls: number[][] = [];
  let connected = false, chooserCalls = 0, active = 0, maxActive = 0;
  let failWrite = false, release: (() => void) | undefined;
  let gate: Promise<void> | undefined;
  const handlers = new Set<() => void>();
  const writer = {
    properties: { write: true, writeWithoutResponse: true },
    async writeValueWithoutResponse(data: Uint8Array) {
      active++; maxActive = Math.max(active, maxActive);
      try {
        if (gate) await gate;
        if (failWrite) throw new Error("radio unavailable");
        calls.push([...data]);
      } finally { active--; }
    },
    async writeValueWithResponse(data: Uint8Array) { await this.writeValueWithoutResponse(data); },
  };
  const device = {
    id: "test-id", name: "IDM-test",
    addEventListener(_: string, h: () => void) { handlers.add(h); },
    removeEventListener(_: string, h: () => void) { handlers.delete(h); },
    gatt: {
      get connected() { return connected; },
      async connect() { connected = true; return this; },
      disconnect() { const old = connected; connected = false; if (old) handlers.forEach(h => h()); },
      async getPrimaryService(uuid: string) {
        assert.equal(uuid, SERVICE_UUID);
        return { async getCharacteristic(id: string) { assert.equal(id, WRITE_UUID); return writer; } };
      },
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { isSecureContext: true } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { bluetooth: {
    async requestDevice(options: unknown) {
      chooserCalls++;
      assert.deepEqual(options, { filters: [{ namePrefix: "IDM-" }], optionalServices: [SERVICE_UUID] });
      return device;
    },
  } } });
  assert.equal(bluetoothSupport(), null);
  assert.equal((await bluetooth.action("brightness", { value: 50 })).ok, false);
  let updates = 0; const unsubscribe = bluetooth.subscribe(() => updates++);
  await bluetooth.connect();
  assert.equal(bluetooth.connected, true);
  const results = await Promise.all([bluetooth.action("brightness", { value: 30 }), bluetooth.action("screen", { power: "on" }), bluetooth.action("scoreboard", { score1: 300, score2: 2 })]);
  assert.ok(results.every(r => r.ok)); assert.equal(maxActive, 1);
  assert.deepEqual(calls.map(c => c.slice(2, 4)), [[4, 128], [7, 1], [7, 1], [4, 1], [10, 128]]);
  assert.equal((await bluetooth.action("stocks", {})).ok, false);
  assert.equal((await bluetooth.action("schedule", {})).ok, false);
  const before = calls.length;
  assert.equal((await bluetooth.action("brightness", { value: 200 })).ok, false);
  assert.equal(calls.length, before);

  // A queued command from an old connection must not be sent after reconnection.
  gate = new Promise<void>(resolve => { release = resolve; });
  const a = bluetooth.action("brightness", { value: 35 });
  const b = bluetooth.action("brightness", { value: 40 });
  await new Promise(resolve => setTimeout(resolve, 0));
  bluetooth.disconnect();
  await bluetooth.connect(); // reconnect before the old write finishes
  release!(); gate = undefined;
  const stale = await Promise.all([a, b]);
  assert.ok(stale.every(r => !r.ok));
  assert.equal(bluetooth.connected, true); // stale failure must not disconnect the new session
  assert.equal(chooserCalls, 1); // reconnect uses the already-granted device
  assert.equal(calls.some(c => c[4] === 40), false);
  assert.ok((await bluetooth.action("brightness", { value: 45 })).ok);

  failWrite = true;
  assert.equal((await bluetooth.action("screen", { power: "on" })).ok, false);
  assert.equal(bluetooth.connected, false);
  failWrite = false; await bluetooth.connect();
  bluetooth.disconnect(true); await bluetooth.connect();
  assert.equal(chooserCalls, 2); // choose another requests browser permission again
  device.gatt.disconnect();
  assert.equal(bluetooth.status().device.connected, false);
  assert.match(bluetooth.status().reason!, /Reconnect/);
  assert.ok(updates > 0); unsubscribe(); bluetooth.disconnect(true);

  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  assert.match(bluetoothSupport()!, /cannot access Bluetooth/);
  (globalThis as unknown as { window: { isSecureContext: boolean } }).window.isSecureContext = false;
  assert.match(bluetoothSupport()!, /HTTPS/);
});
