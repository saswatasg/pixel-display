"use client";

import { useEffect, useRef } from "react";
import { renderWeatherPreview } from "@/lib/weather";
import type { WeatherData } from "@/lib/types";

export function WeatherPreview({
  weather,
  accent,
  scale = 8,
}: {
  weather: WeatherData;
  accent: string;
  scale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const grid = renderWeatherPreview(weather, accent);
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [weather, accent]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded border border-white/20 bg-black"
      style={{ width: 32 * scale, height: 32 * scale, imageRendering: "pixelated" }}
      aria-label="Weather preview"
    />
  );
}