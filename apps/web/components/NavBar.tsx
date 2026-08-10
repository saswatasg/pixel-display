"use client";

export type Tab = "home" | "text" | "image" | "clock" | "more";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { id: "text", label: "Text", icon: "M4 7h16M4 12h10M4 17h16" },
  { id: "image", label: "Image", icon: "M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4" },
  { id: "clock", label: "Clock", icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 3" },
  { id: "more", label: "More", icon: "M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 22a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" },
];

export function NavBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              active === tab.id ? "text-amber-400" : "text-zinc-400 active:text-zinc-200"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
