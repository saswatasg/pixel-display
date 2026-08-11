export interface AutomationStatus {
  enabled: boolean;
  program: string | null;
  lastRunAt: number | null;
  nextRunAt: number | null;
  lastResult: "ok" | "error" | null;
  error: string | null;
  wake?: {
    enabled: boolean;
    time: string;
    program: "clock" | "image";
    config: Record<string, unknown>;
  };
}

export interface MediaItem {
  name: string;
  size: number;
  addedAt: number;
}

export interface BridgeStatus {
  bridge: "online";
  uptimeSec: number;
  device: {
    id: string;
    name: string;
    address: string | null;
    connected: boolean;
    displaySize: number;
    lastAction: { action: string; at: number } | null;
    lastError: string | null;
    lastConnectedAt: number | null;
  };
  automation?: AutomationStatus;
  media?: { count: number };
}

export interface GeoResult {
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
}

export interface WeatherData {
  temperature: number | null;
  feels_like: number | null;
  humidity: number | null;
  weather_code: number;
  wind_speed: number | null;
  is_day: boolean;
  unit: "c" | "f";
  city: string;
}

export interface AppStatus {
  bridgeOnline: boolean;
  configured: boolean;
  reason?: string;
  bridge?: BridgeStatus;
  fetchedAt: number;
}

export interface ActionResult {
  ok: boolean;
  sent: boolean;
  action: string;
  error?: string;
}

export interface Preset {
  id: string;
  name: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  plays?: number;
}

export const TEXT_MODES: Record<number, string> = {
  0: "Static",
  1: "Marquee",
  2: "Reverse marquee",
  3: "Vertical rise",
  4: "Vertical lower",
  5: "Blink",
  6: "Fade",
  7: "Tetris",
  8: "Fill",
};

export const ANIMATION_STYLES: Record<number, string> = {
  0: "Horizontal rainbow",
  1: "Random pixels",
  2: "White noise",
  3: "Vertical rainbow",
  4: "Diagonal rainbow",
  5: "Diagonal rainbow 2",
  6: "Color chaos",
};

export const CLOCK_STYLES: Record<number, string> = {
  0: "Style 1",
  1: "Style 2",
  2: "Style 3",
  3: "Style 4",
  4: "Style 5",
  5: "Style 6",
  6: "Style 7",
  7: "Style 8",
};

export const SWATCHES = [
  "#FFFFFF",
  "#FF0000",
  "#FF8800",
  "#FFFF00",
  "#00FF00",
  "#00FF88",
  "#00FFFF",
  "#0088FF",
  "#0000FF",
  "#8800FF",
  "#FF00FF",
  "#FF0088",
];
