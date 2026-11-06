"use client";

export function Icon({
  d,
  className = "",
  strokeWidth = 1.8,
}: {
  d: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z",
  text: "M6 6h12M6 10h12M6 14h7M6 18h7",
  image: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 10 4-4 3 3 4-4 4 4",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  play: "M8 5v14l11-7z",
  pause: "M7 5h3v14H7zM14 5h3v14h-3z",
  reset: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  power: "M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0",
  sun: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  copy: "M8 8h11v11H8zM4 15V4h11",
  check: "M5 13l4 4L19 7",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  alert: "M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.01",
  zap: "M13 3 5 13h6l-1 8 8-10h-6l1-8Z",
  link: "M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
  clockDisplay: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM12 7v5l3 2",
  timer: "M19 8a8 8 0 1 0 1 7M21 3v4h-4",
  scoreboard: "M5 21V8M19 21V8M5 21h14M5 8h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM9 12h6",
  sparkle: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z",
  star: "M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.9l-5.3 3 1.1-6L3.4 9.4l6-.8Z",
} as const;

export type IconName = keyof typeof ICONS;
