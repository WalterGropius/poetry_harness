import "server-only";
/**
 * Offline twins: when no gateway is configured the harness still works.
 * The Loom becomes a cento machine — lines drawn from the public-domain library
 * that satisfy the skeleton's syllables and rhymes. Authorship by curation, literally.
 */
import { POEMS } from "@/lib/corpus/poems";
import { analyzeText } from "@/lib/server/engine";
import { compareRhyme } from "@/lib/prosody/rhyme";
import type { Lang, RhymeInfo, Skeleton } from "@/lib/prosody/types";

export interface PoolLine {
  text: string;
  count: number;
  rhyme: RhymeInfo | null;
  source: string;
}

const pools = new Map<Lang, PoolLine[]>();

export function linePool(lang: Lang): PoolLine[] {
  const hit = pools.get(lang);
  if (hit) return hit;
  const out: PoolLine[] = [];
  for (const p of POEMS.filter((p) => p.lang === lang)) {
    const a = analyzeText(p.text, lang);
    for (const l of a.lines) if (l.words.length) out.push({ text: l.text.trim(), count: l.count, rhyme: l.rhyme, source: `${p.author}, ${p.title}` });
  }
  pools.set(lang, out);
  return out;
}

export function rng(seed: number) {
  let x = seed || 7;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

export interface CentoWant {
  syllables: number;
  rhymeWith?: RhymeInfo | null;
  tolerance?: number;
}

export function centoCandidates(lang: Lang, want: CentoWant, exclude: Set<string>, k: number, seed: number): PoolLine[] {
  const pool = linePool(lang).filter((l) => !exclude.has(l.text));
  const tol = want.tolerance ?? 1;
  const r = rng(seed);
  const scored = pool.map((l) => {
    let s = Math.abs(l.count - want.syllables) <= tol ? 2 - Math.abs(l.count - want.syllables) * 0.5 : -Math.abs(l.count - want.syllables) * 0.3;
    if (want.rhymeWith && l.rhyme) {
      const q = compareRhyme(l.rhyme, want.rhymeWith, lang).quality;
      s += q === "perfect" || q === "rich" ? 3 : q === "weak" || q === "slant" ? 1.2 : 0;
      if (l.rhyme.word === want.rhymeWith.word) s -= 2;
    }
    return { l, s: s + r() * 0.8 };
  });
  return scored.sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.l);
}

export function centoPoem(lang: Lang, s: Skeleton, seed: number): PoolLine[] {
  const used = new Set<string>();
  const out: PoolLine[] = [];
  const byLetter = new Map<string, RhymeInfo | null>();
  s.lines.forEach((sl, i) => {
    const partner = sl.rhyme !== "x" ? byLetter.get(sl.rhyme) : undefined;
    const [pick] = centoCandidates(lang, { syllables: sl.syllables, rhymeWith: partner ?? null, tolerance: 2 }, used, 1, seed + i * 31);
    if (pick) {
      used.add(pick.text);
      out.push(pick);
      if (sl.rhyme !== "x" && !byLetter.has(sl.rhyme)) byLetter.set(sl.rhyme, pick.rhyme);
    }
  });
  return out;
}
