"use client";

import type { AppStatus } from "@/lib/types";

export function StatusBar({ status }: { status: AppStatus | null }) {
  let dot = "bg-zinc-500";
  let label = "Connecting…";
  if (status?.bridgeOnline) {
    dot = status.bridge?.device.connected ? "bg-emerald-400" : "bg-amber-400";
    label = status.bridge?.device.connected
      ? "Display connected"
      : "Bridge online — connecting to display…";
  } else if (status?.configured === false) {
    dot = "bg-red-400";
    label = "Bridge not configured (server env)";
  } else if (status) {
    dot = "bg-red-400";
    label = "Bridge offline";
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2">
      <span className={`h-2.5 w-2.5 rounded-full ${dot} ${dot === "bg-emerald-400" ? "" : "animate-pulse"}`} />
      <span className="text-sm text-zinc-200">{label}</span>
      {status && status.bridgeOnline && status.bridge?.device.address && (
        <span className="ml-auto truncate text-xs text-zinc-500">{status.bridge.device.address}</span>
      )}
      {status && !status.bridgeOnline && status.reason && (
        <span className="ml-auto hidden max-w-[45%] truncate text-xs text-zinc-500 sm:block">{status.reason}</span>
      )}
    </div>
  );
}
