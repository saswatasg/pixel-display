"use client";

import { useEffect, useRef } from "react";

export function PixelPreview({ file, size = 32 }: { file: File | null; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, size]);

  const upscale = 8;
  return (
    <canvas
      ref={canvasRef}
      className="rounded border border-white/20 bg-black"
      style={{ width: size * upscale, height: size * upscale, imageRendering: "pixelated" }}
    />
  );
}
