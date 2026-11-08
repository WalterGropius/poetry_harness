"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@/lib/atlas/types";
import { REGISTERS } from "@/lib/ai/registers";
import { POEMS, poemById } from "@/lib/corpus/poems";
import { analyzeOnce, LETTER_COLORS, streamNdjson, useAnalysis, useT, useUiLang } from "@/lib/client/hooks";
import { formLabel, useMoves } from "@/lib/client/moves";
import { getState, patch, useVerso, type RelayStep } from "@/lib/client/store";
import type { Skeleton, SkeletonFit } from "@/lib/prosody/types";
import { describeSkeleton } from "@/lib/prosody/skeleton";
import { Key, Knob, Panel, Screen, Spinner, Track } from "@/components/ui/controls";
import { Pentagon } from "@/components/poem/instruments";

/** The rhythm with the words taken out: one row per line, one cell per syllable. */
export function SkeletonStrip({ s, fit, active }: { s: Skeleton; fit?: SkeletonFit | null; active?: number }) {
  let i = 0;
  return (
    <div className="flex flex-col gap-2.5">
      {s.stanzas.map((n, si) => (
        <div key={si} className="flex flex-col gap-[3px]">
          {Array.from({ length: n }, () => s.lines[i++]).map((l, k) => {
            const idx = i - n + k;
            if (!l) return null;
            const f = fit?.lines[idx];
            return (
              <div key={k} className={`flex items-center gap-2 ${active === idx ? "opacity-100" : ""}`}>
                <span className="mono w-5 text-right text-[9px] text-[var(--ink-4)]">{idx + 1}</span>
                <div className="flex items-end gap-[2px]">
                  {Array.from({ length: l.syllables }, (_, j) => {
                    const strong = l.pattern ? l.pattern[j] === "/" : false;
                    const caes = l.caesura && j === l.caesura - 1;
                    return <span key={j} className="block w-[7px] rounded-[1.5px]" style={{ height: strong ? 14 : 7, background: strong ? "var(--accent)" : "var(--ink-4)", marginRight: caes ? 5 : 0, boxShadow: strong ? "0 0 6px var(--accent-soft)" : undefined }} />;
                  })}
                </div>
                <span className="mono ml-1 text-[10px]" style={{ color: l.rhyme === "x" ? "var(--ink-4)" : LETTER_COLORS[l.rhyme] }}>
                  {l.rhyme}
                  {l.ending === "f" ? "ʹ" : ""}
                  {l.refrain ? ` ${l.refrain}` : ""}
                </span>
                {f && (
                  <span className="mono ml-auto text-[10px] tabular" style={{ color: f.score > 0.85 ? "var(--ok)" : f.score > 0.6 ? "var(--warn)" : "var(--bad)" }} title={f.notes.join(" · ")}>
                    {Math.round(f.score * 100)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const DEMO_PLAN: { lang: Lang; register: string; story: Record<Lang, string> }[] = [
  { lang: "cs", register: "contemporary-rap", story: { en: "a night shift on the Prague tram line 22, 4 a.m., a love that won't text back", fr: "une nuit sur la ligne 22 du tram de Prague, 4 h du matin, un amour qui ne répond pas", cs: "noční směna na pražské dvaadvacítce, čtyři ráno, láska, co neodepisuje" } },
  { lang: "fr", register: "symbolist", story: { en: "the same tram, seen from the river at dawn, as a lantern of the dead", fr: "le même tram, vu du fleuve à l'aube, comme une lanterne des morts", cs: "tatáž tramvaj, viděná od řeky za úsvitu jako lucerna mrtvých" } },
];

export default function TransposeClient() {
  const t = useT();
  const ui = useUiLang();
  const params = useSearchParams();
  const relay = useVerso((s) => s.relay);
  const moves = useMoves();
  const isDemo = params.get("relay") === "demo";
  const qTo = params.get("to") as Lang | null;
  const [targetLang, setTargetLang] = useState<Lang>(() => (isDemo ? DEMO_PLAN[0].lang : qTo && ["en", "fr", "cs"].includes(qTo) ? qTo : "cs"));
  const [register, setRegister] = useState(() => (isDemo ? DEMO_PLAN[0].register : (params.get("reg") ?? "contemporary-rap")));
  const [story, setStory] = useState(() => (isDemo ? DEMO_PLAN[0].story[ui] : ""));
  const [fidelity, setFidelity] = useState<"strict" | "loose">("strict");
  const [chaos, setChaos] = useState(0.1);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string[]>([]);
  const [fit, setFit] = useState<SkeletonFit | null>(null);
  const [result, setResult] = useState<{ text: string; analysis?: { scheme: string; form: { key: string }; signature: { sound: number; measure: number; shape: number; image: number; voice: number }; flow: { density: number; multis: number } } } | null>(null);
  const [skeleton, setSkeleton] = useState<Skeleton | null>(null);
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(isDemo ? 0 : -1);
  const abort = useRef<(() => void) | null>(null);

  // ?relay=demo seeds the chain with Sonnet 18 (an external store, so an effect is the right place).
  useEffect(() => {
    if (!isDemo) return;
    const p = poemById("sonnet-18")!;
    patch.relay([{ id: "s0", text: p.text, lang: p.lang, title: p.title, author: p.author }]);
  }, [isDemo]);

  const current: RelayStep | undefined = relay[relay.length - 1];
  const { data: srcData } = useAnalysis(current?.text ?? "", current?.lang ?? "auto");

  const runTranspose = useCallback(() => {
    const src = getState().relay.at(-1);
    if (!src) return;
    abort.current?.();
    setBusy(true);
    setOut([]);
    setFit(null);
    setResult(null);
    setErr(null);
    abort.current = streamNdjson(
      "/api/transpose",
      { source: { text: src.text, lang: src.lang, title: src.title, author: src.author }, target: { lang: targetLang, register, story }, fidelity, chaos, chaosSeed: Math.floor(Math.random() * 1e5) },
      (e) => {
        if (e.type === "meta") {
          setOffline(!!e.offline);
          setSkeleton(e.skeleton as Skeleton);
        }
        if (e.type === "line") setOut((o) => [...o, String(e.text)]);
        if (e.type === "fit") {
          setFit(e.fit as SkeletonFit);
          setResult({ text: String(e.text), analysis: e.analysis as never });
        }
        if (e.type === "error") setErr(String(e.message));
      },
      () => setBusy(false),
    );
  }, [targetLang, register, story, fidelity, chaos]);

  const relayOnward = () => {
    if (!result) return;
    const step: RelayStep = { id: `s${Date.now()}`, text: result.text, lang: targetLang, register, story, fit: fit?.score ?? null, offline, title: story ? story.slice(0, 48) : undefined };
    patch.relay([...getState().relay, step]);
    setOut([]);
    setFit(null);
    setResult(null);
    if (demo >= 0 && DEMO_PLAN[demo + 1]) {
      const nx = DEMO_PLAN[demo + 1];
      setDemo(demo + 1);
      setTargetLang(nx.lang);
      setRegister(nx.register);
      setStory(nx.story[ui]);
    } else {
      setStory("");
      const nextLang = (["en", "fr", "cs"] as Lang[]).find((l) => l !== targetLang) ?? "en";
      setTargetLang(nextLang);
    }
  };

  const pickSource = async (id: string) => {
    const p = poemById(id);
    if (!p) return;
    patch.relay([{ id: `s${Date.now()}`, text: p.text, lang: p.lang, title: p.title, author: p.author }]);
    await analyzeOnce(p.text, p.lang);
  };

  const outText = useMemo(() => {
    if (result) return result.text;
    if (!skeleton) return out.join("\n");
    const parts: string[] = [];
    let i = 0;
    for (const n of skeleton.stanzas) {
      const chunk = out.slice(i, i + n);
      if (!chunk.length) break;
      parts.push(chunk.join("\n"));
      i += n;
    }
    return parts.join("\n\n");
  }, [out, result, skeleton]);

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">
            <span className="text-[var(--accent)]">04</span> / {t("nav.transpose")}
          </span>
          <h1 className="verse text-[30px] leading-none md:text-[38px]">{{ en: "Keep the rhythm. Change everything else.", fr: "Garder le rythme. Changer tout le reste.", cs: "Zachovej rytmus. Změň všechno ostatní." }[ui]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <select className="field !h-[34px] !w-[240px] !py-1 text-[12px]" value="" onChange={(e) => e.target.value && pickSource(e.target.value)}>
            <option value="">{t("tr.pick")}…</option>
            {POEMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.lang.toUpperCase()} · {p.author} — {p.title}
              </option>
            ))}
          </select>
          {relay.length > 1 && (
            <Key size="sm" tone="ghost" onClick={() => patch.relay(relay.slice(0, 1))}>
              {t("tr.reset")}
            </Key>
          )}
        </div>
      </div>

      {/* Relay chain */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {relay.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <span className="mono text-[var(--accent)]">→</span>}
            <button type="button" onClick={() => patch.relay(relay.slice(0, i + 1))} className={`plate flex min-w-[170px] flex-col gap-1 px-3 py-2 text-left ${i === relay.length - 1 ? "ring-1 ring-[var(--accent)]/50" : "opacity-80 hover:opacity-100"}`}>
              <span className="eyebrow !text-[9px]">
                {String(i).padStart(2, "0")} · {s.lang.toUpperCase()}
                {s.register ? ` · ${REGISTERS.find((r) => r.id === s.register)?.label[ui] ?? s.register}` : ""}
              </span>
              <span className="verse truncate text-[14px]">{s.title ?? s.text.split("\n")[0]}</span>
              {s.fit != null && <span className="mono text-[10px] text-[var(--ok)]">fit {Math.round(s.fit * 100)}%</span>}
            </button>
          </div>
        ))}
        {relay.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="mono text-[var(--ink-4)]">→</span>
            <div className="flex min-w-[170px] flex-col justify-center rounded-[14px] border border-dashed border-[var(--line-3)] px-3 py-2">
              <span className="eyebrow !text-[9px]">
                {String(relay.length).padStart(2, "0")} · {targetLang.toUpperCase()}
              </span>
              <span className="text-[12px] text-[var(--ink-3)]">{REGISTERS.find((r) => r.id === register)?.label[ui]}</span>
            </div>
          </div>
        )}
      </div>

      {!current ? (
        <Panel>
          <div className="flex flex-col items-center gap-4 p-10">
            <p className="verse text-[20px] italic text-[var(--ink-3)]">{t("tr.pick")}</p>
            <Key tone="accent" onClick={() => pickSource("sonnet-18")}>
              Shakespeare · Sonnet 18
            </Key>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Panel index="A" title={t("tr.source")} right={srcData && <span className="chip">{formLabel(srcData.analysis.form.key, ui)}</span>}>
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <pre className="verse whitespace-pre-wrap text-[16px] leading-[1.5]">{current.text}</pre>
              {srcData && (
                <Screen className="h-fit p-3">
                  <span className="eyebrow mb-2 block">{t("lab.skeleton")}</span>
                  <SkeletonStrip s={srcData.skeleton} />
                  <code className="mono mt-3 block max-w-[260px] text-[10px] text-[var(--ink-3)]">{describeSkeleton(srcData.skeleton)}</code>
                </Screen>
              )}
            </div>
          </Panel>

          <div className="flex min-w-0 flex-col gap-4">
            <section className="plate flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Track label={t("tr.target")} value={targetLang} onChange={setTargetLang} options={(["en", "fr", "cs"] as Lang[]).map((l) => ({ value: l, label: l.toUpperCase() }))} />
                <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                  <span className="eyebrow">{t("loom.register")}</span>
                  <select className="field text-[13px]" value={register} onChange={(e) => setRegister(e.target.value)}>
                    {REGISTERS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label[ui]}
                      </option>
                    ))}
                  </select>
                </label>
                <Track
                  label={t("tr.fidelity")}
                  value={fidelity}
                  onChange={setFidelity}
                  options={[
                    { value: "strict", label: t("tr.strict") },
                    { value: "loose", label: t("tr.loose") },
                  ]}
                />
                <Knob value={chaos} onChange={setChaos} label={t("loom.chaos")} size={52} />
              </div>
              <textarea className="field verse min-h-[64px] text-[15px]" value={story} onChange={(e) => setStory(e.target.value)} placeholder={t("tr.story")} />
              <div className="flex flex-wrap items-center gap-2">
                <Key tone="accent" size="lg" onClick={runTranspose} disabled={busy}>
                  {busy ? <Spinner label={t("common.working")} /> : `${t("tr.run")} → ${targetLang.toUpperCase()}`}
                </Key>
                {offline && <span className="chip chip-accent">{t("status.offline")} · cento</span>}
                {err && <span className="text-[13px] text-[var(--bad)]">{err}</span>}
              </div>
            </section>

            <Panel
              index="B"
              title={`${targetLang.toUpperCase()} · ${REGISTERS.find((r) => r.id === register)?.label[ui] ?? register}`}
              right={
                fit && (
                  <span className="mono text-[11px]" style={{ color: fit.score > 0.85 ? "var(--ok)" : "var(--warn)" }}>
                    {t("tr.fit")} {Math.round(fit.score * 100)}%
                  </span>
                )
              }
            >
              <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex flex-col">
                  {outText ? (
                    outText.split("\n").map((l, i) => (
                      <p key={i} className={`verse rise text-[18px] leading-[1.5] ${l.trim() ? "" : "h-4"}`}>
                        {l}
                      </p>
                    ))
                  ) : (
                    <p className="verse py-8 text-center text-[17px] italic text-[var(--ink-3)]">{busy ? "…" : "—"}</p>
                  )}
                </div>
                {skeleton && (out.length > 0 || fit) && (
                  <Screen className="h-fit p-3">
                    <SkeletonStrip s={skeleton} fit={fit} />
                  </Screen>
                )}
              </div>
              {result && (
                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] p-4">
                  {result.analysis && <Pentagon sig={result.analysis.signature} ghost={srcData?.analysis.signature} size={150} />}
                  <div className="flex flex-col gap-2">
                    {result.analysis && (
                      <span className="mono text-[11px] text-[var(--ink-2)]">
                        {result.analysis.scheme} · {formLabel(result.analysis.form.key, ui)} · flow {Math.round(result.analysis.flow.density * 100)}% · {result.analysis.flow.multis} multis
                      </span>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Key tone="accent" onClick={relayOnward}>
                        {t("tr.relay")} →
                      </Key>
                      <Key onClick={() => moves.toLab(result.text, targetLang, { title: story || undefined })}>{t("loom.toLab")}</Key>
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
