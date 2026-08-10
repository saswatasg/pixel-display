"use client";

import { ICONS, Icon, type IconName } from "./ui";

export type Tab = "home" | "text" | "image" | "clock" | "more";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "text", label: "Text", icon: "text" },
  { id: "image", label: "Image", icon: "image" },
  { id: "clock", label: "Clock", icon: "clock" },
  { id: "more", label: "More", icon: "more" },
];

export function NavBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-md px-4 pb-3">
        <div className="flex items-stretch justify-between rounded-2xl border border-white/[0.08] bg-zinc-950/90 px-1 py-1 shadow-[0_-8px_40px_-16px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-xl">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(tab.id)}
                className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-all duration-150 ${
                  isActive ? "text-amber-300" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-lg transition-all duration-150 ${
                    isActive ? "bg-amber-500/15 shadow-[0_0_16px_-2px_rgba(245,158,11,0.45)]" : ""
                  }`}
                >
                  <Icon d={ICONS[tab.icon]} className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.1 : 1.7} />
                </span>
                {tab.label}
                <span
                  className={`absolute -bottom-0.5 h-1 w-1 rounded-full transition-opacity ${
                    isActive ? "bg-amber-400 opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}