"use client";
import { useEffect, useRef } from "react";
import { starterArt, type PixelGrid } from "@/lib/artwork";
import { FONT_3X5, FONT_5X7 } from "@/lib/weather";
export interface Preview { label: string; note?: string; pixels?: PixelGrid; image?: string; text?: string; color?: string; clock?: boolean; solid?: string; }
export const SAMPLE: Preview = { label: "Golden hour", note: "Sample artwork · not sent", pixels: starterArt("sunset") };
export function DisplayCanvas({ preview = SAMPLE, small = false, className = "" }: { preview?: Preview; small?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let alive = true;
    const draw = () => {
      ctx.fillStyle = preview.solid ?? "#111218"; ctx.fillRect(0, 0, 32, 32);
      if (preview.pixels) preview.pixels.forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(i % 32, Math.floor(i / 32), 1, 1); });
      if (preview.text !== undefined || preview.clock) {
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        const text = (preview.clock ? time : preview.text ?? "").toUpperCase().slice(0, preview.clock ? 5 : 8);
        const width = preview.clock ? 5 : 3, height = preview.clock ? 7 : 5;
        const start = Math.floor((32 - text.length * (width + 1) + 1) / 2);
        ctx.fillStyle = preview.color ?? "#FFC59B";
        [...text].forEach((ch, i) => {
          const glyph = preview.clock ? FONT_5X7[ch] : FONT_3X5[ch];
          if (ch === ":") { ctx.fillRect(start + i * 6 + 2, 13, 1, 1); ctx.fillRect(start + i * 6 + 2, 17, 1, 1); }
          glyph?.forEach((row, y) => [...row].forEach((v, x) => { if (v === "#") ctx.fillRect(start + i * (width + 1) + x, Math.floor((32 - height) / 2) + y, 1, 1); }));
        });
      }
    };
    draw();
    if (preview.image) {
      const img = new Image(); img.onload = () => { if (alive) { ctx.fillStyle = "black"; ctx.fillRect(0, 0, 32, 32); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, 32, 32); } }; img.src = preview.image;
    }
    const timer = preview.clock ? setInterval(draw, 1000) : undefined;
    return () => { alive = false; clearInterval(timer); };
  }, [preview]);
  return <div className={`display-object ${small ? "display-small" : ""} ${className}`}><div className="display-face"><canvas width={32} height={32} ref={ref} role="img" aria-label={`${preview.label} preview`} /><span className="pixel-overlay" aria-hidden="true" /></div>{!small && <div className="display-hardware"><span>PIXEL / 32</span><i /><span>1024 possibilities</span></div>}</div>;
}
