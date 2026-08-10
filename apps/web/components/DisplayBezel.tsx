"use client";

import type { ReactNode } from "react";
import { ICONS, Icon } from "./ui";

export function DisplayBezel({
  children,
  label = "32 × 32 PIXELS",
  powered = true,
  className = "",
}: {
  children: ReactNode;
  label?: string;
  powered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-white/[0.1] bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] ${className}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="pixel-text font-display text-[7px] tracking-widest text-zinc-500">APEX LINK</span>
        <span className="flex items-center gap-1 font-mono text-[9px] tracking-wider text-zinc-600">
          <span className={`h-1 w-1 rounded-full ${powered ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" : "bg-zinc-600"}`} />
          {label}
        </span>
      </div>
      <div
        className={`relative overflow-hidden rounded-xl border bg-black p-2 ring-1 transition-all duration-300 ${
          powered
            ? "border-white/[0.12] ring-amber-400/20 shadow-[inset_0_0_30px_rgba(0,0,0,0.6),0_0_30px_-6px_rgba(245,158,11,0.35)]"
            : "border-white/[0.06] ring-transparent"
        }`}
      >
        {children}
        {!powered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
            <span className="pixel-text font-display text-[8px] tracking-widest text-zinc-600">SCREEN OFF</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DisplayLights({ lit }: { lit: boolean }) {
  return (
    <span className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-1.5 sm:flex">
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${lit ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" : "bg-zinc-700"}`}
      />
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${lit ? "bg-amber-400/70 shadow-[0_0_8px_rgba(251,191,36,0.7)]" : "bg-zinc-700"}`}
      />
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${lit ? "bg-amber-400/70 shadow-[0_0_8px_rgba(251,191,36,0.7)]" : "bg-zinc-700"}`}
      />
    </span>
  );
}

export function HeroIcon({ icon }: { icon: keyof typeof ICONS }) {
  return <Icon d={ICONS[icon]} className="h-5 w-5" />;
}