"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NODES } from "@/lib/atlas/nodes";
import type { Lang } from "@/lib/atlas/types";
import { poemById } from "@/lib/corpus/poems";
import { useAnalysis, useT, useUiLang } from "@/lib/client/hooks";
import { download, formLabel, useMoves } from "@/lib/client/moves";
import { patch, useVerso } from "@/lib/client/store";
import { describeSkeleton } from "@/lib/prosody/skeleton";
import { Key, Panel, Readout, Screen, Spinner, Track } from "@/components/ui/controls";
import { FlowStats, MeterGauge, Pentagon } from "@/components/poem/instruments";
import { PoemView, type ViewMode } from "@/components/poem/PoemView";
import { Lens } from "@/components/genui/Lens";
import { BabelCard } from "@/components/poem/BabelCard";
import { Glyph, KIND_COLOR } from "@/components/atlas/AtlasGraph";

const FOOT_LABEL: Record<string, Record<Lang, string>> = {
  iamb: { en: "iamb", fr: "iambe", cs: "jamb" },
  trochee: { en: "trochee", fr: "trochée", cs: "trochej" },
  anapest: { en: "anapest", fr: "anapeste", cs: "anapest" },
  dactyl: { en: "dactyl", fr: "dactyle", cs: "daktyl" },
  amphibrach: { en: "amphibrach", fr: "amphibraque", cs: "amfibrach" },
};
const KIND_LABEL: Record<string, Record<Lang, string>> = {
  syllabic: { en: "syllabic", fr: "syllabique", cs: "sylabický" },
  accentual: { en: "accentual", fr: "accentuel", cs: "přízvučný" },
  free: { en: "free verse", fr: "vers libre", cs: "volný verš" },
};

const REMIXES = ["reverse", "mirror", "erasure", "cento", "compress", "explode", "invert", "answer"] as const;
const REMIX_LABEL: Record<string, Record<Lang, string>> = {
  reverse: { en: "Reverse", fr: "Renverser", cs: "Obrátit" },
  mirror: { en: "Mirror", fr: "Miroir", cs: "Zrcadlo" },
  erasure: { en: "Erasure", fr: "Caviardage", cs: "Výmaz" },
  cento: { en: "Cento", fr: "Centon", cs: "Centon" },
  compress: { en: "Compress", fr: "Compresser", cs: "Zhustit" },
  explode: { en: "Explode", fr: "Éclater", cs: "Rozložit" },
  invert: { en: "Invert register", fr: "Inverser le registre", cs: "Obrátit rejstřík" },
  answer: { en: "Answer it", fr: "Lui répondre", cs: "Odpovědět" },
};

export default function LabClient() {
  const t = useT();
  const ui = useUiLang();
  const params = useSearchParams();
  const lab = useVerso((s) => s.lab);
  const moves = useMoves();
  const [mode, setMode] = useState<ViewMode>("scansion");
  const [word, setWord] = useState<string | null>(null);
  const [lensRun, setLensRun] = useState(0);
  const [ask, setAsk] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [remixNote, setRemixNote] = useState<string | null>(null);
  const [remixBusy, setRemixBusy] = useState<string | null>(null);

  // ?p=poem-id loads a library poem
  useEffect(() => {
    const id = params.get("p");
    if (!id) return;
    const p = poemById(id);
    if (p) patch.lab({ text: p.text, lang: p.lang, title: p.title, author: p.author });
  }, [params]);

  const { data, busy } = useAnalysis(lab.text, lab.lang, { title: lab.title, author: lab.author });
  const a = data?.analysis;
  const litNodes = useMemo(() => (data?.lit ?? []).map((id) => NODES.find((n) => n.id === id)).filter(Boolean), [data]);

  const remix = useCallback(
    async (op: string) => {
      if (!lab.text.trim()) return;
      setRemixBusy(op);
      setRemixNote(null);
      try {
        const r = await fetch("/api/remix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: lab.text, lang: a?.lang ?? lab.lang, op, seed: Date.now() % 9973 }) });
        const j = (await r.json()) as { text?: string; note?: string; error?: string };
        if (j.text) {
          setHistory((h) => [...h, lab.text].slice(-20));
          patch.lab({ text: j.text, title: lab.title ? `${lab.title} (${REMIX_LABEL[op]?.[ui] ?? op})` : undefined });
          setRemixNote(j.note ?? null);
        } else setRemixNote(j.error ?? "—");
      } finally {
        setRemixBusy(null);
      }
    },
    [lab, a, ui],
  );

  const meterText = a
    ? a.meter.kind === "accentual-syllabic" && a.meter.foot
      ? `${FOOT_LABEL[a.meter.foot][ui]} ×${a.meter.feet}${a.meter.alt ? ` ${t("lab.ambiguous")} ${FOOT_LABEL[a.meter.alt][ui]}` : ""}`
      : `${KIND_LABEL[a.meter.kind]?.[ui] ?? a.meter.kind}${a.meter.kind === "syllabic" ? ` · ${a.meter.syllables}σ` : ""}`
    : "—";

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="eyebrow">
            <span className="text-[var(--accent)]">02</span> / {t("nav.lab")}
          </span>
          <h1 className="verse truncate text-[30px] leading-none md:text-[38px]">{lab.title ?? (a ? formLabel(a.form.key, ui) : t("nav.lab"))}</h1>
          {lab.author && <span className="mono text-[11px] text-[var(--ink-3)]">{lab.author}</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Track
            label={t("lab.lang")}
            value={lab.lang}
            onChange={(v) => patch.lab({ lang: v })}
            options={[
              { value: "auto", label: t("lab.auto") + (a && lab.lang === "auto" ? ` · ${a.lang}` : "") },
              { value: "en", label: "EN" },
              { value: "fr", label: "FR" },
              { value: "cs", label: "CS" },
            ]}
          />
          <Track
            label="View"
            value={mode}
            onChange={setMode}
            options={[
              { value: "text", label: t("lab.view.text") },
              { value: "scansion", label: t("lab.view.scansion") },
              { value: "flow", label: t("lab.view.flow") },
              { value: "sound", label: t("lab.view.sound") },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,330px)_minmax(0,1fr)_minmax(300px,360px)]">
        {/* Source */}
        <Panel index="A" title={t("lab.source")} right={busy ? <Spinner /> : <span className="mono text-[10px] text-[var(--ink-3)]">{a ? `${a.stats.lines}L · ${a.stats.syllables}σ` : ""}</span>}>
          <div className="flex h-full flex-col gap-2 p-3">
            <textarea
              value={lab.text}
              onChange={(e) => patch.lab({ text: e.target.value })}
              placeholder={t("lab.paste")}
              spellCheck={false}
              className="field verse min-h-[260px] flex-1 resize-y text-[15.5px] leading-[1.55] lg:min-h-[480px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input className="field !py-1.5 text-[12px]" placeholder="Title" value={lab.title ?? ""} onChange={(e) => patch.lab({ title: e.target.value || undefined })} />
              <input className="field !py-1.5 text-[12px]" placeholder="Author" value={lab.author ?? ""} onChange={(e) => patch.lab({ author: e.target.value || undefined })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">{t("lab.remix")}</span>
              <div className="flex flex-wrap gap-1.5">
                {REMIXES.map((op) => (
                  <Key key={op} size="sm" onClick={() => remix(op)} disabled={!lab.text.trim() || !!remixBusy} led={remixBusy === op ? true : null} ledTone="ion">
                    {REMIX_LABEL[op][ui]}
                  </Key>
                ))}
                {history.length > 0 && (
                  <Key
                    size="sm"
                    tone="ghost"
                    onClick={() => {
                      const prev = history[history.length - 1];
                      setHistory((h) => h.slice(0, -1));
                      patch.lab({ text: prev });
                    }}
                  >
                    ↶ Undo
                  </Key>
                )}
              </div>
              {remixNote && <p className="text-[12px] italic text-[var(--ink-3)]">{remixNote}</p>}
            </div>
          </div>
        </Panel>

        {/* Poem */}
        <Panel index="B" title={a ? `${a.scheme}` : t("lab.view.scansion")} right={a && <span className="chip chip-accent">{formLabel(a.form.key, ui)} · {Math.round(a.form.confidence * 100)}%</span>}>
          <div className="max-h-[78vh] overflow-auto p-4 md:p-6">
            {a ? <PoemView a={a} mode={mode} onWord={setWord} /> : <p className="verse py-20 text-center text-[20px] italic text-[var(--ink-3)]">{t("lab.empty")}</p>}
          </div>
        </Panel>

        {/* Instruments */}
        <div className="flex min-w-0 flex-col gap-4">
          <Panel index="C" title={t("lab.instruments")}>
            {a ? (
              <div className="flex flex-col gap-4 p-4">
                <Screen className="grid grid-cols-2 gap-3 p-3">
                  <Readout label={t("lab.form")} value={formLabel(a.form.key, ui)} sub={a.form.notes.slice(0, 2).join(" · ")} tone="accent" />
                  <Readout label={t("lab.meter")} value={meterText} sub={`${Math.round(a.meter.regularity * 100)}%`} tone="ion" />
                  <Readout label={t("lab.scheme")} value={<span className="text-[12px]">{a.scheme}</span>} sub={`${a.stats.rhymed}/${a.stats.lines} · ♀${a.stats.feminine} ♂${a.stats.masculine}`} />
                  <Readout label={t("lab.flow")} value={`${Math.round(a.flow.density * 100)}%`} sub={`${a.flow.multis} ${t("lab.multis")} · ${a.flow.syllablesPerBar.toFixed(1)}σ`} />
                </Screen>
                <div className="flex items-center justify-center">
                  <Pentagon sig={a.signature} size={200} />
                </div>
                <Screen className="relative px-3 pb-2 pt-3">
                  <MeterGauge a={a} />
                  <span className="eyebrow mt-1 block !text-[9px]">σ / {t("common.line")}</span>
                </Screen>
              </div>
            ) : (
              <div className="p-6 text-center text-[var(--ink-3)]">—</div>
            )}
          </Panel>
          {word && a && <BabelCard key={word} word={word} lang={a.lang} onClose={() => setWord(null)} />}
          {a && (
            <Panel index="D" title={t("lab.families")}>
              <div className="p-4">
                <FlowStats a={a} />
              </div>
            </Panel>
          )}
          {a && (
            <Panel index="E" title={t("lab.echoes")}>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {litNodes.length ? (
                    litNodes.map((n) => (
                      <button key={n!.id} type="button" className="chip chip-lit" onClick={() => moves.toAtlas(n!.id)}>
                        <svg width="11" height="11" viewBox="-7 -7 14 14">
                          <Glyph kind={n!.kind} r={4} color={KIND_COLOR[n!.kind]} />
                        </svg>
                        {n!.label[ui]}
                      </button>
                    ))
                  ) : (
                    <span className="text-[12px] text-[var(--ink-3)]">{t("lab.none")}</span>
                  )}
                </div>
                {data && (
                  <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-3">
                    <span className="eyebrow">{t("lab.skeleton")}</span>
                    <code className="mono block break-words text-[11px] text-[var(--ink-2)]">{describeSkeleton(data.skeleton)}</code>
                    <div className="flex flex-wrap gap-1.5">
                      <Key size="sm" tone="accent" onClick={() => moves.toTranspose({ text: lab.text, lang: a.lang, title: lab.title, author: lab.author })}>
                        {t("lab.toTranspose")} →
                      </Key>
                      <Key size="sm" onClick={() => moves.toLoom({ skeleton: data.skeleton, lang: a.lang })}>
                        {t("lab.toLoom")}
                      </Key>
                      <Key size="sm" tone="ghost" onClick={() => download(`${(lab.title ?? "skeleton").replace(/\W+/g, "-").toLowerCase()}.skeleton.json`, JSON.stringify(data.skeleton, null, 2))}>
                        {t("lab.export")}
                      </Key>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Lens */}
      {a && (
        <Panel
          index="F"
          title={t("lab.lens")}
          right={
            <div className="flex items-center gap-2">
              <input className="field hidden !h-[30px] !w-[320px] !py-1 text-[12px] md:block" placeholder={t("lab.ask")} value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setLensRun((n) => n + 1)} />
              <Key size="sm" tone="accent" onClick={() => setLensRun((n) => n + 1)}>
                {t("lab.read")} ⏎
              </Key>
            </div>
          }
        >
          <div className="p-4 md:p-6">
            {lensRun ? (
              <Lens
                a={a}
                text={lab.text}
                lang={lab.lang}
                title={lab.title}
                author={lab.author}
                ask={ask}
                run={lensRun}
                act={{
                  atlas: moves.toAtlas,
                  transpose: (l, r) => moves.toTranspose({ text: lab.text, lang: a.lang, title: lab.title, author: lab.author }, { lang: l, register: r }),
                  remix,
                  loom: (seed, form) => moves.toLoom({ subject: seed, form: form ?? undefined, lang: a.lang }),
                }}
              />
            ) : (
              <p className="verse text-center text-[18px] italic text-[var(--ink-3)]">
                {{ en: "Press “Read it” — the margin composes a reading for this poem alone.", fr: "Appuyez sur « Lire » — la marge compose une lecture pour ce seul poème.", cs: "Stiskni „Přečíst“ — okraj složí čtení jen pro tuhle báseň." }[ui]}
              </p>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
