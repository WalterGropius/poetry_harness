import { richness as frRichness } from "./fr";
import { looseTail } from "./cs";
import type { Lang, Line, RhymeInfo, RhymePair, RhymeQuality } from "./types";

const RANK: Record<RhymeQuality, number> = { identical: 3, rich: 4, perfect: 3.5, weak: 2, slant: 1, none: 0 };

const ENG_VOWEL_CLASS: Record<string, string> = {
  AA: "a", AO: "a", AH: "a", AE: "e", EH: "e", EY: "e", IH: "i", IY: "i", OW: "o", UH: "u", UW: "u", AW: "aw", AY: "ay", OY: "oy", ER: "er",
};

export function compareRhyme(a: RhymeInfo, b: RhymeInfo, lang: Lang): { quality: RhymeQuality; richness: number } {
  if (!a.tail.length || !b.tail.length) return { quality: "none", richness: 0 };
  if (a.word === b.word) return { quality: "identical", richness: a.tail.length + 1 };
  // French classical rule: masculine never rhymes with feminine.
  if (lang === "fr" && a.ending !== b.ending) return { quality: "none", richness: 0 };
  const eq = (x: string[], y: string[]) => x.length === y.length && x.every((p, i) => p === y[i]);
  if (lang === "fr") {
    if (eq(a.tail, b.tail)) {
      const r = frRichness(a, b);
      return { quality: r >= 3 ? "rich" : "perfect", richness: r };
    }
    // Written rhyme (encens / sens): the eye agrees even where our phonetics hesitate.
    if (a.display.length >= 3 && a.display === b.display) return { quality: "perfect", richness: 2 };
    // Assonance: same final vowel, different coda (vers libre, chanson)
    if (a.vowel && a.vowel === b.vowel) return { quality: "slant", richness: 1 };
    return { quality: "none", richness: 0 };
  }
  if (lang === "cs") {
    if ((a.ending === "m" || b.ending === "m") && !eq(a.tail, b.tail)) {
      // A monosyllable rhymes on one syllable: květ / pohled.
      const sh = (r: RhymeInfo) => r.last.map((p) => p.replace(/[áéíóú]/, (c) => "aeiou"["áéíóú".indexOf(c)])).join("|");
      if (eq(a.last, b.last)) return { quality: "perfect", richness: a.last.length };
      if (sh(a) === sh(b)) return { quality: "weak", richness: a.last.length };
      return { quality: "none", richness: 0 };
    }
    if (eq(a.tail, b.tail) || looseTail(a) === looseTail(b)) {
      // bohatý rým: also the consonant before (and further) agree
      const fa = a.full ?? [];
      const fb = b.full ?? [];
      let r = 0;
      for (let i = 1; i <= Math.min(fa.length, fb.length); i++) {
        if (fa[fa.length - i] === fb[fb.length - i]) r++;
        else break;
      }
      const strict = eq(a.tail, b.tail);
      return { quality: r > a.tail.length + 1 ? "rich" : strict ? "perfect" : "weak", richness: r };
    }
    // Folk assonance on two-syllable endings (leje / pojedeme): same vowels, different consonants.
    const vowels = (r: RhymeInfo) => r.tail.filter((p) => /^(a|á|e|é|i|í|o|ó|u|ú|ou)$/.test(p)).map((p) => p.replace(/[áéíóú]/, (c) => "aeiou"["áéíóú".indexOf(c)])).join("");
    if (a.ending === "f" && b.ending === "f" && vowels(a).length >= 2 && vowels(a) === vowels(b)) return { quality: "slant", richness: 0 };
    return { quality: "none", richness: 0 };
  }
  // English (ARPAbet). If either word was guessed from spelling, compare spellings instead.
  if (a.guessed || b.guessed) {
    const sa = a.display.replace(/^-/, "");
    const sb = b.display.replace(/^-/, "");
    if (sa === sb) return { quality: "perfect", richness: 1 };
    return { quality: "none", richness: 0 };
  }
  if (eq(a.tail, b.tail)) {
    if (a.onset && a.onset === b.onset) return { quality: "identical", richness: a.tail.length + 1 }; // rime riche: weak in English
    return { quality: "perfect", richness: a.tail.length };
  }
  if (eq(a.last, b.last)) return { quality: "weak", richness: a.last.length };
  const va = ENG_VOWEL_CLASS[a.vowel] ?? a.vowel;
  const vb = ENG_VOWEL_CLASS[b.vowel] ?? b.vowel;
  const ca = a.coda.join(" ");
  const cb = b.coda.join(" ");
  // Promoted rhyme: a reduced final syllable carried by the metre (temperate / date, Immortality / me).
  const la = a.last.slice(1).join(" ");
  const lb = b.last.slice(1).join(" ");
  const reduced = (v: string | undefined) => v === "AH" || v === "IH" || v === "IY";
  if ((a.ending === "f" || b.ending === "f") && la === lb && (reduced(a.last[0]) || reduced(b.last[0]))) return { quality: "weak", richness: 1 };
  if (a.ending !== b.ending) return { quality: "none", richness: 0 };
  if (ca && ca === cb) return { quality: "slant", richness: 1 }; // consonance
  if (va === vb && ca === cb) return { quality: "slant", richness: 1 }; // assonance with matching coda class
  return { quality: "none", richness: 0 };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWYZ";

/**
 * Assign rhyme letters. A line takes the letter of the best earlier partner:
 * full rhymes are sought across the poem (sonnet octaves, villanelle refrains),
 * slant rhymes only nearby so that ordinary consonance doesn't invent schemes.
 */
export function assignScheme(lines: Line[], lang: Lang): { letters: string[]; pairs: RhymePair[] } {
  const n = lines.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const pairs: RhymePair[] = [];
  const strong = (q: RhymeQuality) => q === "perfect" || q === "rich" || q === "identical";
  // Pass 1 — true rhymes (anywhere within 14 lines) and weak rhymes nearby: these define the scheme.
  for (let i = 0; i < n; i++) {
    const l = lines[i];
    if (!l.rhyme) continue;
    let best: { j: number; q: RhymeQuality; r: number } | null = null;
    for (let j = i - 1; j >= 0 && i - j <= 14; j--) {
      const o = lines[j];
      if (!o.rhyme) continue;
      const { quality, richness } = compareRhyme(l.rhyme, o.rhyme, lang);
      if (!(strong(quality) || (quality === "weak" && i - j <= 4))) continue;
      if (!best || RANK[quality] > RANK[best.q] || (RANK[quality] === RANK[best.q] && j > best.j)) best = { j, q: quality, r: richness };
    }
    if (best) {
      union(i, best.j);
      pairs.push({ a: best.j, b: i, quality: best.q, richness: best.r });
    }
  }
  // Pass 2 — slant rhymes may only join lines that found no true partner (Dickinson's Ring / Sun).
  const size = () => {
    const m = new Map<number, number>();
    for (let i = 0; i < n; i++) if (lines[i].rhyme) m.set(find(i), (m.get(find(i)) ?? 0) + 1);
    return m;
  };
  if (lang !== "fr") {
    let sz = size();
    for (let i = 0; i < n; i++) {
      if (!lines[i].rhyme || (sz.get(find(i)) ?? 0) > 1) continue;
      for (let j = i - 1; j >= 0 && i - j <= 4; j--) {
        if (!lines[j].rhyme || (sz.get(find(j)) ?? 0) > 1) continue;
        const { quality, richness } = compareRhyme(lines[i].rhyme!, lines[j].rhyme!, lang);
        if (quality === "slant") {
          union(i, j);
          pairs.push({ a: j, b: i, quality, richness });
          sz = size();
          break;
        }
      }
    }
  }
  // Letters in order of first appearance; singletons are unrhymed ("x").
  const counts = size();
  const relabel = new Map<number, string>();
  let li = 0;
  const letters = lines.map((l, i) => {
    if (!l.rhyme) return "";
    const g = find(i);
    if ((counts.get(g) ?? 0) < 2) return "x";
    if (!relabel.has(g)) relabel.set(g, LETTERS[li++ % LETTERS.length]);
    return relabel.get(g)!;
  });
  return { letters, pairs };
}
