/** Settings and small pixel images belong to this browser, never the device bridge. */
export function readLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(`pixel-display:${key}`) ?? "null") ?? fallback; }
  catch { return fallback; }
}
export function writeLocal(key: string, value: unknown): void {
  try { localStorage.setItem(`pixel-display:${key}`, JSON.stringify(value)); }
  catch { throw new Error("Could not save on this device. Browser storage is blocked or full."); }
}
