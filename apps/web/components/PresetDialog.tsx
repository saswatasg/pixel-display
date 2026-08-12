"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Icon, ICONS } from "./ui";

export function PresetDialog({
  defaultName,
  open,
  onClose,
  onSave,
}: {
  defaultName: string;
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setSaving(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, defaultName]);

  if (!open) return null;

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save preset"
        onClick={(e) => e.stopPropagation()}
        className="animate-pop w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Icon d={ICONS.plus} className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
              Save preset
            </h2>
            <p className="text-xs text-zinc-500">Give this scene a name to replay it anytime.</p>
          </div>
        </div>

        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onClose();
          }}
          minLength={1}
          maxLength={40}
          placeholder="My scene"
          aria-label="Preset name"
          className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : "Save preset"}
          </Button>
        </div>
      </div>
    </div>
  );
}