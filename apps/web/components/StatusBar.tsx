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

  const ring = {
    good: "border-emerald-400/25 bg-emerald-500/10",
    warn: "border-amber-400/25 bg-amber-500/10",
    bad: "border-red-400/25 bg-red-500/10",
    pending: "border-white/10 bg-white/[0.04]",
  }[level];

  return (
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
  );
}