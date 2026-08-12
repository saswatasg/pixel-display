"use client";

import type { AppStatus } from "@/lib/types";

type Level = "good" | "warn" | "bad" | "pending";

export function StatusBar({ status }: { status: AppStatus | null }) {
  let level: Level = "pending";
  let label = "Connecting…";
  let dotClass = "bg-zinc-500";
  let pulse = true;

  if (status?.bridgeOnline) {
    if (status.bridge?.device.connected === true) {
      level = "good";
      label = "Online";
      dotClass = "bg-emerald-400";
      pulse = false;
    } else {
      level = "warn";
      label = "Linking…";
      dotClass = "bg-amber-400";
      pulse = true;
    }
  } else if (status?.configured === false) {
    level = "bad";
    label = "Not configured";
    dotClass = "bg-red-400";
    pulse = true;
  } else if (status) {
    level = "bad";
    label = "Offline";
    dotClass = "bg-red-400";
    pulse = true;
  }

  const automation = status?.bridge?.automation;

  const ring = {
    good: "border-emerald-400/25 bg-emerald-500/10",
    warn: "border-amber-400/25 bg-amber-500/10",
    bad: "border-red-400/25 bg-red-500/10",
    pending: "border-white/10 bg-white/[0.04]",
  }[level];

  return (
    <span className="flex items-center gap-1.5">
      {automation?.enabled && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300"
          title={automation.error ?? "Automation active"}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
          {automation.program === "weather"
            ? "weather"
            : automation.program === "stocks"
              ? "ticker"
              : automation.program === "slideshow"
                ? "frame"
                : "schedule"}
        </span>
      )}
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${ring}`}
        title={label}
      >
        <span className="relative flex h-2 w-2">
          {pulse && status && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotClass} opacity-60`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClass}`} />
        </span>
        <span className={level === "good" ? "text-emerald-300" : level === "bad" ? "text-red-300" : "text-zinc-300"}>
          {label}
        </span>
      </span>
    </span>
  );
}