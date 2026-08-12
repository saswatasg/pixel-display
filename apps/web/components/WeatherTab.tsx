"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { geocode, fetchWeatherData, wmoLabel } from "@/lib/weather";
import type { GeoResult, WeatherData } from "@/lib/types";
import type { AppPrefs } from "@/lib/prefs";
import type { PrefsPatch } from "@/lib/usePrefs";
import { Button, Card, Icon, ICONS, Segmented, Slider, Spinner } from "./ui";
import { ColorPicker } from "./ColorPicker";
import { WeatherPreview } from "./WeatherPreview";
import { DisplayBezel } from "./DisplayBezel";
import { PresetDialog } from "./PresetDialog";
import { createPreset } from "@/lib/api";

interface Props {
  connected: boolean;
  onSend: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onToast: (message: string, type?: "info" | "success" | "error") => void;
  prefs?: AppPrefs | null;
  ready?: boolean;
  onPref?: (patch: PrefsPatch) => void;
}

const DEFAULT_PLACE: GeoResult = { name: "Berlin", country: "Germany", lat: 52.52, lon: 13.405 };

const PLACE_KEY = "pixel-display:weather-place:v1";

function loadPlace(): GeoResult {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    if (!raw) return DEFAULT_PLACE;
    const p = JSON.parse(raw) as GeoResult;
    if (typeof p?.lat === "number" && typeof p?.lon === "number" && typeof p?.name === "string") return p;
  } catch {
    // ignore corrupt storage
  }
  return DEFAULT_PLACE;
}

function savePlace(p: GeoResult) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify(p));
  } catch {
    // storage blocked — best effort
  }
}

export function WeatherTab({ connected, onSend, onToast, prefs, ready, onPref }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState<GeoResult>(loadPlace);
  const [unit, setUnit] = useState<"c" | "f">("c");
  const [color, setColor] = useState("#00E5FF");
  const [intervalMin, setIntervalMin] = useState(30);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unitApplied = useRef(false);

  useEffect(() => {
    if (!ready || !prefs || unitApplied.current) return;
    unitApplied.current = true;
    setUnit(prefs.weather.unit);
    update(place, prefs.weather.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, prefs]);

  const update = useCallback(
    async (p: GeoResult, u: "c" | "f") => {
      setFetching(true);
      try {
        const w = await fetchWeatherData(p.lat, p.lon, u);
        setWeather({ ...w, city: p.name });
      } catch {
        setWeather(null);
      } finally {
        setFetching(false);
      }
    },
    [],
  );

  useEffect(() => {
    update(place, unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await geocode(q, controller.signal));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      controller.abort();
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const selectPlace = (p: GeoResult) => {
    setPlace(p);
    savePlace(p);
    setQuery("");
    setResults(null);
    update(p, unit);
  };

  const apply = async () => {
    setBusy(true);
    try {
      const ok = await onSend("weather", {
        lat: place.lat,
        lon: place.lon,
        name: place.name,
        unit,
        color,
        interval: intervalMin,
      });
      if (ok) onToast(`Weather on — ${place.name}`, "success");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const ok = await onSend("automation-off", {});
      if (ok) onToast("Automation stopped", "info");
    } finally {
      setBusy(false);
    }
  };

  const savePreset = async (name: string) => {
    await createPreset(name, "weather", {
      lat: place.lat,
      lon: place.lon,
      name: place.name,
      unit,
      color,
      interval: intervalMin,
    });
    onToast("Weather saved as preset", "success");
  };

  return (
    <div className="space-y-5">
      <Card
        icon={<Icon d={ICONS.sun} className="h-5 w-5" />}
        title="Scheduled weather"
        subtitle="Live conditions re-render on your display"
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm text-zinc-300">City</p>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={place.name}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-500"
              aria-label="Search city"
            />
            {searching && (
              <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                <Spinner className="h-3 w-3" /> searching…
              </p>
            )}
            {results !== null && !searching && (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                {results.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-zinc-500">No matches — try another city.</p>
                ) : (
                  results.map((r) => (
                    <button
                      key={`${r.lat},${r.lon}`}
                      type="button"
                      onClick={() => selectPlace(r)}
                      className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] bg-zinc-900 px-4 py-2.5 text-left text-sm text-zinc-200 transition-colors last:border-0 hover:bg-amber-500/10 hover:text-amber-200"
                    >
                      <span>
                        {r.name}
                        <span className="ml-2 text-xs text-zinc-500">
                          {[r.admin1, r.country].filter(Boolean).join(", ")}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-zinc-600">
                        {r.lat.toFixed(2)}, {r.lon.toFixed(2)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-600">
              Selected: <span className="text-zinc-300">{place.name}</span>
              {place.admin1 ? `, ${place.admin1}` : ""}
              {place.country ? ` · ${place.country}` : ""}
            </p>
          </div>

          <Segmented
            label="Unit"
            options={[
              { value: "c", label: "°C" },
              { value: "f", label: "°F" },
            ]}
            value={unit}
            onChange={(u) => {
              setUnit(u);
              onPref?.({ weather: { unit: u } });
              update(place, u);
            }}
          />

          <div>
            <p className="mb-1.5 text-sm text-zinc-300">Accent color</p>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <Slider
            label="Update interval"
            value={intervalMin}
            min={15}
            max={360}
            step={5}
            onChange={setIntervalMin}
            format={(v) => `${v} min`}
            marks={[15, 60, 120, 240, 360]}
          />
        </div>
      </Card>

      <Card title="Live preview" subtitle={weather ? `${place.name} · updated just now` : "preview"}>
        <div className="flex flex-col items-center gap-4">
          <DisplayBezel label="32 × 32 PREVIEW" powered={connected}>
            {weather ? (
              <WeatherPreview weather={weather} accent={color} />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded border border-white/20 bg-black">
                <Spinner />
              </div>
            )}
          </DisplayBezel>
          {weather && (
            <div className="grid w-full grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <Stat label="Conditions" value={wmoLabel(weather.weather_code)} />
              <Stat label="Feels like" value={weather.feels_like == null ? "—" : `${Math.round(weather.feels_like)}°`} />
              <Stat label="Humidity" value={weather.humidity == null ? "—" : `${weather.humidity}%`} />
              <Stat label="Wind" value={weather.wind_speed == null ? "—" : `${Math.round(weather.wind_speed)} km/h`} />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={apply} disabled={busy || !connected}>
              {busy ? <Spinner className="h-4 w-4" /> : <Icon d={ICONS.play} className="h-4 w-4" />}
              Weather on
            </Button>
            <Button variant="ghost" onClick={() => setSavingPreset(true)} disabled={!connected}>
              <Icon d={ICONS.star} className="h-4 w-4" /> Save
            </Button>
            <Button variant="ghost" onClick={turnOff} disabled={busy || !connected}>
              <Icon d={ICONS.power} className="h-4 w-4" /> Turn off
            </Button>
          </div>
        </div>
      </Card>

      <PresetDialog
        defaultName={`Weather — ${place.name}`}
        open={savingPreset}
        onClose={() => setSavingPreset(false)}
        onSave={savePreset}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 px-2 py-3">
      <p className="font-mono text-sm font-semibold text-amber-300">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
    </div>
  );
}