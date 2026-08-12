"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PREFS, type AppPrefs } from "./prefs";
import { getPrefs, savePrefs } from "./api";

export type PrefsPatch = Partial<{
  brightness: number;
  text: Partial<AppPrefs["text"]>;
  clock: Partial<AppPrefs["clock"]>;
  weather: Partial<AppPrefs["weather"]>;
  ticker: Partial<AppPrefs["ticker"]>;
  frame: Partial<AppPrefs["frame"]>;
}>;

function applyPatch(prev: AppPrefs, patch: PrefsPatch): AppPrefs {
  return {
    brightness: patch.brightness ?? prev.brightness,
    text: { ...prev.text, ...patch.text },
    clock: { ...prev.clock, ...patch.clock },
    weather: { ...prev.weather, ...patch.weather },
    ticker: { ...prev.ticker, ...patch.ticker },
    frame: { ...prev.frame, ...patch.frame },
  };
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<AppPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    let cancelled = false;
    getPrefs()
      .then((loaded) => {
        if (cancelled) return;
        latest.current = loaded;
        setPrefs(loaded);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const updatePrefs = useCallback((patch: PrefsPatch) => {
    latest.current = applyPatch(latest.current, patch);
    setPrefs(latest.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void savePrefs(latest.current);
    }, 800);
  }, []);

  return { prefs, ready, updatePrefs };
}