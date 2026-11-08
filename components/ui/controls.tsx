"use client";
import { useCallback, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type KeyProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "accent" | "ion" | "ghost";
  size?: "sm" | "md" | "lg";
  led?: boolean | null;
  ledTone?: "accent" | "ion" | "ok";
  kbd?: string;
  pressed?: boolean;
};

/** A physical key: bevelled cap, 2.5px of travel, optional LED and keyboard hint. */
export function Key({ tone = "default", size = "md", led = null, ledTone = "accent", kbd, pressed, className = "", children, ...rest }: KeyProps) {
  const cls = ["key", tone !== "default" && `key-${tone}`, size !== "md" && `key-${size}`, className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} data-pressed={pressed ? "true" : undefined} aria-pressed={pressed} {...rest}>
      {led !== null && <span className="led" data-on={led ? "true" : "false"} data-tone={ledTone} />}
      {children}
      {kbd && <span className="ml-1 rounded border border-current/20 px-1 text-[9px] opacity-60">{kbd}</span>}
    </button>
  );
}

/** Recessed track with raised thumbs (segmented switch / rocker). */
export function Track<T extends string>({ value, options, onChange, label, className = "" }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; label?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="eyebrow">{label}</span>}
      <div className="track" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A detented rotary dial. Drag vertically, scroll, or use arrow keys.
 * Each detent "clicks" (a tiny scale pulse) the way a real encoder does.
 */
const rr = (n: number) => Math.round(n * 100) / 100;

export function Knob({ value, onChange, steps = 10, label, size = 64, format, tone = "accent" }: { value: number; onChange: (v: number) => void; steps?: number; label?: string; size?: number; format?: (v: number) => string; tone?: "accent" | "ion" }) {
  const [click, setClick] = useState(0);
  const drag = useRef<{ y: number; v: number } | null>(null);
  const snap = useCallback((v: number) => Math.round(Math.max(0, Math.min(1, v)) * steps) / steps, [steps]);
  const set = useCallback(
    (v: number) => {
      const s = snap(v);
      if (s !== value) {
        onChange(s);
        setClick((c) => c + 1);
      }
    },
    [snap, value, onChange],
  );
  const angle = -135 + value * 270;
  const r = size / 2;
  const ticks = Array.from({ length: steps + 1 }, (_, i) => -135 + (i / steps) * 270);
  const color = tone === "accent" ? "var(--accent)" : "var(--ion)";
  const arc = (a0: number, a1: number, rad: number) => {
    const p = (a: number) => [rr(r + rad * Math.cos(((a - 90) * Math.PI) / 180)), rr(r + rad * Math.sin(((a - 90) * Math.PI) / 180))];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className="relative cursor-ns-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--ion)]"
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, v: value };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          set(drag.current.v + (drag.current.y - e.clientY) / 160);
        }}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => set(value + (e.deltaY < 0 ? 1 : -1) / steps)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") set(value + 1 / steps);
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") set(value - 1 / steps);
        }}
      >
        <svg width={size} height={size} className="absolute inset-0 overflow-visible">
          {ticks.map((a, i) => {
            const on = i / steps <= value + 1e-6;
            const x0 = rr(r + (r - 1) * Math.cos(((a - 90) * Math.PI) / 180));
            const y0 = rr(r + (r - 1) * Math.sin(((a - 90) * Math.PI) / 180));
            const x1 = rr(r + (r - 6) * Math.cos(((a - 90) * Math.PI) / 180));
            const y1 = rr(r + (r - 6) * Math.sin(((a - 90) * Math.PI) / 180));
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={on ? color : "var(--ink-4)"} strokeWidth={i % 5 === 0 ? 1.6 : 1} strokeLinecap="round" />;
          })}
          <path d={arc(-135, 135, r - 9)} stroke="var(--line-2)" strokeWidth={2} fill="none" />
          {value > 0 && <path d={arc(-135, angle, r - 9)} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />}
        </svg>
        <div
          key={click}
          className="absolute rounded-full"
          style={{
            inset: 12,
            background: "radial-gradient(circle at 35% 30%, var(--key-top), var(--key-bot) 70%)",
            border: "1px solid var(--key-edge)",
            boxShadow: "inset 0 1px 0 var(--key-hi), 0 3px 0 -1px var(--key-edge), 0 6px 12px -4px var(--key-shadow)",
            transform: `rotate(${angle}deg)`,
            transition: "transform 90ms cubic-bezier(.3,1.6,.5,1)",
            animation: click ? "knobclick 110ms ease" : undefined,
          }}
        >
          <div className="absolute left-1/2 top-[5px] h-[30%] w-[2px] -translate-x-1/2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          {/* knurling */}
          <div className="absolute inset-[3px] rounded-full opacity-40" style={{ background: "repeating-conic-gradient(from 0deg, transparent 0 6deg, rgba(0,0,0,.25) 6deg 7deg)" }} />
        </div>
      </div>
      {label && (
        <div className="flex flex-col items-center leading-tight">
          <span className="eyebrow">{label}</span>
          <span className="mono tabular text-[11px] text-[var(--ink-2)]">{format ? format(value) : `${Math.round(value * 100)}%`}</span>
        </div>
      )}
      <style>{`@keyframes knobclick{0%{scale:1}40%{scale:.96}100%{scale:1}}`}</style>
    </div>
  );
}

export function Panel({ index, title, right, children, className = "", bodyClass = "" }: { index?: string; title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`plate flex min-w-0 flex-col ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {index && <span className="mono text-[10px] text-[var(--accent)]">{index}</span>}
            {title && <h2 className="eyebrow truncate !text-[var(--ink-2)]">{title}</h2>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={`min-w-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`screen ${className}`}>{children}</div>;
}

export function Readout({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "accent" | "ion" | "ok" | "warn" }) {
  const color = tone ? `var(--${tone})` : "var(--ink)";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="eyebrow truncate">{label}</span>
      <span className="mono tabular truncate text-[15px]" style={{ color }}>
        {value}
      </span>
      {sub && <span className="mono truncate text-[10px] text-[var(--ink-3)]">{sub}</span>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="led pulse" data-on="true" data-tone="ion" />
      {label && <span className="eyebrow">{label}</span>}
    </span>
  );
}
