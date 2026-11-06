import { test } from "node:test";
import assert from "node:assert/strict";
import { bluetooth, BLUETOOTH_BUILD } from "../lib/bluetooth/client";
import { READ_UUID } from "../lib/bluetooth/protocol";

test("red test wakes the panel and diagnostics include real device responses", async () => {
  let connected = false, receive: ((event: unknown) => void) | undefined;
  const sent: number[][] = [];
  const reader = {
    properties: { notify: true }, value: undefined as DataView | undefined,
    addEventListener(_: string, handler: (event: unknown) => void) { receive = handler; },
    removeEventListener() { receive = undefined; },
    async startNotifications() { return this; },
  };
  const writer = {
    properties: { write: true, writeWithoutResponse: true },
    async writeValueWithResponse(data: Uint8Array) {
      sent.push([...data]);
      reader.value = new DataView(new Uint8Array([5, 0, data[2], data[3], 1]).buffer);
      receive?.({ target: reader });
    },
  };
  const device = {
    id: "test", name: "IDM-test", addEventListener() {}, removeEventListener() {},
    gatt: {
      get connected() { return connected; }, async connect() { connected = true; return this; }, disconnect() { connected = false; },
      async getPrimaryService() { return { async getCharacteristic(id: string) { return id === READ_UUID ? reader : writer; } }; },
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { isSecureContext: true } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "test browser", bluetooth: { async requestDevice() { return device; } } } });
  await bluetooth.connect();
  assert.ok((await bluetooth.action("test-display", {})).ok);
  assert.deepEqual(sent, [[5, 0, 4, 128, 50], [5, 0, 7, 1, 1], [5, 0, 4, 1, 0], [7, 0, 2, 2, 255, 0, 0]]);
  assert.match(bluetooth.diagnostics(), new RegExp(BLUETOOTH_BUILD));
  assert.match(bluetooth.diagnostics(), /Device notifications enabled/);
  assert.match(bluetooth.diagnostics(), /TX 7 bytes: 07 00 02 02 ff 00 00/);
  assert.match(bluetooth.diagnostics(), /RX 05 00 02 02 01/);
  bluetooth.disconnect(true);
  assert.equal(receive, undefined);
});
