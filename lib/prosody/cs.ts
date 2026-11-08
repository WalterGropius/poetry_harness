/**
 * Czech prosody: fixed initial stress (with proclitic prepositions and enclitics),
 * syllabic r / l, vowel quantity independent of stress, rhyme with final devoicing.
 */
import { CS_ENCLITICS, CS_PROCLITICS, chunkBySpans, isFunctionWord, lower, type Token } from "./text";
import type { Ending, RhymeInfo, Syllable, Word } from "./types";

const VOWEL = "aáeéěiíoóuúůyý";
const LONG = "áéíóúůý";
const isV = (c: string | undefined) => !!c && VOWEL.includes(c);

interface Nucleus {
  start: number;
  end: number;
  long: boolean;
  v: string; // rough vowel
  syllabic?: boolean;
}

const ROUGH_V: Record<string, string> = { a: "a", á: "a", e: "e", é: "e", ě: "e", i: "i", í: "i", y: "i", ý: "i", o: "o", ó: "o", u: "u", ú: "u", ů: "u" };

/** Find syllable nuclei in a Czech word. */
export function nuclei(word: string): Nucleus[] {
  const w = lower(word);
  const out: Nucleus[] = [];
  let i = 0;
  while (i < w.length) {
    const c = w[i];
    if (isV(c)) {
      // diphthong ou (and au/eu at word start: auto, euro)
      if (c === "o" && w[i + 1] === "u") {
        out.push({ start: i, end: i + 2, long: true, v: "ou" });
        i += 2;
        continue;
      }
      if ((c === "a" || c === "e") && w[i + 1] === "u" && i === 0) {
        out.push({ start: i, end: i + 2, long: true, v: c + "u" });
        i += 2;
        continue;
      }
      out.push({ start: i, end: i + 1, long: LONG.includes(c), v: ROUGH_V[c] ?? "a" });
      i++;
      continue;
    }
    // syllabic r / l: no vowel on either side (vlk, krk, prst, srdce, mlha, Brno, rty)
    if ((c === "r" || c === "l") && w.length > 1) {
      const prev = w[i - 1];
      const next = w[i + 1];
      // Word-initial r/l before a consonant stays non-syllabic in verse (Mácha counts "lhal" as one syllable).
      const prevOk = prev !== undefined && !isV(prev);
      const nextOk = next === undefined || !isV(next);
      if (prevOk && nextOk) {
        out.push({ start: i, end: i + 1, long: false, v: c, syllabic: true });
      }
    }
    i++;
  }
  return out;
}

export interface CsLine {
  words: Word[];
  syllables: Syllable[];
  count: number;
}

export function analyzeLine(tokens: Token[]): CsLine {
  const words: Word[] = [];
  const syllables: Syllable[] = [];
  let carryStress = false; // previous token was a vowel-less or monosyllabic proclitic
  tokens.forEach((t, wi) => {
    const w = lower(t.text);
    const ns = nuclei(w);
    const fn = isFunctionWord(w, "cs");
    const nextW = lower(tokens[wi + 1]?.text ?? "");
    // "se" / "si" are reflexive enclitics unless "se" is the preposition before s-, z-, š-, ž- or a consonant cluster.
    const prepSe = (w === "se" || w === "ze" || w === "ve" || w === "ke") && /^([sšzž]|[^aáeéěiíoóuúůyý]{2})/.test(nextW);
    const enclitic = CS_ENCLITICS.has(w) && wi > 0 && !prepSe;
    const proclitic = CS_PROCLITICS.has(w) && wi < tokens.length - 1 && !enclitic;
    const chunks = ns.length > 1 ? chunkBySpans(t.text, ns.map((n) => [n.start, n.end] as [number, number]), "cs") : [t.text];
    const syls: Syllable[] = ns.map((n, k) => {
      let stress: 0 | 1 | 2 = k === 0 ? 1 : 0;
      if (enclitic) stress = 0;
      const flexed = k === 0 && carryStress; // the preposition took the stress — metrically ambivalent
      if (flexed) stress = 0;
      return {
        flex: flexed || undefined,
        text: chunks[k] ?? "",
        stress,
        mono: ns.length === 1 && !proclitic,
        fn: fn || enclitic,
        long: n.long || undefined,
        word: wi,
        nucleus: n.v,
        vowel: n.v,
      };
    });
    // Monosyllabic prepositions take the stress of the following word: "do lesa" = DO-le-sa.
    if (proclitic && ns.length === 1) {
      syls[0].stress = 1;
      syls[0].mono = false;
      syls[0].flex = true;
      carryStress = true;
    } else if (proclitic && ns.length === 0) {
      carryStress = false; // v, s, k, z: vowel-less, the next word keeps its own stress
    } else {
      carryStress = false;
    }
    syllables.push(...syls);
    words.push({ text: t.text, norm: w, syllables: syls, fn: fn || enclitic, onset: csOnset(w), start: t.start, end: t.end });
  });
  return { words, syllables, count: syllables.length };
}

function csOnset(w: string): string {
  if (!w) return "";
  if (w.startsWith("ch")) return "ch";
  if (isV(w[0])) return "";
  return phon(w[0]);
}

function phon(c: string): string {
  return ({ y: "i", ý: "i", ů: "u", w: "v", q: "k", x: "ks" } as Record<string, string>)[c] ?? c;
}

// ─── Phonemes & rhyme ─────────────────────────────────────────────────────────

const DEVOICE: Record<string, string> = { b: "p", d: "t", ď: "ť", g: "k", h: "ch", v: "f", z: "s", ž: "š", dž: "č" };
const VOICED = new Set(Object.keys(DEVOICE));

/** Czech word → phoneme list (with quantity), final devoicing applied. */
export function phonemes(word: string): string[] {
  const w = lower(word).replace(/[^a-záčďéěíňóřšťúůýž]/g, "");
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const n = w[i + 1];
    if (c === "c" && n === "h") {
      out.push("ch");
      i++;
      continue;
    }
    if (c === "d" && n === "ž") {
      out.push("dž");
      i++;
      continue;
    }
    if (c === "o" && n === "u") {
      out.push("ou");
      i++;
      continue;
    }
    if (c === "ě") {
      const prev = out[out.length - 1];
      if (prev === "d") out[out.length - 1] = "ď";
      else if (prev === "t") out[out.length - 1] = "ť";
      else if (prev === "n") out[out.length - 1] = "ň";
      else if (prev === "m") out.push("ň");
      else out.push("j");
      out.push("e");
      continue;
    }
    if ((c === "i" || c === "í") && out.length) {
      const prev = out[out.length - 1];
      if (prev === "d") out[out.length - 1] = "ď";
      else if (prev === "t") out[out.length - 1] = "ť";
      else if (prev === "n") out[out.length - 1] = "ň";
    }
    if (c === "x") {
      out.push("k", "s");
      continue;
    }
    out.push({ y: "i", ý: "í", ů: "ú", w: "v", q: "k" }[c] ?? c);
  }
  // Doubled consonants are one sound (stinných ~ jiných).
  for (let k = out.length - 1; k > 0; k--) if (out[k] === out[k - 1] && !CS_VOWEL_PH.has(out[k])) out.splice(k, 1);
  // Final devoicing of the closing obstruent cluster.
  for (let k = out.length - 1; k >= 0; k--) {
    const p = out[k];
    if (VOICED.has(p)) out[k] = DEVOICE[p];
    else if (!["s", "š", "t", "ť", "k", "p", "f", "ch", "c", "č"].includes(p)) break;
  }
  return out;
}

const CS_VOWEL_PH = new Set(["a", "á", "e", "é", "i", "í", "o", "ó", "u", "ú", "ou", "au", "eu"]);
const short = (p: string) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" } as Record<string, string>)[p] ?? p;

export function rhymeInfo(word: string): RhymeInfo {
  const w = lower(word);
  const ph = phonemes(w);
  const ns = nuclei(w);
  // Index of the last vowel phoneme (syllabic r/l count as vowels for rhyme).
  const isNuc = (i: number) => CS_VOWEL_PH.has(ph[i]) || ((ph[i] === "r" || ph[i] === "l") && !CS_VOWEL_PH.has(ph[i - 1] ?? "") && !CS_VOWEL_PH.has(ph[i + 1] ?? ""));
  // Feminine (polysyllabic) words rhyme from the penultimate vowel (odbila / svítila), masculine from the last.
  const nucIdx: number[] = [];
  for (let i = 0; i < ph.length; i++) if (isNuc(i)) nucIdx.push(i);
  const k = nucIdx.length >= 2 ? nucIdx[nucIdx.length - 2] : (nucIdx[nucIdx.length - 1] ?? Math.max(0, ph.length - 1));
  const kLast = nucIdx[nucIdx.length - 1] ?? k;
  const tail = ph.slice(k);
  const last = ph.slice(kLast);
  const onset = k > 0 && !isNuc(k - 1) ? ph[k - 1] : "";
  const ending: Ending = ns.length <= 1 ? "m" : "f";
  const display = "-" + (w.match(/[aáeéěiíoóuúůyý]+[^aáeéěiíoóuúůyý]*$/)?.[0] ?? w.slice(-2));
  return {
    tail,
    last,
    onset,
    vowel: tail[0] ?? "",
    coda: tail.slice(1),
    ending,
    display,
    word: w,
    rough: last.map(short).join("").replace(/ch/g, "h").replace(/c/g, "ts"),
    full: ph,
  };
}

/** Loose comparison ignores vowel quantity (máj ~ maj is still a rhyme for most ears). */
export function looseTail(r: RhymeInfo): string {
  return r.tail.map(short).join("|");
}
