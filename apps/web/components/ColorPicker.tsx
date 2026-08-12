"use client";

import { SWATCHES } from "@/lib/types";

export function ColorPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (color: string) => void;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded border border-white/25"
        style={{ backgroundColor: value }}
        title="Custom color"
      >
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom color"
          className="absolute -left-2 -top-2 h-14 w-14 cursor-pointer opacity-0"
        />
      </label>
      {SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          onClick={() => onChange(swatch)}
          className={`h-8 w-8 rounded border transition-transform active:scale-90 ${
            value.toLowerCase() === swatch.toLowerCase()
              ? "border-white ring-2 ring-white/60"
              : "border-white/20"
          }`}
          style={{ backgroundColor: swatch }}
          aria-label={swatch}
        />
      ))}
    </div>
  );
}
