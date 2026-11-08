"use client";
import { defineRegistry, JSONUIProvider, Renderer, useUIStream } from "@json-render/react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { NODES } from "@/lib/atlas/nodes";
import type { Lang } from "@/lib/atlas/types";
import { lensCatalog } from "@/lib/genui/catalog";
import { useT, useUiLang } from "@/lib/client/hooks";
import type { Analysis } from "@/lib/prosody/types";
import { FlowStats, MeterGauge, Pentagon } from "@/components/poem/instruments";
import { PoemView, type ViewMode } from "@/components/poem/PoemView";
import { Glyph, KIND_COLOR } from "@/components/atlas/AtlasGraph";
import { Key, Spinner } from "@/components/ui/controls";

export interface LensActions {
  atlas: (id: string) => void;
  transpose: (lang: Lang, register: string) => void;
  remix: (op: string) => void;
  loom: (seed: string, form?: string | null) => void;
}

const Ctx = createContext<{ a: Analysis; act: LensActions; ui: Lang } | null>(null);
const useLens = () => useContext(Ctx)!;

const TONE: Record<string, string> = { observe: "var(--ink-3)", praise: "var(--ok)", warn: "var(--warn)", dare: "var(--accent)" };

function NodeChip({ id }: { id: string }) {
  const { act, ui } = useLens();
  const n = NODES.find((x) => x.id === id);
  if (!n) return <span className="chip">{id}</span>;
  return (
    <button type="button" onClick={() => act.atlas(n.id)} className="chip hover:!border-[var(--ion)] hover:!text-[var(--ion)]">
      <svg width="12" height="12" viewBox="-7 -7 14 14">
        <Glyph kind={n.kind} r={4} color={KIND_COLOR[n.kind]} />
      </svg>
      {n.label[ui]}
    </button>
  );
}

const { registry } = defineRegistry(lensCatalog, {
  components: {
    Spread: ({ props, children }) => (
      <article className="lens flex flex-col gap-5">
        <header className="flex flex-col gap-1.5 border-b border-[var(--line)] pb-4">
          {props.kicker && <span className="eyebrow !text-[var(--accent)]">{props.kicker}</span>}
          <h2 className="verse text-[28px] leading-[1.1] tracking-[-0.01em] md:text-[34px]">{props.title}</h2>
        </header>
        <div className={`grid gap-5 ${props.columns === "3" ? "lg:grid-cols-3" : props.columns === "1" ? "" : "lg:grid-cols-2"}`}>{children}</div>
      </article>
    ),
    Section: ({ props, children }) => (
      <section className="rise flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-2)]/60 p-4">
        <h3 className="flex items-baseline gap-2">
          {props.index && <span className="mono text-[10px] text-[var(--accent)]">{props.index}</span>}
          <span className="eyebrow !text-[var(--ink-2)]">{props.title}</span>
        </h3>
        <div className="flex flex-col gap-3">{children}</div>
      </section>
    ),
    Margin: ({ props }) => (
      <p className="rise border-l-2 pl-3 text-[14.5px] leading-relaxed text-[var(--ink)]" style={{ borderColor: TONE[props.tone ?? "observe"] }}>
        {props.text}
      </p>
    ),
    Lines: ({ props }) => {
      const { a } = useLens();
      return (
        <div className="rise screen overflow-x-auto p-3">
          <PoemView a={a} mode={(props.mode ?? "text") as ViewMode} from={props.from} to={props.to} compact />
          {props.caption && <p className="mono mt-2 text-[10px] text-[var(--ink-3)]">{props.caption}</p>}
        </div>
      );
    },
    Device: ({ props }) => (
      <div className="rise flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <NodeChip id={props.node} />
          {props.lines.length > 0 && <span className="mono text-[10px] text-[var(--ink-3)]">L{props.lines.join(" · ")}</span>}
        </div>
        <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">{props.note}</p>
      </div>
    ),
    Lineage: ({ props }) => (
      <div className="rise flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {props.nodes.map((id, i) => (
            <span key={id + i} className="flex items-center gap-1.5">
              {i > 0 && <span className="mono text-[var(--ink-4)]">→</span>}
              <NodeChip id={id} />
            </span>
          ))}
        </div>
        {props.caption && <p className="text-[13px] text-[var(--ink-3)]">{props.caption}</p>}
      </div>
    ),
    Meter: ({ props }) => {
      const { a } = useLens();
      return (
        <div className="rise screen relative p-3">
          <MeterGauge a={a} height={54} />
          {props.caption && <p className="mono mt-2 text-[10px] text-[var(--ink-3)]">{props.caption}</p>}
        </div>
      );
    },
    Pentagon: ({ props }) => {
      const { a } = useLens();
      return (
        <div className="rise flex flex-col items-center gap-1">
          <Pentagon sig={a.signature} size={190} />
          {props.caption && <p className="text-center text-[12.5px] text-[var(--ink-3)]">{props.caption}</p>}
        </div>
      );
    },
    FlowMap: ({ props }) => {
      const { a } = useLens();
      return (
        <div className="rise screen p-3">
          <FlowStats a={a} compact />
          {props.caption && <p className="mono mt-2 text-[10px] text-[var(--ink-3)]">{props.caption}</p>}
        </div>
      );
    },
    Quote: ({ props }) => (
      <blockquote className="rise border-l border-[var(--line-3)] pl-3">
        <p className="verse whitespace-pre-line text-[16px] italic leading-snug">{props.text}</p>
        <cite className="mono mt-1 block text-[10px] not-italic text-[var(--ink-3)]">— {props.source}</cite>
      </blockquote>
    ),
    Compare: ({ props }) => (
      <div className="rise grid grid-cols-2 gap-2">
        {[
          [props.leftLabel, props.left],
          [props.rightLabel, props.right],
        ].map(([l, v], i) => (
          <div key={i} className="screen p-2.5">
            <span className="eyebrow">{l}</span>
            <p className="verse mt-1 text-[15px] leading-snug">{v}</p>
          </div>
        ))}
      </div>
    ),
    Exercise: ({ props }) => {
      const { act } = useLens();
      return (
        <div className="rise flex flex-col gap-2 rounded-lg border border-dashed border-[var(--line-3)] p-3">
          <span className="eyebrow !text-[var(--ion)]">✎ {props.title}</span>
          <p className="text-[14px] leading-relaxed">{props.prompt}</p>
          <div>
            <Key size="sm" tone="ion" onClick={() => act.loom(props.prompt, props.form)}>
              Loom →
            </Key>
          </div>
        </div>
      );
    },
    Fork: ({ props }) => {
      const { act } = useLens();
      return (
        <div className="rise flex flex-col gap-2.5">
          <p className="verse text-[18px] italic">{props.question}</p>
          <div className="flex flex-wrap gap-2">
            {props.options.map((o, i) => (
              <Key
                key={i}
                size="sm"
                tone={i === 0 ? "accent" : "default"}
                onClick={() => {
                  if (o.op === "transpose") {
                    const [l, r] = o.arg.split("|");
                    act.transpose((["en", "fr", "cs"].includes(l) ? l : "cs") as Lang, r ?? "plain");
                  } else if (o.op === "remix") act.remix(o.arg);
                  else if (o.op === "atlas") act.atlas(o.arg);
                  else act.loom(o.arg);
                }}
              >
                {o.label}
              </Key>
            ))}
          </div>
        </div>
      );
    },
  },
});

/** The Lens: a reading composed live by the model (or its deterministic twin) from the glyph catalog. */
export function Lens({ a, text, lang, title, author, ask, run, act, onState }: { a: Analysis; text: string; lang: Lang | "auto"; title?: string; author?: string; ask?: string; run: number; act: LensActions; onState?: (s: { streaming: boolean }) => void }) {
  const ui = useUiLang();
  const t = useT();
  const { spec, isStreaming, error, send } = useUIStream({ api: "/api/lens" });
  // Latest inputs, read when a run is requested (typing in the ask field must not trigger a run).
  const latest = useRef({ ask, text, lang, ui, title, author });
  useEffect(() => {
    latest.current = { ask, text, lang, ui, title, author };
  });
  // The hook aborts its request on unmount, so a remount (StrictMode, Activity) must be free to resend.
  useEffect(() => {
    if (!run) return;
    const c = latest.current;
    void send(c.ask ?? "", { text: c.text, lang: c.lang, ui: c.ui, title: c.title, author: c.author });
  }, [run, send]);
  useEffect(() => onState?.({ streaming: isStreaming }), [isStreaming, onState]);
  let body: ReactNode = null;
  if (error) body = <p className="text-[var(--bad)]">{t("common.error")}: {error.message}</p>;
  else if (spec?.root)
    body = (
      <JSONUIProvider registry={registry}>
        <Renderer spec={spec} registry={registry} loading={isStreaming} />
      </JSONUIProvider>
    );
  return (
    <Ctx.Provider value={{ a, act, ui }}>
      <div className="flex flex-col gap-3">
        {isStreaming && (
          <div className="scanline rounded-md border border-[var(--line)] px-3 py-2">
            <Spinner label={t("common.working")} />
          </div>
        )}
        {body}
      </div>
    </Ctx.Provider>
  );
}
