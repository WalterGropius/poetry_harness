import "server-only";
/**
 * The parallel lexicon: every word's rhymes in its own language and its sound-twins in the
 * other two, through one rough phonetic alphabet shared by English, French and Czech.
 */
import { CS_WORDS } from "@/lib/lexicon/cs-words";
import { FR_WORDS } from "@/lib/lexicon/fr-words";
import { cmuWords } from "@/lib/prosody/cmu";
import { rhymeFor } from "@/lib/prosody/analyze";
import { cmuLexicon } from "@/lib/prosody/cmu";
import { compareRhyme } from "@/lib/prosody/rhyme";
import { looseTail } from "@/lib/prosody/cs";
import { POEMS } from "@/lib/corpus/poems";
import type { Lang, RhymeInfo } from "@/lib/prosody/types";

interface Entry {
  word: string;
  r: RhymeInfo;
  /** 0–3: attested in the library (3), inflects like a common word (2), plural only (1). */
  common: number;
}

const tailKey = (lang: Lang, r: RhymeInfo) => (lang === "cs" ? looseTail(r) : r.tail.join("|"));

const idx = new Map<Lang, { byTail: Map<string, Entry[]>; byRough: Map<string, Entry[]>; all: Entry[] }>();

function corpusWords(lang: Lang): Set<string> {
  const s = new Set<string>();
  for (const p of POEMS.filter((p) => p.lang === lang)) for (const w of p.text.toLowerCase().match(/[\p{L}']+/gu) ?? []) s.add(w);
  return s;
}

function build(lang: Lang) {
  const hit = idx.get(lang);
  if (hit) return hit;
  const corpus = corpusWords(lang);
  let words: string[];
  if (lang === "en") {
    words = [...cmuWords().keys()].filter((w) => /^[a-z]{2,12}$/.test(w));
  } else words = lang === "fr" ? FR_WORDS : CS_WORDS;
  const byTail = new Map<string, Entry[]>();
  const byRough = new Map<string, Entry[]>();
  const all: Entry[] = [];
  const cmu = lang === "en" ? cmuWords() : null;
  const commonness = (w: string): number => {
    if (corpus.has(w)) return 3;
    if (!cmu) return 2;
    // CMU is full of names; real words inflect (-ed, -ing, -ly, -er), names mostly don't.
    if (["ed", "ing", "ly", "er", "ness"].some((x) => cmu.has(w + x) || cmu.has(w.replace(/e$/, "") + x))) return 2;
    return cmu.has(w + "s") ? 1 : 0;
  };
  for (const w of words) {
    const r = rhymeFor(lang, w, cmuLexicon);
    const e = { word: w, r, common: commonness(w) };
    all.push(e);
    const tk = tailKey(lang, r);
    byTail.set(tk, [...(byTail.get(tk) ?? []), e]);
    const rk = roughKey(r.rough);
    if (rk) byRough.set(rk, [...(byRough.get(rk) ?? []), e]);
  }
  const v = { byTail, byRough, all };
  idx.set(lang, v);
  return v;
}

/** Collapse the rough alphabet further so cross-language twins can meet. */
function roughKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áà]/g, "a")
    .replace(/[éèêě]/g, "e")
    .replace(/[íý]/g, "i")
    .replace(/[óô]/g, "o")
    .replace(/[úůü]/g, "u")
    .replace(/ö/g, "e")
    .replace(/(ch|h)$/, "h")
    .replace(/[dt]$/, "t")
    .replace(/[bp]$/, "p")
    .replace(/[gk]$/, "k")
    .replace(/[zs]$/, "s")
    .replace(/[žš]$/, "š")
    .replace(/(.)\1+/g, "$1");
}

/** Prefer short, corpus-attested words; English CMU is full of names, so lean on length. */
function rank(list: Entry[], query: string): string[] {
  return [...new Set(list.filter((e) => e.word !== query).sort((a, b) => b.common - a.common || Math.abs(a.word.length - 6) - Math.abs(b.word.length - 6) || a.word.localeCompare(b.word)).map((e) => e.word))].slice(0, 36);
}

export function babel(word: string, lang: Lang) {
  const w = word.toLowerCase().trim();
  const r = rhymeFor(lang, w, cmuLexicon);
  const own = build(lang);
  const perfect = own.byTail.get(tailKey(lang, r)) ?? [];
  // near rhymes: same vowel + last consonant class
  const near = own.all.filter((e) => e.word !== w && !perfect.includes(e) && compareRhyme(e.r, r, lang).quality === "slant").slice(0, 200);
  const twins: Partial<Record<Lang, string[]>> = {};
  for (const other of (["en", "fr", "cs"] as Lang[]).filter((l) => l !== lang)) {
    const ix = build(other);
    twins[other] = rank(ix.byRough.get(roughKey(r.rough)) ?? [], w).slice(0, 24);
  }
  return { word: w, lang, display: r.display, rough: r.rough, ending: r.ending, rhymes: rank(perfect, w), near: rank(near, w).slice(0, 18), twins };
}
