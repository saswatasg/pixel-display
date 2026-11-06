"use client";
import { useEffect, useState } from "react";
import { createPreset } from "@/lib/api";
import { geocode, fetchWeatherData, renderWeatherPreview, wmoLabel } from "@/lib/weather";
import type { GeoResult, WeatherData } from "@/lib/types";
import { ANIMATION_STYLES } from "@/lib/types";
import { readLocal, writeLocal } from "@/lib/local-store";
import { Action, Choice, Colors, Field, Modal, Panel, Range, Switch } from "./kit";
import { DisplayCanvas, type Preview } from "./canvas";
import type { Send } from "./studio";
export type Mode = "clock" | "weather" | "effects" | "light" | "timers" | "score";
export const MODE_OPTIONS = [{ id: "clock", label: "Clock", icon: "clock" }, { id: "weather", label: "Weather", icon: "sun" }, { id: "effects", label: "Effects", icon: "sparkle" }, { id: "light", label: "Color", icon: "zap" }, { id: "timers", label: "Timers", icon: "timer" }, { id: "score", label: "Scoreboard", icon: "scoreboard" }] as const;
export function Modes({ mode, setMode, connected, sending, send, notify, changed }: { mode: Mode; setMode: (m: Mode) => void; connected: boolean; sending: boolean; send: Send; notify: (m: string, e?: boolean) => void; changed: () => void }) {
  const [color, setColor] = useState("#FFB28B"), [face, setFace] = useState(0), [date, setDate] = useState(true), [hour24, setHour24] = useState(true);
  const [effect, setEffect] = useState(0), [speed, setSpeed] = useState(90);
  const [timer, setTimer] = useState<"countdown" | "stopwatch">("countdown"), [seconds, setSeconds] = useState(300);
  const [scores, setScores] = useState([0, 0]);
  const [query, setQuery] = useState(""), [results, setResults] = useState<GeoResult[]>([]), [searching, setSearching] = useState(false), [searchError, setSearchError] = useState("");
  const [place, setPlace] = useState<GeoResult | null>(null), [weather, setWeather] = useState<WeatherData | null>(null), [weatherError, setWeatherError] = useState("");
  const [unit, setUnit] = useState<"c" | "f">("c"), [interval, setIntervalMin] = useState(30), [locating, setLocating] = useState(false);
  const [optionsReady, setOptionsReady] = useState(false);
  useEffect(() => {
    const saved = readLocal<Record<string, unknown>>("mode-options:v1", {});
    if (typeof saved.face === "number" && saved.face >= 0 && saved.face <= 7) setFace(Math.round(saved.face));
    if (typeof saved.color === "string" && /^#[0-9a-f]{6}$/i.test(saved.color)) setColor(saved.color);
    if (typeof saved.date === "boolean") setDate(saved.date);
    if (typeof saved.hour24 === "boolean") setHour24(saved.hour24);
    if (typeof saved.effect === "number" && saved.effect >= 0 && saved.effect <= 6) setEffect(Math.round(saved.effect));
    if (typeof saved.speed === "number" && saved.speed >= 1 && saved.speed <= 255) setSpeed(Math.round(saved.speed));
    if (saved.unit === "f" || saved.unit === "c") setUnit(saved.unit);
    if (typeof saved.interval === "number" && [15, 30, 60, 120].includes(saved.interval)) setIntervalMin(saved.interval);
    setOptionsReady(true);
  }, []);
  useEffect(() => {
    if (!optionsReady) return;
    const t = setTimeout(() => { try { writeLocal("mode-options:v1", { face, color, date, hour24, effect, speed, unit, interval }); } catch { notify("Mode preferences could not be saved in this browser.", true); } }, 500);
    return () => clearTimeout(t);
  }, [face, color, date, hour24, effect, speed, unit, interval, optionsReady, notify]);
  const [saveName, setSaveName] = useState(""), [saveOpen, setSaveOpen] = useState(false), [saveError, setSaveError] = useState("");
  useEffect(() => { const p = readLocal<GeoResult | null>("weather-place:v1", null); if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && typeof p.name === "string") setPlace(p); }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    const abort = new AbortController();
    const t = setTimeout(async () => { setSearching(true); setSearchError(""); try { const r = await geocode(query, abort.signal); if (!abort.signal.aborted) { setResults(r); if (!r.length) setSearchError("No cities found. Try a nearby city."); } } catch { if (!abort.signal.aborted) setSearchError("City search is unavailable. Check your internet connection."); } finally { if (!abort.signal.aborted) setSearching(false); } }, 350);
    return () => { abort.abort(); clearTimeout(t); };
  }, [query]);
  useEffect(() => {
    if (mode !== "weather" || !place) return; let active = true; setWeather(null); setWeatherError("");
    fetchWeatherData(place.lat, place.lon, unit).then(w => { if (active) setWeather({ ...w, city: place.name }); }).catch(() => { if (active) setWeatherError("Weather is unavailable. Please try again when you’re online."); });
    return () => { active = false; };
  }, [place, unit, mode]);
  const choose = (p: GeoResult) => { setPlace(p); setQuery(""); setResults([]); try { writeLocal("weather-place:v1", p); } catch { notify("Location could not be saved in this browser.", true); } };
  const locate = () => {
    if (!navigator.geolocation) { notify("Location is unavailable in this browser.", true); return; }
    setLocating(true); navigator.geolocation.getCurrentPosition(p => { choose({ name: "Nearby", lat: p.coords.latitude, lon: p.coords.longitude }); setLocating(false); }, () => { setLocating(false); notify("Location wasn’t shared. You can search for a city instead.", true); }, { timeout: 10000 });
  };
  let preview: Preview = { label: "Clock", clock: true, color, note: "Style preview · the panel renders its own clock face" };
  let action = "clock", payload: Record<string, unknown> = { style: face, color, showDate: date, format24h: hour24, syncTime: true };
  if (mode === "light") { preview = { label: "Ambient color", solid: color, note: "A little color for your corner of the world" }; action = "fullscreen-color"; payload = { color }; }
  if (mode === "effects") { preview = { label: ANIMATION_STYLES[effect], note: "Illustrative pattern · motion runs on the display", pixels: Array.from({ length: 1024 }, (_, i) => ["#E89086", "#E4B778", "#A0B8A3", "#8FA8BD", "#AE98BC", "#CDA0B5"][Math.floor((i % 32 + Math.floor(i / 32) + effect * 5) / 6) % 6]) }; action = "animation"; payload = { style: effect, speed, colors: ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"] }; }
  if (mode === "weather") {
    let pixels: string[] | undefined;
    if (weather) pixels = renderWeatherPreview(weather, color).flat().map(c => c.startsWith("rgba") ? "#111218" : c);
    preview = { label: place?.name ?? "Choose your city", pixels, text: weather ? undefined : "WEATHER", color, note: weather ? `${Math.round(weather.temperature ?? 0)}° · ${wmoLabel(weather.weather_code)}` : "An internet connection is needed for weather" };
    action = "weather"; payload = { lat: place?.lat, lon: place?.lon, name: place?.name, unit, color, interval };
  }
  if (mode === "timers") { preview = { label: timer === "countdown" ? "Countdown" : "Stopwatch", text: timer === "countdown" ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "00:00", color, note: "Timer runs on your display" }; action = timer === "countdown" ? "countdown" : "chronograph"; payload = timer === "countdown" ? { seconds } : { mode: "start" }; }
  if (mode === "score") { preview = { label: "Scoreboard", text: `${scores[0]}-${scores[1]}`, color, note: "Two teams. One tiny scoreboard." }; action = "scoreboard"; payload = { score1: scores[0], score2: scores[1] }; }
  return <section className="modes-section"><div className="subsection-head"><div><p className="eyebrow">Make it useful</p><h2>Find your everyday mode</h2></div></div>
    <Choice label="Display mode" value={mode} onChange={setMode} options={[...MODE_OPTIONS]} />
    <div className="mode-workspace"><div className="mode-preview"><DisplayCanvas preview={preview} /><p>{preview.note}</p></div><div className="mode-settings">
      <h3>{MODE_OPTIONS.find(m => m.id === mode)?.label}</h3>
      {mode === "clock" && <><div className="clock-faces" role="group" aria-label="Clock face">{Array.from({ length: 8 }, (_, i) => <button type="button" key={i} aria-pressed={face === i} onClick={() => setFace(i)}><span className={`face-glyph face-${i}`}>{i % 3 === 0 ? "◷" : i % 3 === 1 ? "12:34" : "◴"}</span><small>Face {String(i + 1).padStart(2, "0")}</small></button>)}</div><Colors value={color} onChange={setColor} /><Switch label="24-hour time" checked={hour24} onChange={setHour24} /><Switch label="Show date" checked={date} onChange={setDate} /><p className="notice">Time is synced from this device when you apply the clock.</p></>}
      {mode === "effects" && <><Field label="Pattern"><select value={effect} onChange={e => setEffect(+e.target.value)}>{Object.entries(ANIMATION_STYLES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field><Range label="Animation speed" value={speed} max={255} min={1} onChange={setSpeed} /><p className="notice">These animations run on the panel, including after you disconnect.</p></>}
      {mode === "light" && <><Colors value={color} onChange={setColor} label="Ambient color" /><p className="notice">Fill the entire display with a single color. Brightness is controlled separately.</p></>}
      {mode === "weather" && <><Field label="City"><input value={query} placeholder={place?.name ?? "Search for a city"} onChange={e => setQuery(e.target.value)} autoComplete="off" /></Field>{searching && <p className="muted">Finding your city…</p>}{searchError && <p className="error-text" role="status">{searchError}</p>}{results.length > 0 && <div className="city-results">{results.map(p => <button type="button" key={`${p.lat},${p.lon}`} onClick={() => choose(p)}><strong>{p.name}</strong><small>{[p.admin1, p.country].filter(Boolean).join(", ")}</small></button>)}</div>}<button type="button" className="text-action" onClick={locate} disabled={locating}>{locating ? "Locating…" : "Use my location"}</button><Choice label="Temperature unit" value={unit} onChange={setUnit} options={[{ id: "c", label: "Celsius · °C" }, { id: "f", label: "Fahrenheit · °F" }]} /><Colors value={color} onChange={setColor} /><Field label="Refresh every"><select value={interval} onChange={e => setIntervalMin(+e.target.value)}>{[15, 30, 60, 120].map(v => <option value={v} key={v}>{v} minutes</option>)}</select></Field>{weatherError && <p className="error-text" role="alert">{weatherError}</p>}<p className="notice">Keep this page open and Bluetooth connected for updates. Background tabs may pause.</p></>}
      {mode === "timers" && <><Choice label="Timer type" value={timer} onChange={setTimer} options={[{ id: "countdown", label: "Countdown" }, { id: "stopwatch", label: "Stopwatch" }]} />{timer === "countdown" ? <><div className="timer-presets">{[60, 300, 900, 1500].map(n => <button key={n} type="button" className={seconds === n ? "selected" : ""} onClick={() => setSeconds(n)}>{n / 60} min</button>)}</div><Field label="Duration in seconds"><input type="number" min={1} max={3599} value={seconds} onChange={e => setSeconds(Math.max(1, Math.min(3599, +e.target.value || 1)))} /></Field><Action variant="secondary" disabled={!connected || sending} onClick={() => void send("countdown", { cancel: true })}>Cancel countdown</Action></> : <div className="button-row">{["pause", "resume", "reset"].map(m => <Action variant="secondary" key={m} disabled={!connected || sending} onClick={() => void send("chronograph", { mode: m })}>{m[0].toUpperCase() + m.slice(1)}</Action>)}</div>}<p className="notice">The timer runs on the display. This preview does not read its current progress.</p></>}
      {mode === "score" && <div className="score-inputs">{scores.map((v, i) => <Field key={i} label={`Team ${i === 0 ? "A" : "B"}`}><input type="number" value={v} min={0} max={999} onChange={e => setScores(s => s.map((n, j) => j === i ? Math.max(0, Math.min(999, +e.target.value || 0)) : n))} /><div className="button-row"><Action variant="secondary" onClick={() => setScores(s => s.map((n, j) => j === i ? Math.max(0, n - 1) : n))}>−</Action><Action variant="secondary" onClick={() => setScores(s => s.map((n, j) => j === i ? Math.min(999, n + 1) : n))}>+</Action></div></Field>)}</div>}
      <div className="mode-send"><Action icon="zap" disabled={!connected || sending || (mode === "weather" && (!place || !weather))} onClick={() => void send(action, payload, preview)}>{sending ? "Sending…" : mode === "timers" ? "Start timer" : "Show on display"}</Action><Action variant="secondary" icon="star" disabled={mode === "weather" && !place} onClick={() => { setSaveName(preview.label); setSaveError(""); setSaveOpen(true); }}>Save scene</Action></div>
    </div></div>
    {saveOpen && <Modal title="Save this scene" onClose={() => setSaveOpen(false)}><Field label="Scene name"><input autoFocus maxLength={40} value={saveName} onChange={e => setSaveName(e.target.value)} /></Field>{saveError && <p className="error-text" role="alert">{saveError}</p>}<div className="modal-actions"><Action variant="secondary" onClick={() => setSaveOpen(false)}>Cancel</Action><Action disabled={!saveName.trim()} onClick={async () => { try { await createPreset(saveName.trim(), action, payload); changed(); setSaveOpen(false); notify("Scene saved to your library."); } catch (e) { setSaveError(e instanceof Error ? e.message : "Could not save."); } }}>Save scene</Action></div></Modal>}
  </section>;
}
