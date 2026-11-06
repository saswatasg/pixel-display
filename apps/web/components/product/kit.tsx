"use client";
import { Children, cloneElement, isValidElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { Icon, ICONS, type IconName } from "../ui";
export function Glyph({ name }: { name: IconName; size?: number }) { return <Icon d={ICONS[name]} className="glyph" />; }
export function Action({ children, onClick, disabled, variant = "primary", icon, className = "", title }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "quiet" | "danger"; icon?: IconName; className?: string; title?: string }) {
  return <button type="button" title={title} className={`action action-${variant} ${className}`} onClick={onClick} disabled={disabled}>{icon && <Glyph name={icon} />}{children}</button>;
}
export function Panel({ children, className = "", title, note }: { children: ReactNode; className?: string; title?: string; note?: string }) { return <section className={`panel ${className}`}>{title && <div className="panel-heading"><h2>{title}</h2>{note && <p>{note}</p>}</div>}{children}</section>; }
export function Field({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  const generated = useId();
  const elements = Children.toArray(children);
  const control = elements.find(c => isValidElement(c) && typeof c.type === "string" && ["input", "textarea", "select"].includes(c.type)) as ReactElement<{ id?: string }> | undefined;
  const id = control?.props.id ?? generated;
  return <div className="field"><label htmlFor={id}>{label}</label>{elements.map(c => c === control ? cloneElement(control, { id }) : c)}{note && <small>{note}</small>}</div>;
}
export function Range({ label, value, min = 0, max = 100, step = 1, onChange, onCommit, suffix = "", disabled }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; onCommit?: (v: number) => void; suffix?: string; disabled?: boolean }) {
  return <label className={`range-field ${disabled ? "is-disabled" : ""}`}><span>{label}<output>{value}{suffix}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(+e.target.value)} onPointerUp={e => onCommit?.(+(e.target as HTMLInputElement).value)} onKeyUp={e => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) onCommit?.(+(e.target as HTMLInputElement).value); }} /></label>;
}
export function Choice<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: IconName }[]; label: string }) {
  return <div className="choices" role="group" aria-label={label}>{options.map(o => <button type="button" key={o.id} aria-pressed={o.id === value} className={o.id === value ? "selected" : ""} onClick={() => onChange(o.id)}>{o.icon && <Glyph name={o.icon} />}{o.label}</button>)}</div>;
}
export function Colors({ value, onChange, label = "Color" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const colors = ["#FFB28B", "#F16D73", "#FFC85D", "#97CBA1", "#7FB9E8", "#BBA2E8", "#FFFFFF", "#111218"];
  return <div className="color-field"><span>{label}</span><div className="swatches">{colors.map(c => <button type="button" key={c} style={{ background: c }} aria-label={`${label} ${c}`} aria-pressed={value.toLowerCase() === c.toLowerCase()} onClick={() => onChange(c)} />)}<label className="custom-swatch" title="Custom color"><input aria-label={`Custom ${label.toLowerCase()}`} type="color" value={value} onChange={e => onChange(e.target.value)} /><Glyph name="plus" /></label></div></div>;
}
export function Switch({ checked, onChange, label, note }: { checked: boolean; onChange: (v: boolean) => void; label: string; note?: string }) { return <button type="button" role="switch" aria-label={label} aria-checked={checked} className="switch-row" onClick={() => onChange(!checked)}><span>{label}{note && <small>{note}</small>}</span><i className={checked ? "on" : ""} /></button>; }
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; d?.showModal(); d?.querySelector<HTMLInputElement>("input, textarea, select")?.focus(); return () => d?.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-head"><h2>{title}</h2><button type="button" className="icon-action" aria-label="Close dialog" onClick={onClose}><Glyph name="close" /></button></div>{children}</dialog>;
}
export function Empty({ icon = "image", title, children, action }: { icon?: IconName; title: string; children: ReactNode; action?: ReactNode }) { return <div className="empty"><span className="empty-icon"><Glyph name={icon} /></span><h3>{title}</h3><p>{children}</p>{action}</div>; }
export function SectionHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) { return <div className="section-head"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="section-description">{description}</p>}</div>{action}</div>; }
