import type { ActionResult, AppStatus, AutomationStatus } from "../types";
import { commandPackets, prepareContent, READ_UUID, concat, gifPackets, imagePackets, integer, SERVICE_UUID, WRITE_UUID, type Payload } from "./protocol";
import { renderGif, renderImage, renderText, rgbPng } from "./render";
import { fetchWeatherData, renderWeatherPreview } from "../weather";
import { listFrameMedia } from "../media";

export function bluetoothSupport(): string | null {
  if (typeof window === "undefined") return "Checking Bluetooth support…";
  if (!window.isSecureContext) return "Bluetooth needs HTTPS. Open the secure website, or use localhost on this computer.";
  if (!navigator.bluetooth) return "This browser cannot access Bluetooth. Use Chrome on Mac, Windows, or Android. iPhone and iPad support will come in a future app.";
  return null;
}
export const BLUETOOTH_BUILD = "BLE-20261106-3";
const hex = (data: Uint8Array) => [...data].map(b => b.toString(16).padStart(2, "0")).join(" ");
const idleAutomation = (): AutomationStatus => ({ enabled: false, program: null, lastRunAt: null, nextRunAt: null, lastResult: null, error: null });
const errorText = (e: unknown) => e instanceof Error ? e.message : "Bluetooth command failed.";
class BluetoothController {
  private device?: BluetoothDevice;
  private writer?: BluetoothRemoteGATTCharacteristic;
  private reader?: BluetoothRemoteGATTCharacteristic;
  private log: string[] = [];
  private addLog(message: string) {
    this.log.push(`${new Date().toISOString().slice(11, 23)} ${message}`);
    this.log = this.log.slice(-24);
    this.emit();
  }
  diagnostics(): string {
    return [BLUETOOTH_BUILD, typeof navigator !== "undefined" ? navigator.userAgent : "", `Device: ${this.device?.name ?? "none"}; connected: ${this.connected}`, ...this.log].join("\n");
  }
  private onNotification = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) this.addLog(`RX ${hex(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))}`);
  };
  private clearReader() {
    this.reader?.removeEventListener("characteristicvaluechanged", this.onNotification);
    this.reader = undefined;
  }
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private epoch = 0;
  private connecting = false;
  private listeners = new Set<() => void>();
  private lastError: string | null = null;
  private lastAction: { action: string; at: number } | null = null;
  private connectedAt: number | null = null;
  private automation = idleAutomation();
  private runId = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private slideshowIndex = 0;
  private slideshowPayload: Payload = {};

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit() { this.listeners.forEach(fn => fn()); }
  get connected() { return Boolean(this.writer && this.device?.gatt?.connected); }
  get busy() { return this.connecting; }
  status(): AppStatus {
    const unsupported = bluetoothSupport();
    return {
      supported: !unsupported, fetchedAt: Date.now(),
      reason: unsupported ?? (this.connected ? undefined : this.lastError ?? "Tap Connect display and choose your nearby IDM display."),
      device: { id: this.device?.id ?? "", name: this.device?.name ?? "Pixel display", connected: this.connected, displaySize: 32, lastAction: this.lastAction, lastError: this.lastError, lastConnectedAt: this.connectedAt },
      automation: { ...this.automation },
    };
  }
  private onDisconnected = () => {
    this.clearReader(); this.epoch++; this.writer = undefined; this.stopAutomation();
    this.addLog("Disconnected by device or radio");
    this.lastError = "Bluetooth disconnected. Move closer and tap Reconnect.";
    this.emit();
  };
  async connect(): Promise<void> {
    if (this.connecting || this.connected) return;
    const unsupported = bluetoothSupport();
    if (unsupported) throw new Error(unsupported);
    this.connecting = true; this.lastError = null; this.emit();
    try {
      // Called immediately from the Connect button: requestDevice needs a user gesture.
      const device = this.device ?? await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: "IDM-" }], optionalServices: [SERVICE_UUID] });
      this.device = device;
      device.removeEventListener("gattserverdisconnected", this.onDisconnected);
      device.addEventListener("gattserverdisconnected", this.onDisconnected);
      const server = await device.gatt?.connect();
      if (!server) throw new Error("This display does not expose Bluetooth GATT.");
      const service = await server.getPrimaryService(SERVICE_UUID);
      const writer = await service.getCharacteristic(WRITE_UUID);
      if (!writer.properties.write && !writer.properties.writeWithoutResponse) throw new Error("The display's Bluetooth characteristic is not writable.");
      this.writer = writer; this.epoch++; this.connectedAt = Date.now() / 1000; this.lastError = null;
      this.addLog(`Connected; write=${writer.properties.write}; withoutResponse=${writer.properties.writeWithoutResponse}`);
      try {
        const reader = await service.getCharacteristic(READ_UUID);
        if (reader.properties.notify || reader.properties.indicate) {
          this.reader = reader;
          reader.addEventListener("characteristicvaluechanged", this.onNotification);
          await reader.startNotifications();
          this.addLog("Device notifications enabled");
        } else this.addLog("Device notifications unavailable");
      } catch (e) { this.clearReader(); this.addLog(`Notifications unavailable: ${errorText(e)}`); }
    } catch (e) {
      this.writer = undefined;
      this.device?.gatt?.disconnect();
      this.lastError = e instanceof DOMException && e.name === "NotFoundError" ? "No display selected. Turn it on, keep it nearby, and try again." : errorText(e);
      throw new Error(this.lastError);
    } finally { this.connecting = false; this.emit(); }
  }
  disconnect(forget = false) {
    this.stopAutomation(); this.clearReader(); this.epoch++;
    this.writer = undefined;
    this.device?.removeEventListener("gattserverdisconnected", this.onDisconnected);
    this.device?.gatt?.disconnect();
    if (forget) { this.device = undefined; this.lastAction = null; this.connectedAt = null; }
    this.lastError = null; this.emit();
  }
  private queue<T>(work: (valid: () => boolean) => Promise<T>, validRun?: () => boolean): Promise<T> {
    if (this.pending >= 30) return Promise.reject(new Error("Too many commands queued. Wait for the current transfer."));
    const epoch = this.epoch;
    const valid = () => epoch === this.epoch && this.connected;
    this.pending++;
    const result = this.tail.then(async () => {
      if (!valid() || (validRun && !validRun())) throw new Error("Connection or active program changed. Send the command again.");
      return work(valid);
    });
    this.tail = result.catch(() => undefined).finally(() => { this.pending--; });
    return result;
  }
  private async write(packets: Uint8Array[], valid: () => boolean, response = false) {
    const writer = this.writer;
    const device = this.device;
    const epoch = this.epoch;
    if (!writer) throw new Error("Connect your display first.");
    try {
      for (const packet of packets) {
        this.addLog(`TX ${packet.length} bytes: ${hex(packet.slice(0, 20))}${packet.length > 20 ? " …" : ""}`);
        // 20 bytes is safe across BLE MTUs, including Windows' smallest default.
        for (let at = 0; at < packet.length; at += 20) {
          if (!valid()) throw new Error("Transfer interrupted. Reconnect and send again.");
          const data = concat(packet.slice(at, at + 20));
          // Await peripheral-level ATT flow control for bulk transfers. Resolving
          // writeWithoutResponse only means the OS queued the bytes, not that the
          // panel consumed them; a long 20-byte burst can silently drop fragments.
          if (writer.properties.write && (response || packet.length > 20 || !writer.properties.writeWithoutResponse)) {
            await writer.writeValueWithResponse(data);
          } else {
            await writer.writeValueWithoutResponse(data);
            if (packet.length > 20) await new Promise(resolve => setTimeout(resolve, 15));
          }
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (!valid()) throw new Error("Connection changed during transfer. Send again.");
    } catch (e) {
      // A partial packet must not be continued or replayed after a new connection.
      if (this.epoch === epoch && this.writer === writer && this.device === device) device?.gatt?.disconnect();
      this.addLog(`Write failed: ${errorText(e)}`);
      throw e;
    }
  }
  private async writeImage(png: Uint8Array, valid: () => boolean) {
    await this.write(prepareContent("image"), valid, true);
    // Let the firmware finish entering DIY mode before sending image bytes.
    await new Promise(resolve => setTimeout(resolve, 50));
    await this.write(imagePackets(png), valid, true);
  }
  private record(action: string) { this.lastAction = { action, at: Date.now() / 1000 }; this.lastError = null; this.emit(); }
  private async direct(action: string, p: Payload, validRun?: () => boolean) {
    return this.queue(async valid => {
      const packets = action === "text" ? [await renderText(p)] : commandPackets(action, p);
      await this.write(prepareContent(action), valid, true);
      await this.write(packets, valid, true); this.record(action);
    }, validRun);
  }
  private async upload(action: string, file: Blob, validRun?: () => boolean) {
    return this.queue(async valid => {
      if (action === "gif") {
        const packets = gifPackets(await renderGif(file));
        await this.write(prepareContent("gif"), valid, true);
        await this.write(packets, valid, true);
      }
      else if (action === "image") await this.writeImage(await renderImage(file), valid);
      else throw new Error("Unsupported upload type.");
      this.record(action);
    }, validRun);
  }
  private stopAutomation() {
    this.runId++; clearTimeout(this.timer); this.timer = undefined;
    this.automation = idleAutomation();
  }
  private async weather(p: Payload, run: number) {
    const lat = Number(p.lat), lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error("Choose a valid weather location.");
    const w = await fetchWeatherData(lat, lon, p.unit === "f" ? "f" : "c");
    w.city = String(p.name ?? "NOW");
    const grid = renderWeatherPreview(w, String(p.color ?? "#00E5FF"));
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to render weather.");
    ctx.fillStyle = "black"; ctx.fillRect(0, 0, 32, 32);
    grid.forEach((row, y) => row.forEach((c, x) => {
      if (c.startsWith("rgba")) return; // preview grid is black on the physical display
      ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
    }));
    const png = await rgbPng(ctx.getImageData(0, 0, 32, 32).data);
    await this.queue(async valid => { await this.writeImage(png, valid); this.record("weather"); }, () => run === this.runId);
  }
  private async photo(p: Payload, run: number) {
    const media = await listFrameMedia();
    if (!media.length) throw new Error("Save a photo to the frame first.");
    const index = p.shuffle ? Math.floor(Math.random() * media.length) : this.slideshowIndex++ % media.length;
    const blob = await (await fetch(media[index].url)).blob();
    await this.upload("image", blob, () => run === this.runId);
  }
  private async startProgram(action: "weather" | "slideshow", p: Payload) {
    this.stopAutomation(); const run = this.runId;
    const delay = action === "weather" ? integer(p.interval, 30, 15, 360) * 60000 : integer(p.interval, 20, 5, 3600) * 1000;
    this.slideshowPayload = p;
    const tick = async (first = false) => {
      if (run !== this.runId || !this.connected) return;
      try {
        if (action === "weather") await this.weather(p, run); else await this.photo(p, run);
        if (run !== this.runId) return;
        this.automation.lastResult = "ok"; this.automation.error = null;
      } catch (e) {
        if (run !== this.runId) return;
        this.automation.lastResult = "error"; this.automation.error = errorText(e);
        if (first) { this.stopAutomation(); throw e; }
      }
      if (run !== this.runId || !this.connected) return;
      this.automation.lastRunAt = Date.now() / 1000; this.automation.nextRunAt = Date.now() / 1000 + delay / 1000;
      this.emit(); this.timer = setTimeout(() => void tick(), delay);
    };
    this.automation = { ...idleAutomation(), enabled: true, program: action };
    await tick(true); this.emit();
  }
  async action(action: string, p: Payload): Promise<ActionResult> {
    try {
      if (action === "automation-off") { this.stopAutomation(); this.emit(); return { ok: true, sent: false, action }; }
      if (!this.connected) throw new Error("Connect your display first.");
      if (action === "test-display") {
        this.stopAutomation();
        await this.queue(async valid => {
          await this.write([...commandPackets("brightness", { value: 50 }), ...prepareContent("fullscreen-color"), ...commandPackets("fullscreen-color", { color: "#FF0000" })], valid, true);
          this.record(action);
        });
        return { ok: true, sent: true, action };
      }
      if (action === "media-sync") { if (!(await listFrameMedia()).length) throw new Error("Save a photo first."); return { ok: true, sent: false, action }; }
      if (action === "weather" || action === "slideshow") await this.startProgram(action, p);
      else if (action === "slideshow-next") {
        if (this.automation.program !== "slideshow") throw new Error("Start the photo frame first.");
        await this.photo(this.slideshowPayload, this.runId);
      } else {
        if (["schedule", "wake", "stocks"].includes(action)) throw new Error("This feature needs the legacy always-on bridge and is unavailable in direct Bluetooth mode.");
        if (!["brightness", "flip", "sync-time"].includes(action)) this.stopAutomation();
        await this.direct(action, p);
      }
      return { ok: true, sent: true, action };
    } catch (e) { this.lastError = errorText(e); this.emit(); return { ok: false, sent: false, action, error: this.lastError }; }
  }
  async file(action: string, file: File): Promise<ActionResult> {
    try {
      this.stopAutomation();
      await this.upload(action, file);
      return { ok: true, sent: true, action };
    } catch (e) { this.lastError = errorText(e); this.emit(); return { ok: false, sent: false, action, error: this.lastError }; }
  }
}
export const bluetooth = new BluetoothController();
