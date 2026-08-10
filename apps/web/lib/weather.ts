import type { GeoResult, WeatherData } from "./types";

// 5x7 bitmap font — must mirror services/bridge/automations.py FONT_5X7
export const FONT_5X7: Record<string, string[]> = {
  "0": [".###.", "#...#", "#..#.", "#.#.#", "#...#", "#...#", ".###."],
  "1": [".#...", "##...", ".#...", ".#...", ".#...", ".#...", "###.."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "....#", "...#.", "..#..", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
};

export async function geocode(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  if (!query.trim()) return [];
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&format=json&name=" +
    encodeURIComponent(query.trim());
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("city search failed");
  const data = (await res.json()) as {
    results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }>;
  };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export async function fetchWeatherData(lat: number, lon: number, unit: "c" | "f"): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    timezone: "auto",
    temperature_unit: unit === "c" ? "celsius" : "fahrenheit",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("forecast unavailable");
  const data = (await res.json()) as { current?: Record<string, number | boolean | null> };
  const cur = data.current ?? {};
  return {
    temperature: typeof cur.temperature_2m === "number" ? cur.temperature_2m : null,
    feels_like: typeof cur.apparent_temperature === "number" ? cur.apparent_temperature : null,
    humidity: typeof cur.relative_humidity_2m === "number" ? cur.relative_humidity_2m : null,
    weather_code: Number(cur.weather_code ?? 0),
    wind_speed: typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : null,
    is_day: Boolean(cur.is_day),
    unit,
  };
}

export function wmoLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return "Drizzle";
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return "Rain";
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Severe storm";
  return "Unknown";
}

type RGBA = readonly [number, number, number, number];

function roundedRect(g: RGBA[][], x: number, y: number, w: number, h: number, radius: number, color: RGBA) {
  for (let py = Math.max(0, y); py <= Math.min(31, y + h); py++) {
    for (let px = Math.max(0, x); px <= Math.min(31, x + w); px++) {
      if (g[py][px]?.[3] !== 0) continue;
      const inCorner =
        (px < x + radius && py < y + radius && (x + radius - px) + (y + radius - py) > radius) ||
        (px > x + w - radius && py < y + radius && (px - (x + w - radius)) + (y + radius - py) > radius) ||
        (px < x + radius && py > y + h - radius && (x + radius - px) + (py - (y + h - radius)) > radius) ||
        (px > x + w - radius && py > y + h - radius && (px - (x + w - radius)) + (py - (y + h - radius)) > radius);
      if (!inCorner) g[py][px] = color;
    }
  }
}

function fillRect<T>(g: T[][], x: number, y: number, w: number, h: number, color: T) {
  for (let py = Math.max(0, y); py <= Math.min(31, y + h); py++)
    for (let px = Math.max(0, x); px <= Math.min(31, x + w); px++) g[py][px] = color;
}

function ellipse(g: RGBA[][], cx: number, cy: number, rx: number, ry: number, color: RGBA) {
  for (let py = Math.max(0, cy - ry); py <= Math.min(31, cy + ry); py++) {
    for (let px = Math.max(0, cx - rx); px <= Math.min(31, cx + rx); px++) {
      const dx = (px - cx) / Math.max(1, rx);
      const dy = (py - cy) / Math.max(1, ry);
      if (dx * dx + dy * dy <= 1) g[py][px] = color;
    }
  }
}

function line(g: RGBA[][], x1: number, y1: number, x2: number, y2: number, color: RGBA, width: number) {
  const steps = Math.max(1, Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(x1 + (x2 - x1) * t);
    const py = Math.round(y1 + (y2 - y1) * t);
    for (let dy = -Math.floor(width / 2); dy <= Math.floor(width / 2); dy++)
      for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++)
        if (py + dy >= 0 && py + dy <= 31 && px + dx >= 0 && px + dx <= 31) g[py + dy][px + dx] = color;
  }
}

function polygon(g: RGBA[][], pts: [number, number][], color: RGBA) {
  const minY = Math.max(0, Math.min(...pts.map((p) => p[1])));
  const maxY = Math.min(31, Math.max(...pts.map((p) => p[1])));
  for (let py = minY; py <= maxY; py++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= py && y2 > py) || (y2 <= py && y1 > py)) {
        xs.push(x1 + ((py - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let px = Math.max(0, Math.round(xs[i])); px <= Math.min(31, Math.round(xs[i + 1])); px++)
        if (g[py]?.[px]?.[3] === 0) g[py][px] = color;
    }
  }
}

const TRANSPARENT: RGBA = [0, 0, 0, 0];
const SUN: RGBA = [255, 211, 77, 255];
const MOON: RGBA = [228, 233, 246, 255];
const CLOUD: RGBA = [185, 196, 206, 255];
const RAIN: RGBA = [111, 183, 255, 255];
const SNOW: RGBA = [255, 255, 255, 255];
const BOLT: RGBA = [255, 211, 77, 255];

function drawSun(g: RGBA[][], cx: number, cy: number, r: number) {
  ellipse(g, cx, cy, r, r, SUN);
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 4) * i;
    const x1 = cx + Math.round(Math.cos(ang) * (r + 1)) - 1;
    const y1 = cy + Math.round(Math.sin(ang) * (r + 1)) - 1;
    const x2 = cx + Math.round(Math.cos(ang) * (r + 3)) + 1;
    const y2 = cy + Math.round(Math.sin(ang) * (r + 3)) + 1;
    fillRect(g, x1, y1, x2 - x1 === 0 ? 1 : x2 - x1, y2 - y1 === 0 ? 1 : y2 - y1, SUN);
  }
}

function drawMoon(g: RGBA[][], cx: number, cy: number, r: number) {
  ellipse(g, cx, cy, r, r, MOON);
  ellipse(g, cx + Math.round(r / 2), cy, r + Math.round(r / 2), r, TRANSPARENT);
}

function drawCloud(g: RGBA[][], x: number, y: number, w: number, h: number) {
  roundedRect(g, x, y + Math.floor(h / 2), w, Math.floor(h / 2), 3, CLOUD);
  ellipse(g, x + Math.floor(w / 4), y + Math.floor(h / 2), Math.floor(h / 2), Math.floor(h / 2), CLOUD);
  ellipse(g, x + Math.floor(w / 2), y + Math.floor(h / 4), Math.floor(h / 2), Math.floor(h / 2), CLOUD);
}

function drawBolt(g: RGBA[][], x: number, y: number) {
  polygon(
    g,
    [
      [x, y],
      [x - 3, y + 6],
      [x, y + 6],
      [x - 1, y + 10],
      [x + 3, y + 3],
      [x, y + 3],
    ],
    BOLT,
  );
}

function weatherIconGrid(code: number, isDay: boolean): RGBA[][] {
  const g: RGBA[][] = Array.from({ length: 32 }, () => Array(32).fill(TRANSPARENT) as RGBA[]);
  const partly = code === 1 || code === 2;
  const cloudy = code === 3 || code === 80 || code === 81 || code === 82 || (code === 1 && !isDay);
  const foggy = code === 45 || code === 48;
  const rainy = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80].includes(code);
  const snowy = [71, 73, 75, 77, 85, 86].includes(code);
  const stormy = code === 95 || code === 96 || code === 99;

  if (code === 0 || (partly && isDay)) drawSun(g, 16, 10, 4);
  else if (code === 0) drawMoon(g, 16, 10, 4);
  else if (partly && !isDay) {
    drawMoon(g, 10, 7, 3);
    drawCloud(g, 10, 9, 18, 8);
  } else if (partly) {
    drawSun(g, 10, 6, 3);
    drawCloud(g, 11, 8, 17, 8);
  }
  if (cloudy) drawCloud(g, 7, 7, 18, 8);
  if (foggy) {
    drawCloud(g, 7, 5, 18, 8);
    for (let i = 0; i < 3; i++) {
      roundedRect(g, 6 + i * 2, 14 + i * 4, 20 - i, 2, 1, CLOUD);
    }
  }
  if (rainy) {
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 6;
      const off = i % 2;
      line(g, x, 20 + off, x - 2, 27 - off, RAIN, 2);
    }
  }
  if (snowy) {
    for (const [px, py] of [
      [9, 23],
      [16, 20],
      [22, 23],
    ]) {
      fillRect(g, px - 1, py - 1, 2, 2, SNOW);
      line(g, px - 3, py, px + 3, py, SNOW, 1);
      line(g, px, py - 3, px, py + 3, SNOW, 1);
    }
  }
  if (stormy) drawBolt(g, 20, 16);
  return g;
}

export function renderWeatherPreview(weather: WeatherData, accent: string): string[][] {
  const base = weatherIconGrid(weather.weather_code, weather.is_day);
  const grid: string[][] = base.map((row) => row.map(([r, gg, b, a]) => (a === 0 ? "rgba(255,255,255,0.08)" : `rgb(${r},${gg},${b})`)));

  const temp = weather.temperature == null ? "--°" : `${Math.round(weather.temperature)}°`;
  const cell = temp.length <= 3 ? 2 : 1;
  const total = (5 * cell + cell) * temp.length;
  let x = Math.round((32 - total) / 2);
  const y = cell === 2 ? 21 : 22;
  for (const ch of temp) {
    if (ch === "°") {
      fillRect(grid, x + 1, y, cell, cell, accent);
    } else {
      const glyph = FONT_5X7[ch];
      if (glyph) {
        for (let r = 0; r < 7; r++)
          for (let c = 0; c < 5; c++)
            if (glyph[r][c] === "#")
              fillRect(grid, x + c * cell, y + r * cell, Math.max(0, cell - 1), Math.max(0, cell - 1), accent);
      }
    }
    x += 5 * cell + cell;
  }
  return grid;
}