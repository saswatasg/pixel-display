"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { bluetooth, bluetoothSupport } from "@/lib/bluetooth/client";
import { listPresets, sendAction, sendFile, updatePreset } from "@/lib/api";
import { listPastImages, listFrameMedia, dataUrlToFile, type CloudMediaItem } from "@/lib/media";
import { readLocal, writeLocal } from "@/lib/local-store";
import { usePrefs } from "@/lib/usePrefs";
import type { AppStatus, Preset } from "@/lib/types";
import { Action, Empty, Glyph, Panel, Range, SectionHead } from "./kit";
import { DisplayCanvas, SAMPLE, type Preview } from "./canvas";
import { Studio, type StudioTool, type Send } from "./studio";
import { Modes, type Mode } from "./modes";
import { Library, scenePreview } from "./library";
import { Device, type Theme } from "./device";
const NAV = [{ id: "display", label: "Display", icon: "home", subtitle: "Your everyday remote" }, { id: "studio", label: "Studio", icon: "sparkle", subtitle: "Make something yours" }, { id: "library", label: "Library", icon: "image", subtitle: "Saved for another day" }, { id: "device", label: "Device", icon: "link", subtitle: "Connection & preferences" }] as const;
type View = typeof NAV[number]["id"];
const ACTION_NAMES: Record<string, string> = { "fullscreen-color": "Ambient color", "clock": "Clock", "text": "Message", "image": "Pixel artwork", "gif": "Animation", "weather": "Weather", "animation": "Animated effect", "slideshow": "Photo slideshow", "countdown": "Countdown", "chronograph": "Stopwatch", "scoreboard": "Scoreboard" };
export default function PixelApp() {
  const [view, setView] = useState<View>("display"), [tool, setTool] = useState<StudioTool>("text"), [mode, setMode] = useState<Mode>("clock");
  const [status, setStatus] = useState<AppStatus | null>(null), [support, setSupport] = useState<string | null>(null), [pairing, setPairing] = useState(false), [sending, setSending] = useState(false);
  const [scenes, setScenes] = useState<Preset[]>([]), [images, setImages] = useState<CloudMediaItem[]>([]), [frame, setFrame] = useState<CloudMediaItem[]>([]);
  const [preview, setPreview] = useState<Preview>(SAMPLE), [lastSent, setLastSent] = useState<string | null>(null), [power, setPower] = useState<boolean | null>(null), [theme, setThemeState] = useState<Theme>("system");
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null), [revision, setRevision] = useState(0);
  const lock = useRef(false), toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { prefs, ready, updatePrefs } = usePrefs(); const [brightness, setBrightness] = useState(50);
  const connected = Boolean(status?.device.connected);
  const notify = useCallback((text: string, error = false) => { setToast({ text, error }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), error ? 7000 : 3500); }, []);
  const changed = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => { const update = () => { setStatus(bluetooth.status()); setPairing(bluetooth.busy); }; setSupport(bluetoothSupport()); update(); return bluetooth.subscribe(update); }, []);
  useEffect(() => { void Promise.all([listPresets(), listPastImages(), listFrameMedia()]).then(([s, i, f]) => { setScenes(s); setImages(i); setFrame(f); }); }, [revision]);
  useEffect(() => { if (ready) setBrightness(prefs.brightness); }, [ready, prefs.brightness]);
  useEffect(() => { const stored = readLocal<Theme>("appearance:v1", "system"); if (["light", "dark", "system"].includes(stored)) setThemeState(stored); }, []);
  useEffect(() => { const media = window.matchMedia("(prefers-color-scheme: dark)"); const apply = () => { document.documentElement.dataset.theme = theme === "system" ? media.matches ? "dark" : "light" : theme; }; apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply); }, [theme]);
  useEffect(() => { const err = () => notify("This browser couldn’t save your settings. Storage may be full or blocked.", true); window.addEventListener("pixel-storage-error", err); return () => window.removeEventListener("pixel-storage-error", err); }, [notify]);
  useEffect(() => { if (!connected) setPower(null); }, [connected]);
  useEffect(() => () => { clearTimeout(toastTimer.current); }, []);
  const setTheme = (v: Theme) => { setThemeState(v); try { writeLocal("appearance:v1", v); } catch (e) { notify((e as Error).message, true); } };
  const connect = async () => { try { await bluetooth.connect(); notify("Connected. Your display is ready."); } catch (e) { notify(e instanceof Error ? e.message : "Could not connect.", true); } };
  const send: Send = async (action, payload, next) => {
    if (lock.current) return false; lock.current = true; setSending(true);
    try {
      const result = await sendAction(action, payload);
      if (!result.ok) { notify(result.error ?? "Could not send this command.", true); return false; }
      if (next) { setPreview({ ...next, note: "Last sent from this browser · not a live camera feed" }); setLastSent(next.label); }
      else if (ACTION_NAMES[action] && !["pause", "resume", "reset"].includes(String(payload.mode))) {
        setLastSent(ACTION_NAMES[action]);
        setPreview({ label: ACTION_NAMES[action], text: action === "slideshow" ? "PHOTOS" : ACTION_NAMES[action].toUpperCase(), color: "#FFB28B", note: "Program selected · illustrative preview" });
      }
      if (action === "screen") setPower(payload.power === "on"); else if (ACTION_NAMES[action] || action === "test-display") setPower(true);
      if (action !== "brightness") notify(action === "screen" ? payload.power === "on" ? "Screen on." : "Screen off. Background updates stopped." : action === "automation-off" ? "Background updates stopped." : "Sent to your display.");
      return true;
    } finally { lock.current = false; setSending(false); }
  };
  const sendImage = async (file: File, next?: Preview) => {
    if (lock.current) return false; lock.current = true; setSending(true);
    try { const result = await sendFile(file.type === "image/gif" ? "gif" : "image", file); if (!result.ok) { notify(result.error ?? "Could not send this image.", true); return false; } setPreview({ ...(next ?? { label: file.name }), note: "Last sent from this browser · not a live camera feed" }); setLastSent(next?.label ?? file.name); setPower(true); notify("Image sent to your display."); return true; } finally { lock.current = false; setSending(false); }
  };
  const play = async (p: Preset) => {
    try { const ok = p.action === "image" && typeof p.payload.url === "string" ? await sendImage(await dataUrlToFile(p.payload.url, p.name), scenePreview(p)) : await send(p.action, p.payload, scenePreview(p)); if (ok) { await updatePreset(p.id, p.name, p.action, p.payload, { plays: (p.plays ?? 0) + 1 }); changed(); } } catch (e) { notify(e instanceof Error ? e.message : "Could not play this scene.", true); }
  };
  const go = (v: View) => { setView(v); document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "instant" }); window.scrollTo({ top: 0, behavior: "instant" }); };
  const create = (t: StudioTool = "text") => { setTool(t); go("studio"); };
  const favoriteScenes = scenes.filter(p => p.pinned).slice(0, 4), recent = [...scenes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  const connection = <button type="button" className={`connection-pill ${connected ? "is-connected" : ""}`} disabled={pairing || Boolean(support)} onClick={() => { if (connected) go("device"); else void connect(); }}><i className={`status-dot ${connected ? "connected" : ""}`} /><span>{pairing ? "Connecting…" : connected ? status?.device.name : "Connect display"}</span><Glyph name="link" /></button>;
  const controls = <><div className="controls-heading"><span className="eyebrow">Display controls</span><span className={`power-badge ${power ? "on" : ""}`}>{power === null ? "Power unknown" : power ? "Screen on" : "Screen off"}</span></div><div className="power-controls"><Action variant={power === true ? "primary" : "secondary"} icon="power" disabled={!connected || sending} onClick={() => void send("screen", { power: "on" })}>On</Action><Action variant={power === false ? "primary" : "secondary"} disabled={!connected || sending} onClick={() => void send("screen", { power: "off" })}>Off</Action></div><Range label="Brightness" value={brightness} min={5} max={100} step={5} suffix="%" disabled={!connected || sending} onChange={setBrightness} onCommit={v => { updatePrefs({ brightness: v }); void send("brightness", { value: v }); }} /><div className="controls-bottom"><Action variant="quiet" disabled={!connected || sending} icon="pause" onClick={() => void send("automation-off", {})}>Stop updates</Action><button type="button" className="icon-action" aria-label="Connection settings" onClick={() => go("device")}><Glyph name="more" /></button></div></>;
  return <div className={`pixel-app view-${view}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="app-sidebar"><button type="button" className="brand" aria-label="Pixel Display home" onClick={() => go("display")}><span className="brand-mark"><i /><i /><i /><i /></span><span>pixel<span className="brand-period">.</span><small>A little more expression.</small></span></button><p className="sidebar-label">YOUR WORKSPACE</p><nav aria-label="Desktop navigation">{NAV.map(n => <button type="button" key={n.id} aria-label={n.label} title={n.label} aria-current={view === n.id ? "page" : undefined} onClick={() => go(n.id)}><Glyph name={n.icon} /><span>{n.label}</span>{n.id === "library" && <small>{scenes.length}</small>}</button>)}</nav><div className="sidebar-note"><span className="tiny-pixels">▦</span><strong>Small screen.<br />Endless possibilities.</strong><p>Made for your corner<br />of the world.</p></div><div className="sidebar-device"><span className="device-mini"><Glyph name="image" /></span><div><strong>Pixel display</strong><small>32 × 32 · Bluetooth</small></div><i className={`status-dot ${connected ? "connected" : ""}`} /></div></aside>
    <div className="app-shell"><header className="app-topbar"><div className="breadcrumbs"><span>Your workspace</span><i>/</i><strong>{NAV.find(n => n.id === view)?.label}</strong></div><button className="mobile-brand" type="button" onClick={() => go("display")}><span className="brand-mark"><i /><i /><i /><i /></span>pixel.</button><div className="topbar-actions">{sending && <span className="sending-status" role="status"><i />Sending…</span>}{connection}</div></header>
      <main id="main-content" className="app-content">
        {support && <div className="support-banner" role="status"><Glyph name="alert" /><p>{support}</p></div>}
        {!connected && !support && <div className="connection-banner"><span><i className="status-dot" />Create freely. Connect when you’re ready to send.</span><button type="button" onClick={() => void connect()} disabled={pairing}>Connect display <span>↗</span></button></div>}
        <div className="app-view" data-view="display" hidden={view !== "display"}>
          <SectionHead eyebrow="A little space for you" title="Your display. Your way." description="Set the mood, share a thought, or make something small." action={<Action icon="plus" onClick={() => create()}>Create something</Action>} />
          <div className="dashboard-top"><section className="display-hero"><div className="hero-meta"><span className="eyebrow">{lastSent ? "Last sent from this browser" : "A little inspiration"}</span><span className="resolution-pill">32 × 32</span></div><DisplayCanvas preview={preview} /><div className="hero-caption"><div><h2>{lastSent ?? "A little golden hour"}</h2><p>{lastSent ? "Your display may also be changed by other controllers." : "Sample artwork. Make it your display’s next mood."}</p></div>{!lastSent && <button type="button" className="round-action" aria-label="Open pixel editor" onClick={() => create("draw")}><Glyph name="plus" /></button>}</div></section><Panel className="dashboard-controls">{controls}<div className="connection-note"><Glyph name="link" /><div><strong>{connected ? "Directly connected" : "A nearby connection"}</strong><p>{connected ? "This device is talking to your display over Bluetooth." : "Your phone or computer connects directly. No bridge needed."}</p></div></div></Panel></div>
          {status?.automation.enabled && <div className="running-program"><i className="status-dot connected" /><div><strong>{status.automation.program === "weather" ? "Weather updates are running" : "Photo slideshow is running"}</strong><span>{status.automation.error ?? "Keep this page open and your display nearby."}</span></div><Action variant="secondary" onClick={() => void send("automation-off", {})}>Stop</Action></div>}
          <div className="quick-create-grid">{[{ tool: "text" as const, icon: "text" as const, label: "Say something", sub: "A message in pixels", cls: "peach" }, { tool: "image" as const, icon: "image" as const, label: "Picture this", sub: "Photos, artwork & GIFs", cls: "lavender" }, { tool: "draw" as const, icon: "sparkle" as const, label: "Make a little art", sub: "Your own 32 × 32 canvas", cls: "sage" }].map(item => <button type="button" key={item.tool} className={`quick-create ${item.cls}`} onClick={() => create(item.tool)}><span><Glyph name={item.icon} /></span><div><strong>{item.label}</strong><p>{item.sub}</p></div><b>↗</b></button>)}</div>
          <Modes mode={mode} setMode={setMode} connected={connected} sending={sending} send={send} notify={notify} changed={changed} />
          <section className="dashboard-scenes"><div className="subsection-head"><div><p className="eyebrow">Keep the good ones close</p><h2>{favoriteScenes.length ? "Your favorites" : "From your library"}</h2></div><button type="button" className="text-action" onClick={() => go("library")}>Open library ↗</button></div>{(favoriteScenes.length ? favoriteScenes : recent).length ? <div className="quick-scene-grid">{(favoriteScenes.length ? favoriteScenes : recent).map(p => <button type="button" disabled={!connected || sending} key={p.id} onClick={() => void play(p)}><DisplayCanvas small preview={scenePreview(p)} /><div><strong>{p.name}</strong><small>{p.action === "image" ? "Pixel image" : ACTION_NAMES[p.action] ?? p.action}</small></div><Glyph name="play" /></button>)}</div> : <Panel><Empty icon="star" title="Your everyday favorites, right here" action={<Action variant="secondary" onClick={() => create()}>Make your first scene</Action>}>Save something in the Studio, then star it in your Library for a shortcut here.</Empty></Panel>}</section>
        </div>
        <div className="app-view" data-view="studio" hidden={view !== "studio"}><Studio tool={tool} onTool={setTool} connected={connected} sending={sending} send={send} sendImage={sendImage} notify={notify} changed={changed} /></div>
        <div className="app-view" data-view="library" hidden={view !== "library"}><Library scenes={scenes} images={images} frame={frame} connected={connected} sending={sending} play={play} send={send} changed={changed} notify={notify} create={() => create()} /></div>
        <div className="app-view" data-view="device" hidden={view !== "device"}><Device status={status} pairing={pairing} support={support} connect={connect} send={send} notify={notify} theme={theme} setTheme={setTheme} /></div>
        <footer className="app-footer"><span>Small by design. Yours by nature.</span><span>APEX / iDotMatrix · 32 × 32</span></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{NAV.map(n => <button type="button" key={n.id} aria-label={n.label} title={n.label} aria-current={view === n.id ? "page" : undefined} onClick={() => go(n.id)}><Glyph name={n.icon} /><span>{n.label}</span></button>)}</nav>
    {toast && <div className={`product-toast ${toast.error ? "toast-error" : ""}`} role={toast.error ? "alert" : "status"}><Glyph name={toast.error ? "alert" : "check"} /><span>{toast.text}</span><button type="button" className="icon-action" aria-label="Dismiss notification" onClick={() => setToast(null)}><Glyph name="close" /></button></div>}
  </div>;
}
