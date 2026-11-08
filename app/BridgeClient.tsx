"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { NODES } from "@/lib/atlas/nodes";
import type { Lang } from "@/lib/atlas/types";
import { REGISTERS } from "@/lib/ai/registers";
import { POEMS } from "@/lib/corpus/poems";
import { useAnalysis, useStatus, useT, useUiLang } from "@/lib/client/hooks";
import { formLabel, useMoves } from "@/lib/client/moves";
import { SKELETON_FORMS } from "@/lib/prosody/skeleton";
import { AtlasGraph } from "@/components/atlas/AtlasGraph";
import { Key, Screen } from "@/components/ui/controls";

type Mode = "analyse" | "compose" | "transpose";

const LANG_WORDS: [RegExp, Lang][] = [
  [/\b(czech|česk\w*|cesky|tchèque|tcheque|čeština)\b/i, "cs"],
  [/\b(french|fran[cç]ais\w*|francouz\w*)\b/i, "fr"],
  [/\b(english|anglais|anglick\w*)\b/i, "en"],
];

/** Read a one-line wish ("a villanelle in French about server rooms") into a Loom seed. */
function parseWish(s: string, ui: Lang) {
  const lang = LANG_WORDS.find(([re]) => re.test(s))?.[1] ?? ui;
  const low = s.toLowerCase();
  const form = SKELETON_FORMS.find((f) => {
    const n = NODES.find((x) => x.engine === f);
    return n && Object.values(n.label).some((l) => low.includes(l.toLowerCase().split(" ")[0]));
  });
  const register = REGISTERS.find((r) => Object.values(r.label).some((l) => low.includes(l.toLowerCase().split(" ")[0])) || low.includes(r.id.replace("-", " ")))?.id ?? (/\brap\b/.test(low) ? "contemporary-rap" : "plain");
  return { lang, form: form ?? (/\brap\b/.test(low) ? "free" : undefined), register };
}

const clientPick = typeof window !== "undefined" ? Math.floor(Math.random() * POEMS.length) : 0;
const noop = () => () => {};

export default function BridgeClient() {
  const router = useRouter();
  const t = useT();
  const ui = useUiLang();
  const moves = useMoves();
  const status = useStatus();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const specimen = useSyncExternalStore(noop, () => clientPick, () => 0);

  const multi = text.trim().split("\n").filter((l) => l.trim()).length >= 2;
  const inferred: Mode = mode ?? (multi ? "analyse" : "compose");
  const { data } = useAnalysis(multi ? text : "", "auto", {}, 350);
  const keywordLit = useMemo(() => {
    if (multi || !text.trim()) return [];
    const low = text.toLowerCase();
    return NODES.filter((n) => Object.values(n.label).some((l) => l.length > 3 && low.includes(l.toLowerCase()))).map((n) => n.id);
  }, [text, multi]);
  const lit = data?.lit ?? keywordLit;
  const sp = POEMS[specimen];

  const engage = () => {
    const v = text.trim();
    if (!v) return;
    // An existing poem by name ("Sonnet 18", "Máj", "L'Albatros") opens straight in the Lab.
    const lv = v.toLowerCase();
    const known = !multi && v.length >= 3 ? POEMS.find((p) => lv.includes(p.title.toLowerCase().replace(/[“”"]/g, "")) || p.title.toLowerCase().startsWith(lv)) : undefined;
    if (known && (mode === null || mode === "analyse")) return moves.toLab(known.text, known.lang, { title: known.title, author: known.author });
    if (inferred === "analyse") moves.toLab(v, "auto");
    else if (inferred === "transpose") moves.toTranspose({ text: v, lang: data?.analysis.lang ?? ui });
    else {
      const w = parseWish(v, ui);
      moves.toLoom({ subject: v, lang: w.lang, form: w.form, register: w.register });
    }
  };

  const examples: { label: string; run: () => void }[] = [
    { label: t("bridge.relay"), run: () => router.push("/transpose?relay=demo") },
    { label: { en: "Máj, reverse-engineered", fr: "Máj, rétro-ingénierie", cs: "Máj rozebraný na součástky" }[ui], run: () => router.push("/lab?p=maj") },
    { label: { en: "A villanelle in French about a server room at night", fr: "Une villanelle sur une salle de serveurs la nuit", cs: "Villanella francouzsky o serverovně v noci" }[ui], run: () => moves.toLoom({ subject: { en: "a server room at night", fr: "une salle de serveurs la nuit", cs: "serverovna v noci" }[ui], lang: "fr", form: "form:villanelle", register: "symbolist" }) },
    { label: { en: "Paste a verse you love — DOOM, Baudelaire, Mácha…", fr: "Collez un couplet que vous aimez — DOOM, Baudelaire, Mácha…", cs: "Vlož sloku, kterou miluješ — DOOM, Baudelaire, Mácha…" }[ui], run: () => document.getElementById("console")?.focus() },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* living net */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_78%)]">
        <AtlasGraph lang={ui} lit={lit} ambient />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-[980px] flex-col justify-center gap-7 px-4 py-10">
        <div className="flex flex-col gap-3">
          <span className="eyebrow flex items-center gap-2">
            <span className="led" data-on={status ? "true" : "false"} data-tone={status?.gateway ? "ok" : "accent"} />
            VERSO · EN / FR / CS · {status ? t(status.gateway ? "status.online" : "status.offline") : "…"}
          </span>
          <h1 className="verse max-w-[16ch] text-[44px] leading-[0.98] tracking-[-0.02em] md:text-[72px]">{t("bridge.title")}</h1>
          <p className="max-w-[60ch] text-[16px] leading-relaxed text-[var(--ink-2)]">{t("bridge.sub")}</p>
        </div>

        {/* Console */}
        <section className="plate flex flex-col gap-3 p-3 md:p-4">
          <textarea
            id="console"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) engage();
            }}
            rows={multi ? Math.min(12, text.split("\n").length + 1) : 2}
            placeholder={t("bridge.placeholder")}
            className="field verse resize-none !border-transparent !bg-[var(--bg-sunk)] text-[20px] leading-[1.45] md:text-[22px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="track">
              {(["analyse", "compose", "transpose"] as Mode[]).map((m) => (
                <button key={m} type="button" aria-pressed={inferred === m} onClick={() => setMode(mode === m ? null : m)} title={t(`bridge.mode.${m}` as "bridge.mode.analyse")}>
                  {t(`bridge.${m}` as "bridge.analyse")}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {data && (
                <span className="mono hidden text-[11px] text-[var(--ink-3)] sm:inline">
                  {data.analysis.lang.toUpperCase()} · {data.analysis.stats.lines}L · {data.analysis.scheme.slice(0, 24)} · {formLabel(data.analysis.form.key, ui)}
                </span>
              )}
              <Key tone="accent" size="lg" onClick={engage} disabled={!text.trim()} kbd="⌘⏎">
                {t("bridge.go")}
              </Key>
            </div>
          </div>
          <p className="text-[12.5px] text-[var(--ink-3)]">{t(`bridge.mode.${inferred}` as "bridge.mode.analyse")}</p>
        </section>

        <div className="flex flex-wrap gap-2">
          {examples.map((e) => (
            <button key={e.label} type="button" onClick={e.run} className="chip !h-auto !py-1.5 !text-[10.5px] hover:!border-[var(--accent)] hover:!text-[var(--accent)]">
              {t("bridge.try")} · {e.label}
            </button>
          ))}
        </div>

        {sp && (
          <Link href={`/lab?p=${sp.id}`} className="group grid gap-4 md:grid-cols-[1fr_auto]">
            <Screen className="flex flex-col gap-2 p-4 transition-colors group-hover:border-[var(--line-3)]">
              <span className="eyebrow">
                {t("bridge.specimen")} · {sp.lang.toUpperCase()} · {sp.year}
              </span>
              <pre className="verse whitespace-pre-wrap text-[17px] italic leading-snug">{sp.text.split("\n").slice(0, 4).join("\n")}</pre>
              <span className="text-[12.5px] text-[var(--ink-3)]">
                {sp.author} — {sp.title}
              </span>
            </Screen>
            <div className="hidden max-w-[300px] flex-col justify-end gap-2 md:flex">
              <p className="text-[13px] italic leading-relaxed text-[var(--ink-2)]">{sp.note[ui]}</p>
              <span className="mono text-[10px] text-[var(--accent)]">{t("lib.open")} →</span>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
