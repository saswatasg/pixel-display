/** Pure prefs model: shared by client (defaults + sanitize) and server (persistence). */

export type ColorMode = 0 | 1 | 3;

export interface TextPrefs {
  size: number;
  mode: number;
  speed: number;
  color: string;
  colorMode: ColorMode;
}

export interface ClockPrefs {
  style: number;
  color: string;
  format24h: boolean;
  showDate: boolean;
}

export interface TickerPrefs {
  symbols: string;
  color: string;
  interval: number;
  speed: number;
}

export interface FramePrefs {
  interval: number;
  shuffle: boolean;
}

export interface AppPrefs {
  brightness: number;
  text: TextPrefs;
  clock: ClockPrefs;
  weather: { unit: "c" | "f" };
  ticker: TickerPrefs;
  frame: FramePrefs;
}

export const DEFAULT_PREFS: AppPrefs = {
  brightness: 50,
  text: { size: 16, mode: 1, speed: 95, color: "#FFFFFF", colorMode: 1 },
  clock: { style: 0, color: "#FFFFFF", format24h: true, showDate: true },
  weather: { unit: "c" },
  ticker: { symbols: "AAPL, NVDA", color: "#7CFF6B", interval: 10, speed: 80 },
  frame: { interval: 20, shuffle: false },
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampStr(value: unknown, fallback: string, maxLen = 60): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLen) : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

function pickColorMode(value: unknown, fallback: ColorMode): ColorMode {
  const n = Number(value);
  return n === 0 || n === 1 || n === 3 ? n : fallback;
}

function obj(x: unknown): Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

/** Clamp + coerce untrusted client input onto the known prefs shape. */
export function sanitizePrefs(raw: unknown): AppPrefs {
  const r = obj(raw);
  const text = obj(r.text);
  const clock = obj(r.clock);
  const ticker = obj(r.ticker);
  const frame = obj(r.frame);
  const weather = obj(r.weather);
  return {
    brightness: clampInt(r.brightness, 5, 100, DEFAULT_PREFS.brightness),
    text: {
      size: clampInt(text.size, 8, 24, DEFAULT_PREFS.text.size),
      mode: clampInt(text.mode, 0, 8, DEFAULT_PREFS.text.mode),
      speed: clampInt(text.speed, 1, 100, DEFAULT_PREFS.text.speed),
      color: pickColor(text.color, DEFAULT_PREFS.text.color),
      colorMode: pickColorMode(text.colorMode, DEFAULT_PREFS.text.colorMode),
    },
    clock: {
      style: clampInt(clock.style, 0, 7, DEFAULT_PREFS.clock.style),
      color: pickColor(clock.color, DEFAULT_PREFS.clock.color),
      format24h: pickBool(clock.format24h, DEFAULT_PREFS.clock.format24h),
      showDate: pickBool(clock.showDate, DEFAULT_PREFS.clock.showDate),
    },
    weather: {
      unit: weather.unit === "f" ? "f" : "c",
    },
    ticker: {
      symbols: clampStr(ticker.symbols, DEFAULT_PREFS.ticker.symbols, 200),
      color: pickColor(ticker.color, DEFAULT_PREFS.ticker.color),
      interval: clampInt(ticker.interval, 5, 120, DEFAULT_PREFS.ticker.interval),
      speed: clampInt(ticker.speed, 0, 255, DEFAULT_PREFS.ticker.speed),
    },
    frame: {
      interval: clampInt(frame.interval, 5, 3600, DEFAULT_PREFS.frame.interval),
      shuffle: pickBool(frame.shuffle, DEFAULT_PREFS.frame.shuffle),
    },
  };
}