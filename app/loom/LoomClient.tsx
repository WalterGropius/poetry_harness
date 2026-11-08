"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@/lib/atlas/types";
import { NODES } from "@/lib/atlas/nodes";
import { REGISTERS } from "@/lib/ai/registers";
import { streamNdjson, useStatus, useT, useUiLang, LETTER_COLORS } from "@/lib/client/hooks";
import { download, formLabel, useMoves } from "@/lib/client/moves";
import { getState, patch, trail, useVerso, type LoomLine } from "@/lib/client/store";
import { formSkeleton, SKELETON_FORMS } from "@/lib/prosody/skeleton";
import type { Skeleton } from "@/lib/prosody/types";
import { Key, Knob, Panel, Screen, Spinner, Track } from "@/components/ui/controls";

interface Candidate {
  id: string;
  text: string;
  move?: string;
  technique?: string;
  sources?: string[];
  fit?: { score: number | null; notes?: string[]; line?: { count: number; pattern: string; letter: string } | null; scheme?: string };
  judge?: { image: number; fresh: number | null };
}

const STEER_KEYS = ["sound", "measure", "shape", "image", "voice", "turn", "strange"] as const;
const STEER_LABEL: Record<string, Record<Lang, string>> = {
  sound: { en: "Sound", fr: "Son", cs: "Zvuk" },
  measure: { en: "Measure", fr: "Mesure", cs: "Míra" },
  shape: { en: "Shape", fr: "Forme", cs: "Tvar" },
  image: { en: "Image", fr: "Image", cs: "Obraz" },
  voice: { en: "Voice", fr: "Voix", cs: "Hlas" },
  turn: { en: "Turn", fr: "Volta", cs: "Obrat" },
  strange: { en: "Strange", fr: "Étrange", cs: "Divné" },
};

const PROV_GLYPH: Record<LoomLine["prov"], string> = { chosen: "✦", written: "✎", varied: "⟲", cento: "❝", draft: "▤" };

function stanzaBreaks(s: Skeleton | null, n: number): Set<number> {
  const out = new Set<number>();
  if (!s) return out;
  let acc = 0;
  for (const k of s.stanzas) {
    acc += k;
    if (acc < n) out.add(acc);
  }
  return out;
}

export default function LoomClient() {
  const t = useT();
  const ui = useUiLang();
  const loom = useVerso((s) => s.loom);
  const status = useStatus();
  const moves = useMoves();
  const [mode, setMode] = useState<"next" | "draft">("next");
  const [cands, setCands] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [own, setOwn] = useState("");
  const [rejected, setRejected] = useState<string[]>([]);
  const [offline, setOffline] = useState(false);
  const abort = useRef<(() => void) | null>(null);

  const skeleton: Skeleton | null = useMemo(() => {
    if (loom.form === "skeleton") return loom.skeleton;
    if (loom.form === "free") return null;
    return formSkeleton(loom.form, loom.lang);
  }, [loom.form, loom.skeleton, loom.lang]);

  const lines = loom.lines;
  const targetIndex = selected ?? lines.length;
  const target = skeleton?.lines[targetIndex];
  const full = !!skeleton && lines.length >= skeleton.lines.length && selected === null;
  const breaks = stanzaBreaks(skeleton, (skeleton?.lines.length ?? lines.length) + 1);

  const partnerWords = useMemo(() => {
    if (!target || target.rhyme === "x" || !skeleton) return [];
    return skeleton.lines
      .map((l, i) => (i < targetIndex && l.rhyme === target.rhyme ? lines[i]?.text.trim().split(/\s+/).pop()?.replace(/[^\p{L}'’-]/gu, "") : null))
      .filter(Boolean) as string[];
  }, [target, skeleton, targetIndex, lines]);

  const judge = useCallback((cs: Candidate[]) => {
    if (!cs.length) return;
    fetch("/api/judge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidates: cs.map((c) => c.text), context: getState().loom.lines.map((l) => l.text).join("\n"), lang: getState().loom.lang }) })
      .then((r) => r.json())
      .then((j: { scores?: { image: number; fresh: number | null }[] }) => {
        if (!j.scores?.length) return;
        setCands((prev) => prev.map((c, i) => (j.scores![i] ? { ...c, judge: j.scores![i] } : c)));
      })
      .catch(() => {});
  }, []);

  const run = useCallback(
    (kind: "next" | "vary" | "draft", extraRejected: string[] = []) => {
      abort.current?.();
      setCands([]);
      setErr(null);
      setBusy(true);
      const s = getState().loom;
      const got: Candidate[] = [];
      abort.current = streamNdjson(
        "/api/compose",
        {
          mode: kind,
          lang: s.lang,
          seed: { subject: s.subject, register: s.register },
          form: s.form !== "skeleton" && s.form !== "free" ? s.form : undefined,
          skeleton: s.form === "skeleton" ? s.skeleton : undefined,
          lines: s.lines.map((l) => l.text),
          index: kind === "vary" ? (selected ?? undefined) : undefined,
          steer: s.steer,
          chaos: s.chaos,
          chaosSeed: Math.floor(Math.random() * 1e5),
          k: kind === "draft" ? Math.min(3, s.k) : s.k,
          rejected: [...rejected, ...extraRejected],
        },
        (e) => {
          if (e.type === "meta") setOffline(!!e.offline);
          if (e.type === "candidate") {
            const c = e as unknown as Candidate;
            got.push(c);
            setCands((prev) => [...prev, c]);
          }
          if (e.type === "error") setErr(String(e.message));
        },
        () => {
          setBusy(false);
          judge(got);
        },
      );
      trail({ kind: kind === "draft" ? "draft" : kind === "vary" ? "vary" : "steer", detail: s.steer.join("+") || undefined });
    },
    [rejected, selected, judge],
  );

  useEffect(() => () => abort.current?.(), []);

  const keep = useCallback(
    (c: Candidate) => {
      const s = getState().loom;
      const prov: LoomLine["prov"] = offline ? "cento" : selected !== null ? "varied" : "chosen";
      if (mode === "draft" && selected === null) {
        const ls = c.text.split("\n").map((x) => x.trim()).filter(Boolean);
        patch.loom({ lines: ls.map((text) => ({ text, prov: "draft" as const, move: c.move, of: cands.length })) });
      } else if (selected !== null) {
        const next = [...s.lines];
        next[selected] = { text: c.text, prov, move: c.move, of: cands.length };
        patch.loom({ lines: next });
        setSelected(null);
      } else {
        patch.loom({ lines: [...s.lines, { text: c.text, prov, move: c.move, of: cands.length }] });
      }
      trail({ kind: "keep", text: c.text, detail: c.move });
      setRejected((r) => [...r, ...cands.filter((x) => x.id !== c.id).map((x) => x.text)].slice(-30));
      setCands([]);
    },
    [cands, mode, selected, offline],
  );

  const rejectAll = () => {
    const texts = cands.map((c) => c.text);
    texts.forEach((x) => trail({ kind: "reject", text: x }));
    setRejected((r) => [...r, ...texts].slice(-30));
    run(selected !== null ? "vary" : mode, texts);
  };

  const writeOwn = () => {
    const text = own.trim();
    if (!text) return;
    const s = getState().loom;
    if (selected !== null) {
      const next = [...s.lines];
      next[selected] = { text, prov: "written" };
      patch.loom({ lines: next });
      setSelected(null);
    } else patch.loom({ lines: [...s.lines, { text, prov: "written" }] });
    trail({ kind: "write", text });
    setOwn("");
    setCands([]);
  };

  // keyboard: 1–6 keep, Enter = next, Esc = deselect
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (/^[1-6]$/.test(e.key) && cands[Number(e.key) - 1]) {
        e.preventDefault();
        e.stopPropagation();
        keep(cands[Number(e.key) - 1]);
      } else if (e.key === "Enter" && !busy) run(selected !== null ? "vary" : mode);
      else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [cands, keep, run, busy, mode, selected]);

  const stats = useMemo(() => {
    const chosen = lines.filter((l) => l.prov === "chosen" || l.prov === "cento" || l.prov === "draft").length;
    const seen = lines.reduce((a, l) => a + (l.of ?? 0), 0);
    return { chosen, written: lines.filter((l) => l.prov === "written").length, varied: lines.filter((l) => l.prov === "varied").length, seen };
  }, [lines]);

  const exportMd = () => {
    const s = getState().loom;
    const body = s.lines.map((l, i) => (breaks.has(i) ? "\n" : "") + l.text).join("\n");
    const prov = s.lines.map((l, i) => `${i + 1}. ${PROV_GLYPH[l.prov]} ${l.prov}${l.of ? ` (1 of ${l.of})` : ""}${l.move ? ` — ${l.move}` : ""}`).join("\n");
    download(`verso-loom-${Date.now()}.md`, `# ${s.subject || "Untitled"}\n\n${body}\n\n---\n\nForm: ${formLabel(s.form === "skeleton" ? (s.skeleton?.form ?? "free") : s.form, "en")} · Language: ${s.lang}\n\n## Provenance — authorship by curation\n\n${prov}\n\n${stats.chosen} chosen from ${stats.seen} candidates · ${stats.written} written · ${stats.varied} varied · ${s.trail.length} decisions\n`, "text/markdown");
  };

  const formOptions = [...SKELETON_FORMS.map((f) => ({ value: f, label: formLabel(f, ui) })), { value: "free", label: t("loom.free") }, ...(loom.skeleton ? [{ value: "skeleton", label: `${t("loom.skeleton")}: ${loom.skeleton.title ?? formLabel(loom.skeleton.form, ui)}` }] : [])];

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">
            <span className="text-[var(--accent)]">03</span> / {t("nav.loom")}
          </span>
          <h1 className="verse text-[30px] leading-none md:text-[38px]">{loom.subject ? loom.subject.slice(0, 60) : t("loom.poem")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {offline && (
            <span className="chip chip-accent" title={t("status.offline.tip")}>
              {t("status.offline")}
            </span>
          )}
          <Key size="sm" onClick={() => moves.toLab(lines.map((l, i) => (breaks.has(i) ? "\n" : "") + l.text).join("\n"), loom.lang, { title: loom.subject || undefined })} disabled={!lines.length}>
            {t("loom.toLab")}
          </Key>
          <Key size="sm" onClick={exportMd} disabled={!lines.length}>
            {t("loom.export")}
          </Key>
          <Key
            size="sm"
            tone="ghost"
            onClick={() => {
              patch.loom({ lines: [], trail: [...getState().loom.trail, { t: Date.now(), kind: "clear" }] });
              setCands([]);
              setSelected(null);
            }}
          >
            {t("loom.clear")}
          </Key>
        </div>
      </div>

      {/* Seed console */}
      <section className="plate grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,0.9fr)_minmax(0,0.9fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("loom.seed")}</span>
            <input className="field verse text-[16px]" value={loom.subject} placeholder={t("loom.subject")} onChange={(e) => patch.loom({ subject: e.target.value })} />
          </label>
          <Track label={t("lab.lang")} value={loom.lang} onChange={(v) => patch.loom({ lang: v })} options={(["en", "fr", "cs"] as Lang[]).map((l) => ({ value: l, label: l.toUpperCase() }))} />
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("loom.form")}</span>
            <select className="field text-[13px]" value={loom.form} onChange={(e) => patch.loom({ form: e.target.value })}>
              {formOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("loom.register")}</span>
            <select className="field text-[13px]" value={loom.register} onChange={(e) => patch.loom({ register: e.target.value })}>
              {REGISTERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label[ui]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-end justify-center gap-5">
          <Knob value={loom.chaos} onChange={(v) => patch.loom({ chaos: v })} steps={10} label={t("loom.chaos")} />
          <Knob value={(loom.k - 2) / 4} onChange={(v) => patch.loom({ k: Math.round(2 + v * 4) })} steps={4} label={t("loom.k")} tone="ion" format={() => String(loom.k)} size={52} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Poem */}
        <Panel index="A" title={t("loom.poem")} right={<span className="mono text-[10px] text-[var(--ink-3)]">{skeleton ? `${lines.length}/${skeleton.lines.length}` : lines.length} {t("common.lines")}</span>}>
          <div className="flex flex-col p-4 md:p-6">
            {!lines.length && <p className="verse py-10 text-center text-[18px] italic text-[var(--ink-3)]">{t("loom.empty")}</p>}
            {lines.map((l, i) => {
              const sk = skeleton?.lines[i];
              const isSel = selected === i;
              return (
                <div key={i}>
                  {breaks.has(i) && <div className="h-5" />}
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(isSel ? null : i);
                      setCands([]);
                    }}
                    className={`group grid w-full grid-cols-[1.6rem_1fr_auto] items-baseline gap-3 rounded-md px-2 py-1 text-left transition-colors ${isSel ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/40" : "hover:bg-[var(--bg-3)]"}`}
                  >
                    <span className="mono text-right text-[10px] text-[var(--ink-4)]">{i + 1}</span>
                    <span className="verse text-[19px] leading-snug">{l.text}</span>
                    <span className="flex items-center gap-1.5" title={`${l.prov}${l.of ? ` · 1/${l.of}` : ""}${l.move ? ` · ${l.move}` : ""}`}>
                      {sk && sk.rhyme !== "x" && (
                        <span className="mono text-[10px]" style={{ color: LETTER_COLORS[sk.rhyme] }}>
                          {sk.rhyme}
                        </span>
                      )}
                      <span className="text-[12px] text-[var(--ink-3)]">{PROV_GLYPH[l.prov]}</span>
                    </span>
                  </button>
                </div>
              );
            })}
            {/* target slot */}
            {!full && (
              <div className="mt-2">
                {breaks.has(lines.length) && selected === null && <div className="h-4" />}
                <div className="screen flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <span className="led pulse" data-on="true" data-tone="ion" />
                  <span className="mono text-[11px] text-[var(--ink-2)]">
                    L{targetIndex + 1}
                    {target ? ` · ${target.syllables}σ` : ""}
                    {target?.pattern && loom.lang !== "fr" ? ` · ${target.pattern}` : ""}
                    {target && target.rhyme !== "x" ? ` · ${target.rhyme}${partnerWords.length ? ` ~ ${partnerWords.join(", ")}` : ""}` : ""}
                    {target?.refrain ? ` · ${target.refrain}` : ""}
                  </span>
                  {selected !== null && <span className="chip chip-accent">{t("loom.vary")}</span>}
                </div>
              </div>
            )}
            {full && <p className="verse mt-4 text-center text-[17px] italic text-[var(--ok)]">{t("loom.done")}</p>}
            <div className="mt-4 flex gap-2">
              <input className="field verse flex-1 text-[16px]" value={own} placeholder={t("loom.write")} onChange={(e) => setOwn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && writeOwn()} />
              <Key onClick={writeOwn} disabled={!own.trim()}>
                ✎
              </Key>
            </div>
          </div>
        </Panel>

        {/* Fork */}
        <Panel
          index="B"
          title={t("loom.candidates")}
          right={
            <Track
              value={selected !== null ? "next" : mode}
              onChange={(v) => setMode(v)}
              options={[
                { value: "next", label: selected !== null ? t("loom.vary") : t("loom.next") },
                { value: "draft", label: t("loom.draft") },
              ]}
            />
          }
        >
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Key tone="accent" size="lg" onClick={() => run(selected !== null ? "vary" : mode)} disabled={busy || (full && mode === "next")} kbd="⏎">
                {busy ? <Spinner /> : selected !== null ? t("loom.vary") : mode === "draft" ? t("loom.draft") : t("loom.next")}
              </Key>
              {cands.length > 0 && !busy && (
                <Key onClick={rejectAll} tone="ghost">
                  {t("loom.reject")}
                </Key>
              )}
              <span className="mono ml-auto text-[10px] text-[var(--ink-3)]">{status?.gateway ? status.models.poet : t("status.offline")}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">{t("loom.steer")}</span>
              <div className="flex flex-wrap gap-1.5">
                {STEER_KEYS.map((k) => {
                  const on = loom.steer.includes(k);
                  return (
                    <Key key={k} size="sm" led={on} onClick={() => patch.loom({ steer: on ? loom.steer.filter((x) => x !== k) : [...loom.steer, k] })}>
                      {STEER_LABEL[k][ui]}
                    </Key>
                  );
                })}
              </div>
            </div>
            {err && <p className="text-[13px] text-[var(--bad)]">{err}</p>}
            <div className="flex flex-col gap-2.5">
              {cands.map((c, i) => (
                <CandidateCard key={c.id} c={c} n={i + 1} onKeep={() => keep(c)} draft={mode === "draft" && selected === null} ui={ui} />
              ))}
              {busy && !cands.length && (
                <div className="scanline screen h-24">
                  <span className="sr-only">{t("common.working")}</span>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>

      {/* Trail */}
      <Panel index="C" title={t("loom.trail")} right={<span className="mono text-[10px] text-[var(--ink-3)]">{`✦${stats.chosen} ✎${stats.written} ⟲${stats.varied} · ${stats.seen} seen · ${loom.trail.length} decisions`}</span>}>
        <div className="flex max-h-48 flex-col gap-1 overflow-auto p-4">
          {[...loom.trail].reverse().slice(0, 60).map((e, i) => (
            <div key={i} className="grid grid-cols-[4.5rem_4rem_1fr] items-baseline gap-2 text-[12.5px]">
              <span className="mono text-[10px] text-[var(--ink-4)]">{new Date(e.t).toLocaleTimeString(ui, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className={`mono text-[10px] uppercase ${e.kind === "keep" ? "text-[var(--ok)]" : e.kind === "reject" ? "text-[var(--bad)]" : "text-[var(--ink-3)]"}`}>{e.kind}</span>
              <span className={`verse truncate ${e.kind === "reject" ? "text-[var(--ink-3)] line-through decoration-[var(--line-3)]" : ""}`}>{e.text ?? e.detail ?? ""}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CandidateCard({ c, n, onKeep, draft, ui }: { c: Candidate; n: number; onKeep: () => void; draft: boolean; ui: Lang }) {
  const score = c.fit?.score;
  const tone = score == null ? "var(--ink-3)" : score > 0.85 ? "var(--ok)" : score > 0.6 ? "var(--warn)" : "var(--bad)";
  const tech = c.technique ? NODES.find((x) => x.id === c.technique) : null;
  return (
    <div className="rise group relative rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-3 transition-colors hover:border-[var(--line-3)]" style={{ animationDelay: `${(n - 1) * 40}ms` }}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onKeep} className="key key-square !h-[38px] !w-[38px] shrink-0 !text-[13px]" title="Keep">
          {n}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`verse ${draft ? "whitespace-pre-line text-[15.5px] leading-[1.45]" : "text-[19px] leading-snug"}`}>{c.text}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {c.move && <span className="text-[12px] italic text-[var(--ink-3)]">{c.move}</span>}
            {tech && <span className="chip">{tech.label[ui]}</span>}
          </div>
        </div>
        <Screen className="flex shrink-0 flex-col items-end gap-0.5 px-2 py-1.5">
          <span className="mono tabular text-[14px]" style={{ color: tone }}>
            {score == null ? "—" : `${Math.round(score * 100)}`}
          </span>
          {c.fit?.line && (
            <span className="mono text-[9.5px] text-[var(--ink-3)]">
              {c.fit.line.count}σ {c.fit.line.letter}
            </span>
          )}
          {c.fit?.scheme && <span className="mono max-w-[9rem] truncate text-[9.5px] text-[var(--ink-3)]">{c.fit.scheme}</span>}
          {c.judge && (
            <span className="mono text-[9.5px] text-[var(--ion)]" title="Second reader (decision model): image · freshness">
              ◐{Math.round(c.judge.image * 100)} {c.judge.fresh != null ? `✧${Math.round(c.judge.fresh * 100)}` : ""}
            </span>
          )}
        </Screen>
      </div>
      {c.fit?.notes && c.fit.notes.length > 0 && <p className="mono mt-2 pl-[50px] text-[10px] text-[var(--warn)]">{c.fit.notes.join(" · ")}</p>}
      {c.sources && <p className="mono mt-1 pl-[50px] text-[10px] text-[var(--ink-4)]">{[...new Set(c.sources)].slice(0, 4).join(" · ")}</p>}
    </div>
  );
}
