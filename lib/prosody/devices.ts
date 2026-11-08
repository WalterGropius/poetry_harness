import { compareRhyme } from "./rhyme";
import { isStopword, lower } from "./text";
import type { Device, Lang, Line, RhymeInfo } from "./types";

type RhymeFn = (word: string) => RhymeInfo;

const VOCATIVE = /^\s*(o|oh|ô|ó|ach|ah)\b[\s,!]/i;
const VOLTA_WORDS: Record<Lang, RegExp> = {
  en: /^\s*(but|yet|so|then|and yet|still|now)\b/i,
  fr: /^\s*(mais|or|pourtant|cependant|alors|et pourtant|hélas)\b/i,
  cs: /^\s*(ale|však|leč|přesto|a přece|tu|pak|teď)\b/i,
};

export function detectDevices(lines: Line[], lang: Lang, rhymeOf: RhymeFn): Device[] {
  const out: Device[] = [];
  const real = lines.filter((l) => l.words.length);

  for (const l of real) {
    // Alliteration: ≥3 content words (or 2 adjacent) sharing an initial consonant sound.
    const byOnset = new Map<string, number[]>();
    l.words.forEach((w, wi) => {
      if (!w.onset || (w.fn && l.words.length > 3)) return;
      const k = w.onset;
      byOnset.set(k, [...(byOnset.get(k) ?? []), wi]);
    });
    for (const [onset, idx] of byOnset) {
      const adjacent = idx.some((x, i) => i > 0 && x - idx[i - 1] === 1);
      if (idx.length >= 3 || (idx.length === 2 && adjacent && l.words.length <= 6)) {
        out.push({ key: "device:alliteration", lines: [l.index], evidence: onset, words: { [l.index]: idx } });
      }
    }
    // Assonance: a stressed nucleus repeated ≥3 times in one line.
    const nuc = new Map<string, number[]>();
    l.syllables.forEach((s) => {
      if (s.elided || !s.nucleus || s.nucleus === "ə") return;
      if (s.stress === 0 && !s.mono && lang !== "fr") return;
      nuc.set(s.nucleus, [...(nuc.get(s.nucleus) ?? []), s.word]);
    });
    for (const [v, ws] of nuc) {
      const uniq = [...new Set(ws)];
      if (uniq.length >= 3) out.push({ key: "device:assonance", lines: [l.index], evidence: v, words: { [l.index]: uniq } });
    }
    // Internal rhyme: a non-final word rhyming with the line end.
    if (l.rhyme && l.words.length > 3) {
      const hits: number[] = [];
      l.words.slice(0, -1).forEach((w, wi) => {
        if (w.fn || w.norm.length < 3) return;
        const q = compareRhyme(rhymeOf(w.text), l.rhyme!, lang).quality;
        if (q === "perfect" || q === "rich") hits.push(wi);
      });
      if (hits.length) out.push({ key: "rhyme:internal", lines: [l.index], evidence: l.rhyme.display, words: { [l.index]: [...hits, l.words.length - 1] } });
    }
    if (VOCATIVE.test(l.text)) out.push({ key: "device:apostrophe", lines: [l.index], evidence: l.text.trim().split(/\s+/)[0] });
    if (/\?\s*$/.test(l.text) || /\?/.test(l.text)) out.push({ key: "device:rhetorical-question", lines: [l.index], evidence: "?" });
    if (/!/.test(l.text)) out.push({ key: "device:exclamation", lines: [l.index], evidence: "!" });
    // Medial pause
    const mid = l.text.trim().slice(3, -3);
    if (/[,;:.!?—–]/.test(mid) && l.count >= 7) out.push({ key: "device:caesura", lines: [l.index], evidence: mid.match(/[,;:.!?—–]/)![0] });
  }

  // Anaphora: consecutive lines opening with the same word(s).
  for (let i = 0; i < real.length; i++) {
    const run = [real[i]];
    const first = real[i].words[0]?.norm;
    if (!first) continue;
    let j = i + 1;
    while (j < real.length && real[j].words[0]?.norm === first) run.push(real[j++]);
    if (run.length >= 2 && (!isStopword(first, lang) || run.length >= 3)) {
      out.push({ key: "device:anaphora", lines: run.map((r) => r.index), evidence: real[i].words[0].text });
      i = j - 1;
    }
  }
  // Epistrophe: lines ending on the same word.
  const endWords = new Map<string, number[]>();
  real.forEach((l) => {
    const w = l.words[l.words.length - 1]?.norm;
    if (w) endWords.set(w, [...(endWords.get(w) ?? []), l.index]);
  });
  // Refrain: identical lines.
  const norm = (s: string) => lower(s).replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " ").trim();
  const seen = new Map<string, number[]>();
  real.forEach((l) => {
    const k = norm(l.text);
    if (k.split(" ").length >= 2) seen.set(k, [...(seen.get(k) ?? []), l.index]);
  });
  const refrainLines = new Set<number>();
  for (const [, idx] of seen)
    if (idx.length >= 2) {
      out.push({ key: "device:refrain", lines: idx, evidence: lines[idx[0]].text.trim() });
      idx.forEach((i) => refrainLines.add(i));
    }
  for (const [w, idx] of endWords)
    if (idx.length >= 2 && !idx.every((i) => refrainLines.has(i)) && !isStopword(w, lang)) out.push({ key: "device:epistrophe", lines: idx, evidence: w });

  // Repetition of content words across the poem.
  const counts = new Map<string, number[]>();
  real.forEach((l) =>
    l.words.forEach((w) => {
      if (w.fn || w.norm.length < 3) return;
      counts.set(w.norm, [...(counts.get(w.norm) ?? []), l.index]);
    }),
  );
  for (const [w, idx] of counts) if (idx.length >= 3 && !refrainLines.size) out.push({ key: "device:repetition", lines: [...new Set(idx)], evidence: w });

  // Enjambment and French rejet.
  for (let i = 0; i < real.length - 1; i++) {
    const a = real[i];
    const b = real[i + 1];
    if (a.stanza !== b.stanza || a.endStopped) continue;
    const startsLower = /^\s*[\p{Ll}]/u.test(b.text);
    if (!startsLower && lang !== "fr") continue;
    out.push({ key: "device:enjambment", lines: [a.index, b.index], evidence: `${a.words[a.words.length - 1]?.text} → ${b.words[0]?.text}` });
    const m = b.text.match(/^\s*([^,;:.!?]+)[,;:.!?]/);
    if (m && m[1].trim().split(/\s+/).length <= 2 && b.words.length > 3) {
      out.push({ key: "device:rejet", lines: [a.index, b.index], evidence: m[1].trim() });
    }
  }

  // Volta: a turn word at line 9 (Petrarchan) or 13 (Shakespearean) of a sonnet-length poem.
  if (real.length === 14) {
    for (const k of [8, 12]) if (VOLTA_WORDS[lang].test(real[k].text)) out.push({ key: "device:volta", lines: [real[k].index], evidence: real[k].words[0]?.text ?? "" });
  }

  // Lipogram: a long text that never uses its language's commonest vowel.
  const letters = lower(real.map((l) => l.text).join(" ")).replace(/[^\p{L}]/gu, "");
  if (letters.length >= 40) {
    const missing = (lang === "cs" ? ["e", "a", "o"] : ["e", "a"]).filter((v) => !letters.includes(v) && !(v === "e" && /[éèêëě]/.test(letters)));
    if (missing.length) out.push({ key: "device:lipogram", lines: real.map((l) => l.index), evidence: missing.join(",") });
  }

  // French specifics
  if (lang === "fr") {
    const di = real.filter((l) => l.syllables.some((s) => s.dierese));
    if (di.length) out.push({ key: "device:diaeresis", lines: di.map((l) => l.index), evidence: "diérèse" });
    const em = real.filter((l) => l.syllables.some((s) => s.emuet));
    if (em.length) out.push({ key: "device:e-muet", lines: em.map((l) => l.index), evidence: "e muet" });
  }
  return out;
}
