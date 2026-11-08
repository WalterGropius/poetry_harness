import { isFunctionWord, lower, splitOrthographic } from "./text";
import type { Ending, RhymeInfo, Syllable } from "./types";

/** Returns ARPAbet pronunciations ("K AE1 T") for a lowercase word, or undefined. */
export type EnLexicon = (word: string) => string[] | undefined;

const ARPA_VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)([012])?$/;

/** ARPAbet → shared rough phonetic alphabet. */
const ARPA_MAP: Record<string, string> = {
  AA: "a", AE: "e", AH: "a", AO: "o", AW: "au", AY: "aj", EH: "e", ER: "er", EY: "ej", IH: "i", IY: "i", OW: "ou", OY: "oj", UH: "u", UW: "u",
  B: "b", CH: "č", D: "d", DH: "d", F: "f", G: "g", HH: "h", JH: "dž", K: "k", L: "l", M: "m", N: "n", NG: "n", P: "p", R: "r", S: "s", SH: "š",
  T: "t", TH: "t", V: "v", W: "w", Y: "j", Z: "z", ZH: "ž",
};

export interface EnPron {
  phones: string[]; // ARPAbet with stress digits
  source: "lexicon" | "guess";
}

function clean(word: string): string {
  return lower(word).replace(/^'+|'+$/g, (m) => (m === "'" ? "" : ""));
}

/** Look a word up, trying common poetic spellings (dimm'd, o'er, ev'ry, wander'st…). */
export function pronounce(word: string, lex?: EnLexicon): EnPron {
  const w = lower(word);
  const tries: string[] = [w, w.replace(/^'|'$/g, "")];
  if (w.endsWith("'d")) tries.push(w.slice(0, -2) + "ed", w.slice(0, -2) + "d");
  if (w.endsWith("'st")) tries.push(w.slice(0, -3) + "est");
  if (w.endsWith("'s")) tries.push(w.slice(0, -2));
  if (w.endsWith("s'")) tries.push(w.slice(0, -1));
  tries.push(w.replace(/'/g, ""));
  // Unknown compound or prefixed word: pronounce the stem and prepend the prefix (untrimm'd → un + trimmed).
  const PREFIXES = ["un", "re", "dis", "mis", "over", "under", "out", "be", "en", "fore", "up", "in", "im"];
  if (lex) {
    for (const t of tries) {
      const p = lex(t);
      if (p && p.length) break;
      for (const pre of PREFIXES) {
        if (!t.startsWith(pre) || t.length - pre.length < 3) continue;
        const stem = lex(t.slice(pre.length));
        const preP = lex(pre === "un" ? "un" : pre) ?? (pre === "un" ? ["AH0 N"] : undefined);
        if (stem && stem.length && preP && preP.length) {
          const pp = preP[0].replace(/[12]/g, "0");
          return { phones: (pp + " " + stem[0]).split(" "), source: "lexicon" };
        }
      }
    }
    for (const t of tries) {
      const p = lex(t);
      if (p && p.length) {
        let phones = p[0].split(" ");
        // Poetic elision with an apostrophe inside the word ("ev'ry", "heav'n", "wand'ring"): drop one unstressed vowel.
        if (/[a-z]'[a-z]/.test(w) && !w.endsWith("'s") && !w.endsWith("'d") && !w.endsWith("'st") && t === w.replace(/'/g, "")) {
          const idx = phones.findIndex((ph, i) => i > 0 && /0$/.test(ph) && ARPA_VOWEL.test(ph));
          if (idx > 0) phones = phones.filter((_, i) => i !== idx);
        }
        return { phones, source: "lexicon" };
      }
    }
  }
  return { phones: guessPhones(clean(word)), source: "guess" };
}

// ─── Guessing for out-of-lexicon words ─────────────────────────────────────────

function guessSyllableCount(w: string): number {
  const s = w.replace(/'/g, "").replace(/[^a-z]/g, "");
  if (!s) return 0;
  if (s.length <= 3) return 1;
  let base = s;
  base = base.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, (m) => m[0]);
  base = base.replace(/^y/, "");
  const groups = base.match(/[aeiouy]{1,2}/g);
  let n = groups ? groups.length : 1;
  if (/[^aeiou]le$/.test(s)) n += 0; // "table": a + le → handled by groups
  if (/(ia|io|ua|uo|eo|ea(?!d|r|s|t|n|l|m|ch))/.test(base)) n += 0;
  return Math.max(1, n);
}

/** Produce a fake ARPAbet string with the right number of vowels and a plausible stress. */
function guessPhones(w: string): string[] {
  const n = guessSyllableCount(w);
  const stressAt = n <= 2 ? 0 : /(ity|ical|ian|ious|ia|tion|sion|ic)$/.test(w) ? n - 2 : n >= 3 ? n - 3 : 0;
  const phones: string[] = [];
  const letters = w.replace(/[^a-z]/g, "");
  const first = letters[0] ?? "";
  if (first && !/[aeiouy]/.test(first)) phones.push(first.toUpperCase());
  for (let i = 0; i < n; i++) phones.push(`AH${i === stressAt ? 1 : 0}`);
  // Spell-based coda so rhymes still work.
  const coda = (letters.match(/[^aeiouy]*$/)?.[0] ?? "").replace(/e$/, "");
  for (const c of coda) phones.push(c.toUpperCase());
  return phones;
}

// ─── Syllables ───────────────────────────────────────────────────────────────

/** All pronunciations worth trying metrically: lexicon variants plus poetic syncope (ev'ry, temp'rate, fire as one). */
export function phoneVariants(word: string, lex?: EnLexicon): string[][] {
  const w = lower(word);
  const base = pronounce(word, lex);
  const out: string[][] = [base.phones];
  if (lex && base.source === "lexicon") {
    for (const t of [w, w.replace(/'/g, "")]) {
      const all = lex(t);
      if (all) for (const v of all.slice(1)) out.push(v.split(" "));
    }
  }
  // Syncope: drop an unstressed vowel that sits between a stressed vowel and another vowel.
  for (const ph of [...out]) {
    const vIdx = ph.map((p, i) => (ARPA_VOWEL.test(p) ? i : -1)).filter((i) => i >= 0);
    for (let k = 1; k < vIdx.length - 0; k++) {
      const i = vIdx[k];
      const prev = ph[vIdx[k - 1]];
      const isWeak = /^(ER|AH|IH)0$/.test(ph[i]);
      const glideAfterDiph = /^(AY|AW|OW)1$/.test(prev) && vIdx[k - 1] === i - 1; // fire, hour, flower
      const between = k < vIdx.length - 1 && /[12]$/.test(prev);
      if (isWeak && (glideAfterDiph || between)) out.push(ph.filter((_, j) => j !== i));
    }
  }
  // Keep one per syllable count.
  const seen = new Set<number>();
  return out.filter((ph) => {
    const n = ph.filter((p) => ARPA_VOWEL.test(p)).length;
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

export function syllablesFrom(word: string, wordIndex: number, phones: string[]): Syllable[] {
  return buildSyllables(word, wordIndex, phones);
}

export function syllables(word: string, wordIndex: number, lex?: EnLexicon): { syls: Syllable[]; phones: string[] } {
  const { phones } = pronounce(word, lex);
  return { syls: buildSyllables(word, wordIndex, phones), phones };
}

function buildSyllables(word: string, wordIndex: number, phones: string[]): Syllable[] {
  const vowels = phones.filter((p) => ARPA_VOWEL.test(p));
  const n = Math.max(1, vowels.length);
  const fn = isFunctionWord(word, "en");
  const mono = n === 1;
  const chunks = splitOrthographic(word, n, /[aeiouyAEIOUY]/, "en");
  const syls: Syllable[] = vowels.map((v, i) => {
    const m = v.match(ARPA_VOWEL)!;
    let stress = Number(m[2] ?? 0) as 0 | 1 | 2;
    if (mono) stress = fn ? 0 : 1;
    return {
      text: chunks[i] ?? "",
      stress,
      mono,
      fn,
      word: wordIndex,
      nucleus: ARPA_MAP[m[1]] ?? "a",
      vowel: m[2] === "0" && /^(AH|IH|ER)$/.test(m[1]) && !mono ? "ə" : m[1],
    };
  });
  if (!syls.length) {
    syls.push({ text: word, stress: fn ? 0 : 1, mono: true, fn, word: wordIndex, nucleus: "a" });
  }
  return syls;
}

export function onsetOf(word: string, lex?: EnLexicon): string {
  const { phones, source } = pronounce(word, lex);
  const first = phones[0];
  if (source === "guess") {
    const l = lower(word).replace(/[^a-z]/g, "");
    if (/^[aeiouy]/.test(l)) return "";
    if (/^(ch|sh|th|ph|wh)/.test(l)) return { ch: "č", sh: "š", th: "t", ph: "f", wh: "w" }[l.slice(0, 2)] ?? l[0];
    return l[0] ?? "";
  }
  if (!first || ARPA_VOWEL.test(first)) return "";
  return ARPA_MAP[first] ?? first.toLowerCase();
}

// ─── Rhyme ───────────────────────────────────────────────────────────────────

export function rhymeInfo(word: string, lex?: EnLexicon): RhymeInfo {
  const { phones, source } = pronounce(word, lex);
  const w = lower(word).replace(/[^a-z']/g, "");
  if (source === "guess") return { ...spellingRhyme(w), guessed: true };
  // Last stressed vowel (1 or 2); if none, last vowel.
  let k = -1;
  for (let i = phones.length - 1; i >= 0; i--) {
    const m = phones[i].match(ARPA_VOWEL);
    if (m && (m[2] === "1" || m[2] === "2")) {
      k = i;
      break;
    }
  }
  const lastV = (() => {
    for (let i = phones.length - 1; i >= 0; i--) if (ARPA_VOWEL.test(phones[i])) return i;
    return -1;
  })();
  if (k < 0) k = lastV;
  if (k < 0) return spellingRhyme(w);
  const strip = (p: string) => p.replace(/[012]$/, "");
  // "fire" (AY ER) and "aspire" (AY R) are the same rhyme: a weak ER after a diphthong is just R.
  const norm = (ps: string[]) => ps.map((p, i) => (p === "ER0" && /^(AY|AW|OW)[012]$/.test(ps[i - 1] ?? "") ? "R" : strip(p)));
  const tail = norm(phones.slice(k));
  const last = norm(phones.slice(lastV));
  const onset = k > 0 && !ARPA_VOWEL.test(phones[k - 1]) ? strip(phones[k - 1]) : "";
  const ending: Ending = lastV > k ? "f" : "m";
  const display = "-" + spellingTail(w);
  // Precise comparison uses ARPAbet itself; the rough alphabet is only for cross-language play.
  return {
    tail,
    last,
    onset,
    vowel: strip(phones[k]),
    coda: phones.slice(k + 1).filter((p) => !ARPA_VOWEL.test(p)).map(strip),
    ending,
    display,
    word: w,
    rough: last.map((p) => ARPA_MAP[p] ?? p.toLowerCase()).join(""),
  };
}

function spellingTail(w: string): string {
  const s = w.replace(/'/g, "");
  const m = s.match(/[aeiouy]+[^aeiouy]*e?s?$/);
  return m ? m[0] : s.slice(-3);
}

/** Rhyme by spelling when the lexicon doesn't know the word (thou ow'st / grow'st). */
function spellingRhyme(w: string): RhymeInfo {
  const s = w.replace(/'/g, "");
  const tailStr = spellingTail(w);
  const vowel = tailStr.match(/^[aeiouy]+/)?.[0] ?? "a";
  const coda = [...tailStr.slice(vowel.length)];
  const before = s.slice(0, s.length - tailStr.length);
  return {
    tail: [vowel, ...coda],
    last: [vowel, ...coda],
    onset: before.slice(-1),
    vowel,
    coda,
    ending: "m",
    display: "-" + tailStr,
    word: w,
    rough: tailStr.replace(/e$/, ""),
  };
}
