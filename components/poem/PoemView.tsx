"use client";
import { Fragment, type ReactNode } from "react";
import { FAMILY_COLORS, LETTER_COLORS } from "@/lib/client/hooks";
import type { Analysis, Line } from "@/lib/prosody/types";

export type ViewMode = "text" | "scansion" | "flow" | "sound";

const famColor = (id: number) => FAMILY_COLORS[id % FAMILY_COLORS.length];

/** Which words each line's sound devices touch → colour. */
function soundMarks(a: Analysis): Map<number, Map<number, string>> {
  const m = new Map<number, Map<number, string>>();
  const tone: Record<string, string> = { "device:alliteration": "#ff8a5b", "device:assonance": "#7fd1c7", "rhyme:internal": "#f2c14e" };
  for (const d of a.devices) {
    const c = tone[d.key];
    if (!c || !d.words) continue;
    for (const [li, ws] of Object.entries(d.words)) {
      const row = m.get(Number(li)) ?? new Map<number, string>();
      ws.forEach((w) => row.set(w, row.get(w) ?? c));
      m.set(Number(li), row);
    }
  }
  return m;
}

function LineBody({ line, a, mode, sound, onWord }: { line: Line; a: Analysis; mode: ViewMode; sound: Map<number, Map<number, string>>; onWord?: (w: string) => void }) {
  const out: ReactNode[] = [];
  let cursor = 0;
  let counted = 0;
  const famRow = a.flow.map[line.index] ?? [];
  const dev = new Set(line.meter?.deviations ?? []);
  const sylsByWord = new Map<number, typeof line.syllables>();
  line.syllables.forEach((s) => sylsByWord.set(s.word, [...(sylsByWord.get(s.word) ?? []), s]));
  line.words.forEach((w, wi) => {
    if (w.start > cursor) out.push(<span key={`g${wi}`} className="whitespace-pre text-[var(--ink-3)]">{line.text.slice(cursor, w.start)}</span>);
    cursor = w.end;
    const syls = sylsByWord.get(wi) ?? [];
    const onClick = onWord ? () => onWord(w.text.replace(/^['’]|['’]$/g, "")) : undefined;
    if (mode === "text" || mode === "sound") {
      const c = mode === "sound" ? sound.get(line.index)?.get(wi) : undefined;
      out.push(
        <span key={`w${wi}`} onClick={onClick} className={onClick ? "cursor-pointer rounded-sm hover:bg-[var(--accent-soft)]" : ""} style={c ? { color: c, textShadow: `0 0 12px ${c}55` } : undefined}>
          {w.text}
        </span>,
      );
      counted += syls.filter((s) => !s.elided).length;
      return;
    }
    // Reconstruct the word from its syllable chunks; fall back to the raw word if chunks don't match.
    const joined = syls.map((s) => s.text).join("");
    const usable = joined.toLowerCase() === w.text.toLowerCase();
    if (!usable) {
      // keep the counter in sync
      const pieces = syls.map((s) => {
        const ci = s.elided ? -1 : counted++;
        return { s, ci };
      });
      out.push(
        <span key={`w${wi}`} onClick={onClick} className="cursor-pointer">
          {mode === "flow" ? (
            <span className={pieces.some((p) => p.ci >= 0 && famRow[p.ci] >= 0) ? "fam" : ""} style={{ ["--fam" as string]: famColor(Math.max(0, ...pieces.map((p) => (p.ci >= 0 ? famRow[p.ci] : -1)))) }}>
              {w.text}
            </span>
          ) : (
            w.text
          )}
        </span>,
      );
      return;
    }
    out.push(
      <span key={`w${wi}`} onClick={onClick} className={`inline-flex ${onClick ? "cursor-pointer" : ""}`}>
        {syls.map((s, k) => {
          const ci = s.elided ? -1 : counted++;
          if (mode === "flow") {
            const fid = ci >= 0 ? famRow[ci] : -1;
            return (
              <span key={k} className={fid >= 0 ? "fam" : ""} style={fid >= 0 ? { ["--fam" as string]: famColor(fid) } : { opacity: s.elided ? 0.4 : 1 }}>
                {s.text}
              </span>
            );
          }
          const cls = ["syl", s.stress === 1 ? "syl-strong" : s.stress === 2 ? "syl-second" : "", s.elided ? "syl-elided" : "", s.emuet ? "syl-emuet" : "", s.long ? "syl-long" : "", ci >= 0 && dev.has(ci) ? "syl-dev" : ""].join(" ");
          const mark = s.elided ? "∅" : s.stress === 1 ? "/" : s.stress === 2 ? "\\" : s.flex ? "~" : "x";
          const caesuraAfter = line.caesura && ci === line.caesura - 1;
          return (
            <Fragment key={k}>
              <span className={cls} title={`${s.text}${s.long ? " · long" : ""}${s.emuet ? " · e muet" : ""}${s.dierese ? " · diérèse" : ""}`}>
                <span>{s.text || "·"}</span>
                <span className="mark">{mark}</span>
              </span>
              {caesuraAfter && <span className="mx-1 self-start text-[var(--accent)]">‖</span>}
            </Fragment>
          );
        })}
      </span>,
    );
  });
  if (cursor < line.text.length) out.push(<span key="tail" className="whitespace-pre text-[var(--ink-3)]">{line.text.slice(cursor)}</span>);
  return <>{out}</>;
}

export function PoemView({ a, mode, onWord, from = 1, to, compact = false, highlight }: { a: Analysis; mode: ViewMode; onWord?: (w: string) => void; from?: number; to?: number; compact?: boolean; highlight?: Set<number> }) {
  const sound = mode === "sound" ? soundMarks(a) : new Map();
  const real = a.lines.filter((l) => l.words.length);
  const first = real[from - 1]?.index ?? 0;
  const last = real[(to ?? real.length) - 1]?.index ?? a.lines.length - 1;
  const shown = a.lines.filter((l) => l.index >= first && l.index <= last);
  let n = real.findIndex((l) => l.index >= first);
  return (
    <div className={`flex flex-col ${compact ? "gap-0.5" : mode === "scansion" ? "gap-2" : "gap-1"}`}>
      {shown.map((l) => {
        if (!l.words.length) return <div key={l.index} className={compact ? "h-2" : "h-4"} />;
        n++;
        const letter = l.letter;
        const lit = highlight?.has(l.index);
        return (
          <div key={l.index} className={`group grid items-baseline gap-3 rounded-md px-1 ${lit ? "bg-[var(--ion-soft)]" : ""}`} style={{ gridTemplateColumns: compact ? "1.6rem 1fr 2.2rem" : "2rem 1fr 3.4rem" }}>
            <span className="mono tabular text-right text-[10px] text-[var(--ink-4)] group-hover:text-[var(--ink-3)]">{n}</span>
            <div className={`verse min-w-0 ${compact ? "text-[15px]" : mode === "scansion" ? "flex flex-wrap items-start gap-y-1 text-[15.5px]" : "text-[19px] leading-[1.55]"}`}>
              <LineBody line={l} a={a} mode={mode} sound={sound} onWord={onWord} />
            </div>
            <span className="flex items-center justify-end gap-1.5">
              <span className="mono tabular text-[10px] text-[var(--ink-3)]">{l.count}</span>
              {letter && (
                <span className="mono inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1 text-[10px] font-medium" style={letter === "x" ? { color: "var(--ink-4)", border: "1px solid var(--line-2)" } : { background: `${LETTER_COLORS[letter]}26`, color: LETTER_COLORS[letter], border: `1px solid ${LETTER_COLORS[letter]}55` }}>
                  {letter}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
