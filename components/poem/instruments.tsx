"use client";
import { FAMILY_COLORS, useT } from "@/lib/client/hooks";
import type { Analysis, Signature } from "@/lib/prosody/types";
import type { DictKey } from "@/lib/i18n";

const DIMS: (keyof Signature)[] = ["sound", "measure", "shape", "image", "voice"];

/** The 5D signature as a machined radar. Optional ghost = a second signature to compare. */
export function Pentagon({ sig, ghost, size = 180, label = true }: { sig: Signature; ghost?: Signature | null; size?: number; label?: boolean }) {
  const t = useT();
  const r = size / 2 - (label ? 26 : 6);
  const c = size / 2;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [Math.round((c + Math.cos(a) * r * v) * 100) / 100, Math.round((c + Math.sin(a) * r * v) * 100) / 100] as const;
  };
  const poly = (s: Signature) => DIMS.map((d, i) => pt(i, Math.max(0.04, s[d])).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={DIMS.map((_, i) => pt(i, k).join(",")).join(" ")} fill="none" stroke="var(--line-2)" strokeWidth={k === 1 ? 1 : 0.6} />
      ))}
      {DIMS.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" />;
      })}
      {ghost && <polygon points={poly(ghost)} fill="var(--ion-soft)" stroke="var(--ion)" strokeWidth={1} strokeDasharray="3 3" />}
      <polygon points={poly(sig)} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.4} style={{ filter: "drop-shadow(0 0 6px var(--accent-soft))", transition: "all 400ms" }} />
      {DIMS.map((d, i) => {
        const [x, y] = pt(i, Math.max(0.04, sig[d]));
        return <circle key={d} cx={x} cy={y} r={2.4} fill="var(--accent)" />;
      })}
      {label &&
        DIMS.map((d, i) => {
          const [x, y] = pt(i, 1.24);
          return (
            <g key={d}>
              <text x={x} y={y - 4} textAnchor="middle" className="mono" fontSize={9} letterSpacing="0.12em" fill="var(--ink-3)">
                {t(`d.${d}` as DictKey).toUpperCase()}
              </text>
              <text x={x} y={y + 8} textAnchor="middle" className="mono" fontSize={10} fill="var(--ink)">
                {Math.round(sig[d] * 100)}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

/** Syllables per line as bars, with the dominant count as a reference rail. */
export function MeterGauge({ a, height = 64 }: { a: Analysis; height?: number }) {
  const real = a.lines.filter((l) => l.words.length);
  const max = Math.max(...real.map((l) => l.count), a.meter.syllables ?? 0, 1);
  const w = Math.max(3, Math.min(14, 260 / Math.max(1, real.length)));
  const ref = a.meter.syllables ?? 0;
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {real.map((l) => {
        const h = (l.count / max) * (height - 6);
        const off = l.count !== ref;
        const dev = l.meter?.deviations.length ?? 0;
        return (
          <div key={l.index} className="group relative flex flex-col items-center" style={{ width: w }} title={`${l.index + 1}: ${l.count}σ ${l.meter?.template ?? ""}`}>
            <div className="w-full rounded-[2px] transition-all" style={{ height: h, background: off ? "var(--warn)" : dev > 1 ? "color-mix(in oklab, var(--accent) 55%, var(--ink-3))" : "var(--accent)", opacity: off ? 0.75 : 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }} />
          </div>
        );
      })}
      {ref > 0 && <div className="pointer-events-none absolute" />}
    </div>
  );
}

export function FlowStats({ a, compact = false }: { a: Analysis; compact?: boolean }) {
  const t = useT();
  const f = a.flow;
  const items: [string, string][] = [
    [t("lab.density"), `${Math.round(f.density * 100)}%`],
    [t("lab.multis"), String(f.multis)],
    [t("lab.mosaic"), String(f.mosaic)],
    [t("lab.chains"), String(f.chains)],
    [t("lab.perbar"), f.syllablesPerBar.toFixed(1)],
  ];
  const top = [...f.families].filter((x) => x.len >= 2).sort((x, y) => y.members.length * y.len - x.members.length * x.len).slice(0, compact ? 3 : 6);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2">
        {items.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <span className="mono tabular text-[15px] text-[var(--ink)]">{v}</span>
            <span className="eyebrow !text-[9px]">{k}</span>
          </div>
        ))}
      </div>
      {top.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {top.map((fam) => (
            <div key={fam.id} className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: FAMILY_COLORS[fam.id % FAMILY_COLORS.length] }} />
              <span className="mono text-[10px] text-[var(--ink-3)]">{fam.len}σ</span>
              {fam.members.slice(0, compact ? 3 : 5).map((m, i) => (
                <span key={i} className="fam verse italic" style={{ ["--fam" as string]: FAMILY_COLORS[fam.id % FAMILY_COLORS.length] }}>
                  {m.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
