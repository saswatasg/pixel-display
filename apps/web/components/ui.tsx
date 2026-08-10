"use client";

import type { ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "subtle";

const BUTTON_VARIANTS: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-zinc-950 font-semibold shadow-[0_6px_22px_-6px_rgba(245,158,11,0.7)] hover:bg-amber-400",
  ghost: "border border-white/15 bg-white/[0.03] text-zinc-200 hover:border-white/30 hover:bg-white/[0.07]",
  danger: "border border-red-500/40 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:border-red-400/60",
  subtle: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
};

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
} as const;

export type IconName = keyof typeof ICONS;

export function Card({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`card-lift rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 shadow-[0_2px_24px_-12px_rgba(0,0,0,0.8)] backdrop-blur-sm ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-amber-400">{icon}</span>}
            <div>
              {title && (
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                  {title}
                </h2>
              )}
              {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  const sizes = {
    sm: "px-3 py-1.5 text-[13px]",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-[15px]",
  }[size];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${sizes} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  className = "",
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      <Icon d={ICONS[icon]} className="h-4 w-4" />
    </button>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  format,
  marks,
  step = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  marks?: number[];
  step?: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-xs text-amber-300">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        aria-label={label}
      />
      {marks && (
        <div className="mt-0.5 flex justify-between px-0.5 font-mono text-[10px] text-zinc-600">
          {marks.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-zinc-900/70 px-4 py-3 text-left transition-colors hover:bg-zinc-900"
    >
      <span className="min-w-0">
        <span className="block text-sm text-zinc-200">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-amber-500" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className = "",
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div>
      {label && <p className="mb-1.5 text-sm text-zinc-300">{label}</p>}
      <div
        role="radiogroup"
        aria-label={label ?? "Options"}
        className={`flex flex-wrap gap-1.5 ${className}`}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "bg-amber-500 text-zinc-950 shadow-[0_4px_14px_-4px_rgba(245,158,11,0.6)]"
                  : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TOAST_STYLES = {
  success: {
    icon: "check",
    ring: "border-emerald-400/30",
    iconColor: "bg-emerald-500/15 text-emerald-300",
  },
  error: {
    icon: "alert",
    ring: "border-red-400/30",
    iconColor: "bg-red-500/15 text-red-300",
  },
  info: {
    icon: "zap",
    ring: "border-amber-400/30",
    iconColor: "bg-amber-500/15 text-amber-300",
  },
} as const;

export type ToastType = keyof typeof TOAST_STYLES;

export function Toast({
  toast,
  onDismiss,
}: {
  toast: { message: string; type?: ToastType } | null;
  onDismiss?: () => void;
}) {
  if (!toast) return null;
  const style = TOAST_STYLES[toast.type ?? "info"];
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className={`animate-toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-zinc-900/95 px-4 py-2.5 shadow-2xl backdrop-blur ${style.ring}`}
        role="status"
      >
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${style.iconColor}`}>
          <Icon d={ICONS[style.icon]} className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
        <span className="text-sm text-zinc-100">{toast.message}</span>
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
          >
            <Icon d={ICONS.close} className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-zinc-800/80 ${className}`}
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-500/25 to-amber-600/10 shadow-[0_0_14px_rgba(245,158,11,0.35)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
          <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
          <path d="M5 15a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
          <path d="M17 16h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" />
        </svg>
      </span>
      <div>
        <p className="pixel-text font-display text-[11px] leading-none text-amber-300 text-glow">
          PIXEL DISPLAY
        </p>
        <p className="mt-1 text-[10px] tracking-wide text-zinc-500">APEX / iDotMatrix 32×32</p>
      </div>
    </div>
  );
}