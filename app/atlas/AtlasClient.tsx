"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { NODES } from "@/lib/atlas/nodes";
import type { Lang, NodeKind } from "@/lib/atlas/types";
import { useT, useUiLang } from "@/lib/client/hooks";
import { useMoves } from "@/lib/client/moves";
import type { DictKey } from "@/lib/i18n";
import { AtlasGraph, Glyph, KIND_COLOR } from "@/components/atlas/AtlasGraph";
import { Key, Screen } from "@/components/ui/controls";

const KINDS: NodeKind[] = ["form", "meter", "device", "movement", "poet", "concept", "constraint"];

export default function AtlasClient() {
  const t = useT();
  const ui = useUiLang();
  const params = useSearchParams();
  const router = useRouter();
  const moves = useMoves();
  const sel = params.get("n");
  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState<Set<NodeKind> | null>(null);
  const [langF, setLangF] = useState<Lang | "all">("all");

  const node = sel ? NODES.find((n) => n.id === sel) : null;
  const nodes = useMemo(() => (langF === "all" ? NODES : NODES.filter((n) => !n.langs || n.langs.includes(langF))), [langF]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, nodes.filter((n) => n.kind === k).length])), [nodes]);
  const results = q.trim() ? NODES.filter((n) => n.id.includes(q.toLowerCase()) || Object.values(n.label).some((l) => l.toLowerCase().includes(q.toLowerCase()))).slice(0, 8) : [];

  const select = (id: string | null) => router.replace(id ? `/atlas?n=${id}` : "/atlas", { scroll: false });

  return (
    <div className="relative h-[calc(100dvh-64px)] md:h-dvh">
      <div className="absolute inset-0">
        <AtlasGraph lang={ui} selected={sel} onSelect={select} kinds={kinds} query={q} nodes={nodes} />
      </div>

      {/* Console */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-3 md:p-6">
        <div className="pointer-events-auto flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">
              <span className="text-[var(--accent)]">05</span> / {t("nav.atlas")} · {NODES.length}
            </span>
            <h1 className="verse text-[30px] leading-none md:text-[38px]">{{ en: "The semantic net", fr: "Le réseau sémantique", cs: "Sémantická síť" }[ui]}</h1>
          </div>
          <div className="relative w-full max-w-[360px]">
            <input className="field" placeholder={t("atlas.search")} value={q} onChange={(e) => setQ(e.target.value)} />
            {results.length > 0 && (
              <div className="plate absolute inset-x-0 top-[46px] z-10 flex flex-col p-1">
                {results.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--bg-3)]"
                    onClick={() => {
                      select(n.id);
                      setQ("");
                    }}
                  >
                    <svg width="12" height="12" viewBox="-7 -7 14 14">
                      <Glyph kind={n.kind} r={4} color={KIND_COLOR[n.kind]} />
                    </svg>
                    {n.label[ui]}
                    <span className="mono ml-auto text-[9px] text-[var(--ink-3)]">{n.kind}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          <Key size="sm" pressed={!kinds} onClick={() => setKinds(null)}>
            {t("atlas.all")}
          </Key>
          {KINDS.map((k) => {
            const on = !kinds || kinds.has(k);
            return (
              <Key
                key={k}
                size="sm"
                led={kinds ? kinds.has(k) : null}
                onClick={() => {
                  const next = new Set(kinds ?? []);
                  if (kinds && next.has(k)) next.delete(k);
                  else next.add(k);
                  setKinds(next.size ? next : null);
                }}
                style={{ opacity: on ? 1 : 0.6 }}
              >
                <svg width="11" height="11" viewBox="-7 -7 14 14">
                  <Glyph kind={k} r={4} color={KIND_COLOR[k]} />
                </svg>
                {t(`kind.${k}` as DictKey)} <span className="opacity-50">{counts[k]}</span>
              </Key>
            );
          })}
          <span className="track ml-1">
            {(["all", "en", "fr", "cs"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={langF === l} onClick={() => setLangF(l)}>
                {l === "all" ? "∀" : l}
              </button>
            ))}
          </span>
        </div>
      </div>

      {/* Drawer */}
      {node && (
        <aside className="plate rise absolute inset-x-2 bottom-2 z-20 flex max-h-[62vh] flex-col overflow-hidden md:inset-x-auto md:bottom-6 md:right-6 md:top-[150px] md:max-h-none md:w-[420px]">
          <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="eyebrow flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="-7 -7 14 14">
                  <Glyph kind={node.kind} r={4} color={KIND_COLOR[node.kind]} />
                </svg>
                {t(`kind.${node.kind}` as DictKey)}
                {node.era && (
                  <span className="text-[var(--ink-2)]">
                    · {node.era[0]}
                    {node.era[1] ? `–${node.era[1]}` : ""}
                  </span>
                )}
                {node.langs && <span>· {node.langs.join(" ")}</span>}
              </span>
              <h2 className={`${node.kind === "poet" ? "verse italic" : "verse"} text-[28px] leading-tight`}>{node.label[ui]}</h2>
              <span className="mono text-[10px] text-[var(--ink-3)]">{(["en", "fr", "cs"] as Lang[]).filter((l) => l !== ui).map((l) => node.label[l]).join(" · ")}</span>
            </div>
            <Key size="sm" tone="ghost" onClick={() => select(null)}>
              ×
            </Key>
          </header>
          <div className="flex flex-col gap-4 overflow-auto p-4">
            <p className="text-[15px] leading-relaxed">{node.gloss[ui]}</p>
            {node.example && (
              <Screen className="p-3">
                <span className="eyebrow">{t("atlas.example")}</span>
                <p className="verse mt-1.5 whitespace-pre-line text-[16px] italic leading-snug">{node.example.text}</p>
                <span className="mono mt-1.5 block text-[10px] text-[var(--ink-3)]">— {node.example.source}</span>
              </Screen>
            )}
            {node.exercise && (
              <div className="rounded-lg border border-dashed border-[var(--line-3)] p-3">
                <span className="eyebrow !text-[var(--ion)]">✎</span>
                <p className="mt-1 text-[14px]">{node.exercise[ui]}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {node.exercise && (
                <Key size="sm" tone="accent" onClick={() => moves.toLoom({ subject: node.exercise![ui], form: node.engine?.startsWith("form:") ? node.engine : undefined })}>
                  {t("atlas.try")}
                </Key>
              )}
              {node.example && (
                <Key size="sm" onClick={() => moves.toLab(node.example!.text, node.example!.lang, { title: node.label[ui], author: node.example!.source })}>
                  {t("atlas.teach")}
                </Key>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">{t("atlas.links")}</span>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set([...node.links, ...NODES.filter((n) => n.links.includes(node.id)).map((n) => n.id)])]
                  .map((id) => NODES.find((n) => n.id === id))
                  .filter(Boolean)
                  .map((n) => (
                    <button key={n!.id} type="button" className="chip hover:!text-[var(--ink)]" onClick={() => select(n!.id)}>
                      <svg width="10" height="10" viewBox="-7 -7 14 14">
                        <Glyph kind={n!.kind} r={4} color={KIND_COLOR[n!.kind]} />
                      </svg>
                      {n!.label[ui]}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
