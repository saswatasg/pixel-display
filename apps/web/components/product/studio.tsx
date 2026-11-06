"use client";
import { useEffect, useRef, useState } from "react";
import { createPreset, validateUpload } from "@/lib/api";
import { dataUrlToFile } from "@/lib/media";
import { BLANK, gridToDataUrl, paintLine, starterArt, type PixelGrid } from "@/lib/artwork";
import { readLocal, writeLocal } from "@/lib/local-store";
import { TEXT_MODES } from "@/lib/types";
import { Action, Choice, Colors, Field, Glyph, Modal, Panel, Range, SectionHead, Switch } from "./kit";
import { DisplayCanvas, type Preview } from "./canvas";
export type StudioTool = "text" | "image" | "draw";
export type Send = (action: string, payload: Record<string, unknown>, preview?: Preview) => Promise<boolean>;
export type SendImage = (file: File, preview?: Preview) => Promise<boolean>;
interface Props { connected: boolean; sending: boolean; send: Send; sendImage: SendImage; notify: (message: string, error?: boolean) => void; changed: () => void; tool: StudioTool; onTool: (tool: StudioTool) => void; }
export function Studio({ connected, sending, send, sendImage, notify, changed, tool, onTool }: Props) {
  const [text, setText] = useState("HELLO, WORLD");
  const [color, setColor] = useState("#FFB28B"); const [mode, setMode] = useState(1); const [speed, setSpeed] = useState(70); const [size, setSize] = useState(16); const [rainbow, setRainbow] = useState(false);
  const [bg, setBg] = useState("#111218"); const [background, setBackground] = useState(false);
  const [pixels, setPixels] = useState<PixelGrid>(() => starterArt("sunset"));
  const [history, setHistory] = useState<PixelGrid[]>([]); const [future, setFuture] = useState<PixelGrid[]>([]);
  const [brush, setBrush] = useState("#FFB28B"); const [erase, setErase] = useState(false); const [grid, setGrid] = useState(true);
  const [file, setFile] = useState<File | null>(null); const [source, setSource] = useState(""); const [converted, setConverted] = useState("");
  const [fit, setFit] = useState<"cover" | "contain" | "stretch">("cover"); const [position, setPosition] = useState(50); const [imageReady, setImageReady] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false); const [name, setName] = useState(""); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState(""); const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState(0);
  const paintRef = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const strokePoint = useRef<[number, number] | null>(null); const snapshot = useRef<PixelGrid | null>(null); const pixelsRef = useRef(pixels); pixelsRef.current = pixels;
  const isGif = file?.type === "image/gif";
  useEffect(() => {
    const draft = readLocal<Record<string, unknown>>("studio-draft:v1", {});
    if (typeof draft.text === "string") setText(draft.text.slice(0, 60));
    if (typeof draft.color === "string" && /^#[0-9a-f]{6}$/i.test(draft.color)) setColor(draft.color);
    if (Array.isArray(draft.pixels) && draft.pixels.length === 1024 && draft.pixels.every(p => typeof p === "string" && /^#[0-9a-f]{6}$/i.test(p))) setPixels(draft.pixels as PixelGrid);
    if (typeof draft.mode === "number" && draft.mode >= 0 && draft.mode <= 8) setMode(Math.round(draft.mode));
    if (typeof draft.speed === "number" && draft.speed >= 1 && draft.speed <= 100) setSpeed(Math.round(draft.speed));
    if (typeof draft.size === "number" && [8, 12, 16, 20, 24].includes(draft.size)) setSize(draft.size);
    if (typeof draft.rainbow === "boolean") setRainbow(draft.rainbow);
    if (typeof draft.background === "boolean") setBackground(draft.background);
    if (typeof draft.bg === "string" && /^#[0-9a-f]{6}$/i.test(draft.bg)) setBg(draft.bg);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { try { writeLocal("studio-draft:v1", { text, color, pixels, mode, speed, size, rainbow, bg, background }); } catch { notify("Draft could not be saved on this browser.", true); } }, 500);
    return () => clearTimeout(timer);
  }, [text, color, pixels, mode, speed, size, rainbow, bg, background, ready, notify]);
  useEffect(() => { if (!file) { setSource(""); return; } const url = URL.createObjectURL(file); setSource(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => {
    setImageReady(false); setConverted(""); if (!source) return;
    let current = true; const img = new Image();
    img.onload = () => {
      if (!current) return;
      const c = document.createElement("canvas"); c.width = c.height = 32; const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.fillStyle = "black"; ctx.fillRect(0, 0, 32, 32); ctx.imageSmoothingEnabled = false;
      const ratio = fit === "cover" ? Math.max(32 / img.width, 32 / img.height) : Math.min(32 / img.width, 32 / img.height);
      const w = fit === "stretch" ? 32 : img.width * ratio, h = fit === "stretch" ? 32 : img.height * ratio;
      ctx.drawImage(img, (32 - w) * position / 100, (32 - h) * position / 100, w, h);
      setConverted(c.toDataURL("image/png")); setImageReady(true);
    };
    img.onerror = () => { if (current) notify("This image could not be decoded. Try PNG, JPEG, or GIF.", true); }; img.src = source;
    return () => { current = false; };
  }, [source, fit, position, notify]);
  useEffect(() => {
    const c = paintRef.current, ctx = c?.getContext("2d"); if (!c || !ctx) return;
    pixels.forEach((p, i) => { ctx.fillStyle = p; ctx.fillRect(i % 32, Math.floor(i / 32), 1, 1); });
  }, [pixels, tool]);
  const commitPixels = (next: PixelGrid) => { setHistory(h => [...h.slice(-29), pixelsRef.current.slice()]); setFuture([]); setPixels(next); };
  const undo = () => { const prev = history.at(-1); if (!prev) return; setFuture(f => [...f, pixels.slice()]); setPixels(prev); setHistory(h => h.slice(0, -1)); };
  const redo = () => { const next = future.at(-1); if (!next) return; setHistory(h => [...h, pixels.slice()]); setPixels(next); setFuture(f => f.slice(0, -1)); };
  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(31, Math.floor((e.clientX - box.left) / box.width * 32))), y = Math.max(0, Math.min(31, Math.floor((e.clientY - box.top) / box.height * 32)));
    const from = strokePoint.current ?? [x, y] as [number, number];
    strokePoint.current = [x, y];
    setPixels(p => paintLine(p, from, [x, y], erase ? "#111218" : brush));
  };
  const endStroke = () => { if (drawing.current && snapshot.current) { setHistory(h => [...h.slice(-29), snapshot.current!]); setFuture([]); } drawing.current = false; snapshot.current = null; strokePoint.current = null; };
  const pick = (next?: File) => { if (!next) return; const issue = validateUpload(next); if (issue) { notify(issue, true); return; } setFile(next); setPosition(50); };
  const payload = () => ({ text, color, mode, speed, size, color_mode: rainbow ? 3 : 1, bg_color: background ? bg : null });
  const preview: Preview = tool === "text" ? { label: text || "Your message", text, color: rainbow ? "#FFC85D" : color, note: "Approximate text preview" } : tool === "draw" ? { label: "Pixel artwork", pixels, note: "32 × 32 · every pixel is yours" } : { label: file?.name ?? "Your image", image: converted || undefined, note: isGif ? "First-frame preview · animation is sent" : "32 × 32 output preview" };
  const performSend = async () => {
    if (tool === "text") { if (text.trim()) await send("text", payload(), preview); }
    else if (tool === "image" && isGif && file) await sendImage(file, preview);
    else if (tool === "draw" || converted) await sendImage(await dataUrlToFile(tool === "draw" ? gridToDataUrl(pixels) : converted, name || file?.name || "Pixel artwork"), preview);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && connected && !sending) { e.preventDefault(); void performSend().catch(e => notify(e.message, true)); } };
    if (document.querySelector('[data-view="studio"]:not([hidden])')) window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [performSend, connected, sending, notify]);
  const save = async () => {
    if (!name.trim()) return; setSaving(true); setSaveError("");
    try {
      if (tool === "text") await createPreset(name.trim(), "text", payload());
      else await createPreset(name.trim(), "image", { url: tool === "draw" ? gridToDataUrl(pixels) : converted, name: name.trim() });
      changed(); setSaveOpen(false); notify("Saved to your library.");
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); }
  };
  const canSend = tool === "text" ? Boolean(text.trim()) : tool === "draw" || Boolean(file && imageReady);
  return <>
    <SectionHead eyebrow="Make something yours" title="The studio" description="A little canvas. A lot of possibility." />
    <div className="studio-toolbar"><Choice label="Studio tool" value={tool} onChange={onTool} options={[{ id: "text", label: "Message", icon: "text" }, { id: "image", label: "Image & GIF", icon: "image" }, { id: "draw", label: "Pixel editor", icon: "sparkle" }]} /><span className="desktop-hint">⌘ / Ctrl + Enter to send</span></div>
    <div className={`studio-layout tool-${tool}`}>
      <section className="canvas-workspace"><div className="canvas-heading"><span className="eyebrow">{tool === "draw" ? "Your canvas" : "Preview"}</span><span className="mono">32 × 32</span></div>
        {tool === "draw" ? <div className={`paint-board ${grid ? "show-grid" : ""}`}><canvas ref={paintRef} width={32} height={32} tabIndex={0} aria-label={`Pixel drawing canvas. Pixel ${cursor % 32 + 1}, ${Math.floor(cursor / 32) + 1}. Arrow keys move; Space paints; Delete erases.`} onKeyDown={e => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Delete", "Backspace"].includes(e.key)) e.preventDefault();
          if (e.key === "ArrowLeft") setCursor(c => Math.max(0, c - 1));
          if (e.key === "ArrowRight") setCursor(c => Math.min(1023, c + 1));
          if (e.key === "ArrowUp") setCursor(c => Math.max(0, c - 32));
          if (e.key === "ArrowDown") setCursor(c => Math.min(1023, c + 32));
          if (e.key === " " || e.key === "Delete" || e.key === "Backspace") { const next = pixels.slice(); next[cursor] = e.key === " " && !erase ? brush : "#111218"; commitPixels(next); }
        }} onPointerDown={e => { e.preventDefault(); drawing.current = true; snapshot.current = pixelsRef.current.slice(); e.currentTarget.setPointerCapture(e.pointerId); paint(e); }} onPointerMove={e => { if (drawing.current) paint(e); }} onPointerUp={endStroke} onLostPointerCapture={endStroke} /><span className="paint-cursor" aria-hidden="true" style={{ left: `${cursor % 32 / 32 * 100}%`, top: `${Math.floor(cursor / 32) / 32 * 100}%` }} /></div> : <DisplayCanvas preview={tool === "image" && !converted ? { label: "Image placeholder", pixels: BLANK() } : preview} />}
        <p className="canvas-caption">{preview.note}</p>
        {tool === "draw" && <div className="drawing-actions"><Action icon="reset" variant="secondary" disabled={!history.length} onClick={undo}>Undo</Action><Action icon="reset" variant="secondary" disabled={!future.length} onClick={redo}>Redo</Action><button className="text-action" type="button" onClick={() => setGrid(!grid)}>{grid ? "Hide" : "Show"} grid</button></div>}
        <div className="canvas-footer"><span><i className="status-dot" />Changes stay local until you send</span><Glyph name="link" /></div>
      </section>
      <Panel className="studio-inspector" title={tool === "text" ? "Say it in pixels" : tool === "draw" ? "Your pixel toolkit" : "Picture this"} note={tool === "text" ? "From a tiny hello to a big announcement." : "Create for the actual 32 × 32 display."}>
        {tool === "text" && <>
          <Field label="Message"><textarea aria-label="Message" maxLength={60} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="What’s on your mind?" /><small className="counter">{[...text].length} / 60 characters</small></Field>
          <Colors value={color} onChange={setColor} /><Switch checked={rainbow} onChange={setRainbow} label="Rainbow lettering" />
          <div className="field-pair"><Field label="Motion"><select value={mode} onChange={e => setMode(+e.target.value)}>{Object.entries(TEXT_MODES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Letter size"><select value={size} onChange={e => setSize(+e.target.value)}>{[8, 12, 16, 20, 24].map(s => <option key={s} value={s}>{s} px</option>)}</select></Field></div>
          <Range label="Motion speed" value={speed} min={1} max={100} onChange={setSpeed} />
          <details className="advanced"><summary>Background color</summary><Switch checked={background} onChange={setBackground} label="Use a background" />{background && <Colors value={bg} onChange={setBg} label="Background" />}</details>
        </>}
        {tool === "image" && <>
          <label className="dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}><span className="drop-icon"><Glyph name="image" /></span><strong>{file ? file.name : "Drop a little inspiration"}</strong><span>Choose an image or GIF · up to 5 MB</span><input type="file" aria-label="Choose image or GIF" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" onChange={e => pick(e.target.files?.[0])} /><b>{file ? "Choose another file" : "Browse files"}</b></label>
          {file && !isGif && <><Field label="How should it fit?"><select value={fit} onChange={e => setFit(e.target.value as typeof fit)}><option value="cover">Fill the display (crop)</option><option value="contain">Show the whole image (fit)</option><option value="stretch">Stretch to square</option></select></Field>{fit === "cover" && <Range label="Crop position" value={position} onChange={setPosition} />}</>}
          <p className="notice">{isGif ? "GIFs are resized to 32 × 32. The preview shows the first frame; the full animation is sent." : "Transparent areas become black. The preview shows the exact crop and pixel resolution."}</p>
        </>}
        {tool === "draw" && <>
          <Colors value={brush} onChange={v => { setBrush(v); setErase(false); }} label="Brush color" /><Switch label="Eraser" checked={erase} onChange={setErase} />
          <div><p className="field-title">A starting point</p><div className="starter-grid">{(["sunset", "plant", "heart"] as const).map(kind => <button type="button" key={kind} onClick={() => commitPixels(starterArt(kind))}><DisplayCanvas preview={{ label: kind, pixels: starterArt(kind) }} small /><span>{kind === "sunset" ? "Golden hour" : kind === "plant" ? "Little green" : "With love"}</span></button>)}</div></div>
          <Action variant="quiet" icon="trash" onClick={() => commitPixels(BLANK())}>Clear canvas</Action><p className="notice">Paint with a mouse, pen, or finger. Undo keeps your last 30 strokes. Nothing is sent automatically. Keyboard: arrow keys move, Space paints, Delete erases.</p>
        </>}
      </Panel>
      <div className="studio-sendbar"><span className="send-context">{connected ? "Ready for your display" : "Connect a display to send"}<small>Your draft stays here while you explore.</small></span><Action variant="secondary" icon="star" disabled={!canSend || Boolean(isGif && tool === "image")} onClick={() => { setName(tool === "text" ? text.slice(0, 30) : tool === "draw" ? "Pixel artwork" : file?.name ?? "My image"); setSaveError(""); setSaveOpen(true); }}>Save scene</Action><Action icon="zap" disabled={!connected || sending || !canSend} onClick={() => void performSend().catch(e => notify(e.message, true))}>{sending ? "Sending…" : "Send to display"}</Action></div>
    </div>
    {saveOpen && <Modal title="Save to your library" onClose={() => setSaveOpen(false)}><Field label="Scene name"><input autoFocus maxLength={40} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void save(); }} /></Field>{saveError && <p role="alert" className="error-text">{saveError}</p>}<div className="modal-actions"><Action variant="secondary" onClick={() => setSaveOpen(false)}>Cancel</Action><Action onClick={() => void save()} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save scene"}</Action></div></Modal>}
  </>;
}
