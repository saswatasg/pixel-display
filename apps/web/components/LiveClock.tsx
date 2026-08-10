"use client";

import { useEffect, useRef } from "react";

const FONT: Record<string, string[]> = {
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
};

const COLON: string[][] = [
  [".....", "..#..", ".....", ".....", "..#..", ".....", "....."],
  [".....", ".....", ".....", ".....", ".....", ".....", "....."],
];

function drawChar(ctx: CanvasRenderingContext2D, glyph: string[], x: number, y: number, cell: number) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (glyph[r][c] === "#") ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    }
  }
}

export function LiveClock({
  powered,
  color = "#fbbf24",
  size = 176,
}: {
  powered: boolean;
  color?: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      const blink = now.getSeconds() % 2 === 0;
      const cell = 4;
      const glyphs = [FONT[h[0]], FONT[h[1]], COLON[blink ? 0 : 1], FONT[m[0]], FONT[m[1]]];
      const total = 6 * 5; // 5 slots * (5 cols + 1 gap)
      const gap = (32 - total) / 2;

      ctx.clearRect(0, 0, 32, 32);

      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (let y = 0; y < 32; y += 2) {
        for (let x = 0; x < 32; x += 2) {
          ctx.fillRect(x, y, 1, 1);
        }
      }

      if (powered) {
        ctx.fillStyle = color;
        let x = gap;
        for (const glyph of glyphs) {
          drawChar(ctx, glyph, x, 2, cell);
          x += 6;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [color, powered]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className="rounded-md"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      aria-label="Live clock preview"
    />
  );
}