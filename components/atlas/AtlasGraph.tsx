"use client";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";
import { NODES } from "@/lib/atlas/nodes";
import type { AtlasNode, Lang, NodeKind } from "@/lib/atlas/types";

interface SimNode extends SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  deg: number;
}

export const KIND_COLOR: Record<NodeKind, string> = {
  form: "#ff8a5b",
  meter: "#7fd1c7",
  device: "#c9c4b8",
  movement: "#f2c14e",
  poet: "#efe6d4",
  concept: "#b39dfa",
  constraint: "#ff7eb6",
};

const KIND_ANCHOR: Record<NodeKind, number> = { form: 0, meter: 1, device: 2, concept: 3, constraint: 4, movement: 5, poet: 6 };

/** Round SVG coordinates: server and browser trig differ in the last digits (hydration). */
const rd = (n: number) => Math.round(n * 100) / 100;

export function Glyph({ kind, r, color, lit }: { kind: NodeKind; r: number; color: string; lit?: boolean }) {
  const s = r;
  const common = { fill: lit ? color : "var(--bg-2)", stroke: color, strokeWidth: lit ? 1.6 : 1.1 };
  switch (kind) {
    case "form":
      return <rect x={-s} y={-s} width={s * 2} height={s * 2} rx={1.5} {...common} />;
    case "meter":
      return <polygon points={`0,${rd(-s * 1.2)} ${rd(s * 1.1)},${rd(s * 0.8)} ${rd(-s * 1.1)},${rd(s * 0.8)}`} {...common} />;
    case "movement":
      return <polygon points={Array.from({ length: 6 }, (_, i) => `${rd(Math.cos((i * Math.PI) / 3) * s * 1.15)},${rd(Math.sin((i * Math.PI) / 3) * s * 1.15)}`).join(" ")} {...common} />;
    case "concept":
      return <polygon points={`0,${rd(-s * 1.25)} ${rd(s * 1.25)},0 0,${rd(s * 1.25)} ${rd(-s * 1.25)},0`} {...common} />;
    case "constraint":
      return (
        <g {...common}>
          <rect x={-s} y={-s * 0.38} width={s * 2} height={s * 0.76} />
          <rect x={-s * 0.38} y={-s} width={s * 0.76} height={s * 2} />
        </g>
      );
    case "poet":
      return (
        <g>
          <circle r={s * 1.15} fill="none" stroke={color} strokeWidth={0.8} opacity={0.6} />
          <circle r={s * 0.62} fill={color} />
        </g>
      );
    default:
      return <circle r={s} {...common} />;
  }
}


function computeLayout(simNodes: SimNode[], links: (SimulationLinkDatum<SimNode> & { a: string; b: string })[]): Map<string, { x: number; y: number }> {
    const R = 300;
    let seed = 1337;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const anchor = (k: NodeKind) => {
      const a = (KIND_ANCHOR[k] / 7) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * R, y: Math.sin(a) * R * 0.8 };
    };
    const nodesCopy = simNodes.map((n) => ({ ...n, x: anchor(n.kind).x + (rand() - 0.5) * 40, y: anchor(n.kind).y + (rand() - 0.5) * 40 }));
    const sim = forceSimulation(nodesCopy)
      .force("link", forceLink(links.map((l) => ({ ...l }))).id((d) => (d as SimNode).id).distance(46).strength(0.18))
      .force("charge", forceManyBody().strength(-95))
      .force("x", forceX<SimNode>((d) => anchor(d.kind).x).strength(0.075))
      .force("y", forceY<SimNode>((d) => anchor(d.kind).y).strength(0.075))
      .force("collide", forceCollide<SimNode>((d) => 9 + Math.min(10, d.deg)))
      .stop();
    for (let i = 0; i < 320; i++) sim.tick();
    return new Map(nodesCopy.map((n) => [n.id, { x: Math.round((n.x ?? 0) * 10) / 10, y: Math.round((n.y ?? 0) * 10) / 10 }]));
  }

export interface AtlasGraphProps {
  lang: Lang;
  lit?: string[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  kinds?: Set<NodeKind> | null;
  query?: string;
  ambient?: boolean;
  className?: string;
  nodes?: AtlasNode[];
}

export function AtlasGraph({ lang, lit = [], selected = null, onSelect, kinds = null, query = "", ambient = false, className = "", nodes = NODES }: AtlasGraphProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const { simNodes, links, byId, neighbours } = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    const linkSet = new Set<string>();
    const links: (SimulationLinkDatum<SimNode> & { a: string; b: string })[] = [];
    const deg = new Map<string, number>();
    for (const n of nodes)
      for (const l of n.links) {
        if (!ids.has(l) || l === n.id) continue;
        const key = [n.id, l].sort().join("|");
        if (linkSet.has(key)) continue;
        linkSet.add(key);
        links.push({ source: n.id, target: l, a: n.id, b: l });
        deg.set(n.id, (deg.get(n.id) ?? 0) + 1);
        deg.set(l, (deg.get(l) ?? 0) + 1);
      }
    const simNodes: SimNode[] = nodes.map((n) => ({ id: n.id, kind: n.kind, deg: deg.get(n.id) ?? 0 }));
    const neighbours = new Map<string, Set<string>>();
    links.forEach((l) => {
      neighbours.set(l.a, (neighbours.get(l.a) ?? new Set()).add(l.b));
      neighbours.set(l.b, (neighbours.get(l.b) ?? new Set()).add(l.a));
    });
    return { simNodes, links, byId: new Map(nodes.map((n) => [n.id, n])), neighbours };
  }, [nodes]);

  // Size
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Settled once per node set in a fixed space, with seeded jitter: composed, never exploding, identical on every visit.
  const pos = useMemo(() => computeLayout(simNodes, links), [simNodes, links]);
  const fit = Math.min(size.w / 900, size.h / 680);


  const litSet = useMemo(() => new Set(lit), [lit]);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    return new Set(nodes.filter((n) => n.id.includes(q) || Object.values(n.label).some((l) => l.toLowerCase().includes(q))).map((n) => n.id));
  }, [q, nodes]);
  const focus = hover ?? selected;
  const focusSet = focus ? new Set([focus, ...(neighbours.get(focus) ?? [])]) : null;

  const visible = (id: string) => !kinds || kinds.has(byId.get(id)!.kind);
  const project = (p: { x: number; y: number }) => ({ x: rd(size.w / 2 + (p.x * fit + view.x) * view.k), y: rd(size.h / 2 + (p.y * fit + view.y) * view.k) });

  return (
    <svg
      ref={ref}
      className={`h-full w-full touch-none select-none ${ambient ? "" : "cursor-grab active:cursor-grabbing"} ${className}`}
      onWheel={(e) => {
        if (ambient) return;
        const k = Math.max(0.4, Math.min(3.2, view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
        setView((v) => ({ ...v, k }));
      }}
      onPointerDown={(e) => {
        if (ambient || (e.target as Element).closest("[data-node]")) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      }}
      onPointerMove={(e) => {
        if (!pan.current) return;
        const p = pan.current;
        setView((v) => ({ ...v, x: p.vx + (e.clientX - p.x) / v.k, y: p.vy + (e.clientY - p.y) / v.k }));
      }}
      onPointerUp={() => (pan.current = null)}
    >
      <defs>
        <radialGradient id="litglow">
          <stop offset="0%" stopColor="var(--ion)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--ion)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className={ambient ? "atlas-drift" : ""} style={ambient ? { transformOrigin: `${size.w / 2}px ${size.h / 2}px` } : undefined}>
      <g>
        {links.map((l, i) => {
          if (!visible(l.a) || !visible(l.b)) return null;
          const a = pos.get(l.a);
          const b = pos.get(l.b);
          if (!a || !b) return null;
          const pa = project(a);
          const pb = project(b);
          const hot = focusSet && focusSet.has(l.a) && focusSet.has(l.b) && (l.a === focus || l.b === focus);
          const litLink = litSet.has(l.a) && litSet.has(l.b);
          return (
            <line
              key={i}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={hot ? "var(--accent)" : litLink ? "var(--ion)" : "var(--line-3)"}
              strokeWidth={hot ? 1.3 : litLink ? 1.1 : 0.6}
              opacity={focusSet ? (hot ? 0.95 : 0.12) : ambient ? 0.35 : litLink ? 0.8 : 0.5}
            />
          );
        })}
      </g>
      <g>
        {nodes.map((n) => {
          if (!visible(n.id)) return null;
          const p0 = pos.get(n.id);
          if (!p0) return null;
          const p = project(p0);
          const isLit = litSet.has(n.id);
          const isSel = selected === n.id;
          const dim = (focusSet && !focusSet.has(n.id)) || (matches && !matches.has(n.id));
          const deg = neighbours.get(n.id)?.size ?? 0;
          const r = rd(3.2 + Math.min(4.5, deg * 0.42));
          const color = KIND_COLOR[n.kind];
          const showLabel = !ambient && (isSel || hover === n.id || isLit || (matches?.has(n.id) ?? false) || deg >= 9 || view.k > 1.6 || (focusSet?.has(n.id) ?? false));
          return (
            <g
              key={n.id}
              data-node={n.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={dim ? 0.18 : ambient ? (isLit ? 1 : 0.55) : 1}
              className={onSelect && !ambient ? "cursor-pointer" : ""}
              onPointerEnter={() => !ambient && setHover(n.id)}
              onPointerLeave={() => !ambient && setHover(null)}
              onClick={() => onSelect?.(n.id)}
              style={{ transition: "opacity 200ms" }}
            >
              {isLit && <circle r={r * 4.2} fill="url(#litglow)" className="pulse" />}
              {isSel && <circle r={r * 2.2} fill="none" stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="2 3" />}
              <Glyph kind={n.kind} r={r} color={isLit ? "var(--ion)" : color} lit={isLit || isSel} />
              {showLabel && (
                <text x={r + 5} y={3.5} fontSize={isSel ? 12 : 10.5} className={n.kind === "poet" ? "verse" : ""} fill={isLit ? "var(--ion)" : isSel ? "var(--ink)" : "var(--ink-2)"} style={{ paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: 3, fontStyle: n.kind === "poet" ? "italic" : undefined, fontFamily: n.kind === "poet" ? "var(--font-verse)" : "var(--font-sans)" }}>
                  {n.label[lang]}
                </text>
              )}
            </g>
          );
        })}
      </g>
      </g>
      <style>{`@keyframes atlasdrift{from{transform:rotate(0deg) scale(1.04)}to{transform:rotate(360deg) scale(1.04)}}.atlas-drift{animation:atlasdrift 420s linear infinite}@media (prefers-reduced-motion: reduce){.atlas-drift{animation:none}}`}</style>
    </svg>
  );
}
