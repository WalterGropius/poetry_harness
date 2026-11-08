/**
 * French versification: classical syllable counting (e muet, elision, diérèse/synérèse,
 * h aspiré), césure, rhyme gender and richness, and a rough grapheme→phoneme for rhymes.
 */
import { chunkBySpans, isFunctionWord, lower, type Token } from "./text";
import type { Ending, RhymeInfo, Syllable, Word } from "./types";

const VOWELS = "aàâeéèêëiîïoôuùûüyœæ";
const isV = (c: string | undefined) => !!c && VOWELS.includes(c);

/** Words beginning with an aspirated h: no elision, no liaison. */
const H_ASPIRE = new Set(
  `hache haché hagard haie haillon haine haïr hâle halle halte hamac hameau hampe hanche hangar hanter happer harangue harasser harceler hardi harem hareng hargne haricot harnais harpe hasard hâte hausse haut hautain hauteur havre hennir hérisser hérisson hernie héron héros hêtre heurt heurter hibou hideux hiérarchie hisser hocher hollande homard honte honteux hoquet horde hors hotte houblon houle houppe hourra housse houx huer huit hurler hutte hâve haler haleter halo hanneton haubert`.split(/\s+/),
);

/** -ent endings that are NOT verbal (a nasal vowel, so not an e muet). */
const ENT_NOUNS = new Set(
  `accent argent cent client comment content dent orient parent présent absent serpent souvent talent torrent vent lent couvent violent ardent prudent excellent récent urgent patient évident décent innocent indolent indulgent intelligent permanent éminent fréquent négligent occident accident moment firmament sentiment serment tourment testament monument ornement élément aliment`.split(/\s+/),
);

/** Words whose final -er sounds [ɛʁ]. */
const ER_SOUNDED = new Set(`mer fer ver cher fier hier hiver amer enfer éther cancer cuiller lucifer jupiter magister`.split(/\s+/));

/** Words whose final consonant is pronounced. */
const FINAL_SOUNDED = new Set(`fils os hélas mars ours jadis maïs oasis lys as est ouest sud net dot fat mat christ plus tous`.split(/\s+/));

const LIQUID_CLUSTER = /[bcdfgkptv][rl]$/;

const qg = (w: string) => w.replace(/qu(?=[aeiouyéèêàâîô])/g, "k").replace(/qu$/, "k").replace(/gu(?=[eiéèêy])/g, "g");

export function isVerbalEnt(word: string): boolean {
  const w = lower(word).replace(/^.*'/, "");
  if (!w.endsWith("ent") || w.length < 5) return false;
  if (ENT_NOUNS.has(w)) return false;
  if (/(aient|oient)$/.test(w)) return true;
  if (/ment$/.test(w) && w.length > 6) return false;
  return /[^aeiouyéèê]ent$/.test(w) || /[ui]ent$/.test(w);
}

function hasMuteEnding(raw: string): "e" | "es" | "ent" | null {
  const w = qg(raw);
  if (w.length >= 2 && /[^éèêaàâiîoôuûy]e$/.test(w)) return "e";
  if (w.length >= 3 && /[^éèê]es$/.test(w) && !/^(les|des|mes|tes|ses|ces)$/.test(w)) return "es";
  if (isVerbalEnt(raw)) return "ent";
  if (w.length >= 2 && /[aàâéèêiîoôuûy]es?$/.test(w)) return /s$/.test(w) ? "es" : "e";
  return null;
}

/** Does a word begin with a vowel sound (allowing elision of a preceding e)? */
export function startsWithVowelSound(word: string): boolean {
  const w = lower(word).replace(/^'+/, "");
  if (!w) return false;
  if (w[0] === "h") {
    const stem = w.replace(/'.*/, "");
    for (const h of H_ASPIRE) if (stem === h || stem.startsWith(h)) return false;
    return isV(w[1]);
  }
  if (/^(oui|onze|onzième|ouate)/.test(w)) return false;
  return isV(w[0]);
}

/** Length-preserving normalisation that turns silent vowel letters and glides into consonant markers. */
function mask(w: string): string {
  return w
    .replace(/qu(?=[aeiouyéèêàâîô])/g, "k_")
    .replace(/gu(?=[eiéèêy])/g, "g_")
    .replace(/ge(?=[aouâô])/g, "j_")
    .replace(/^y(?=[aeiouéèê])/, "J")
    .replace(/(?<=[aeiouéèêàâ])y(?=[aeiouéèêàâ])/g, "J")
    .replace(/(?<=[aeouéè])ill/g, "J__")
    .replace(/(?<=[^aeiouyéèêàâîôû])ill(?=e|es|ent|er|a|o|on|ai)/g, (m, off: number, str: string) => (/^(ville|mille|tranquille|lille|villa|million)/.test(str) ? "ill" : "iJ_"))
    .replace(/(?<=[aeou])il$/, "J_")
    .replace(/(?<=œ)il$/, "J_");
}

const SINGLE = ["eau", "œu", "oeu", "ai", "aî", "ei", "eî", "au", "eu", "eû", "ou", "où", "oû", "oi", "oî", "ui", "œ", "æ"];

/**
 * Nucleus spans inside one vowel cluster (offsets relative to the cluster).
 * prevCons: consonants before the cluster, for the consonant+liquid diérèse rule.
 */
function clusterSpans(cl: string, prevCons: string, final: boolean, isOui: boolean, after = ""): { spans: [number, number][]; dierese: boolean } {
  if (isOui) return { spans: [[0, cl.length]], dierese: false };
  let coreLen = cl.length;
  // Mute e after a vowel: joie, pensée (final), dévouement, gaieté, paiera (inside) — absorbed into the previous nucleus.
  if (cl.length > 1 && /e$/.test(cl) && !/(eau|œu|oeu)$/.test(cl) && (final || (/[aiouéy]e$/.test(cl) && /^(ment|t[ée]|r[aiou])/.test(after)))) coreLen--;
  const core = cl.slice(0, coreLen);
  const parts: [number, number][] = [];
  let i = 0;
  while (i < core.length) {
    let len = 1;
    if (!"ïëü".includes(core[i])) for (const s of SINGLE) if (core.startsWith(s, i) && s.length > len) len = s.length;
    parts.push([i, i + len]);
    i += len;
  }
  // Decide glide (synérèse → merge) or hiatus (diérèse → keep) between consecutive parts.
  const merged: [number, number][] = [];
  let dierese = false;
  for (let k = 0; k < parts.length; k++) {
    const [a0, a1] = parts[k];
    const a = core.slice(a0, a1);
    const next = parts[k + 1];
    if (!next) {
      merged.push(parts[k]);
      continue;
    }
    const b = core.slice(next[0], next[1]);
    let merge = false;
    if (a === "ï" && /^[aeéèêo]/.test(b)) merge = true; // glaïeul, aïeul
    else if ("ïëü".includes(b[0])) merge = false; // tréma marks hiatus
    else if (a === "i" || a === "y") {
      if (b.startsWith("o") || b.startsWith("a") || b.startsWith("â")) {
        dierese = true; // vi-o-lon, na-ti-on, ri-ant, di-a-mant
      } else if (LIQUID_CLUSTER.test(prevCons)) {
        dierese = true; // pri-er, ou-bli-er
      } else merge = true; // ciel, bien, pied, pitié, dieu
    } else if (a === "u") {
      dierese = true; // cru-el, nu-ée, du-el
    } else if (a === "ou") {
      dierese = true; // jou-er, é-blou-ir
    } else if (a === "oi" && b === "e") merge = true;
    if (merge) {
      parts[k + 1] = [a0, next[1]];
    } else merged.push(parts[k]);
  }
  // Absorb the stripped mute e into the last span (display only).
  if (coreLen < cl.length && merged.length) merged[merged.length - 1] = [merged[merged.length - 1][0], cl.length];
  return { spans: merged.length ? merged : [[0, cl.length]], dierese };
}

export interface FrWordCount {
  /** Nuclei excluding a final countable mute e. */
  base: number;
  /** Final mute e after a consonant (e | es | ent) — countable depending on context. */
  mute: "e" | "es" | "ent" | null;
  /** Mute e after a vowel (never counted, but feminine). */
  silentFem: boolean;
  dierese: boolean;
  /** Nucleus spans in the original word (mute e last, when countable). */
  spans: [number, number][];
}

export function countWord(word: string): FrWordCount {
  const full = lower(word);
  const segs: { text: string; offset: number }[] = [];
  let off = 0;
  for (const part of full.split("'")) {
    if (part) segs.push({ text: part, offset: off });
    off += part.length + 1;
  }
  if (!segs.length) return { base: 0, mute: null, silentFem: false, dierese: false, spans: [] };
  let base = 0;
  let dierese = false;
  const spans: [number, number][] = [];
  let result: Omit<FrWordCount, "base" | "dierese" | "spans"> = { mute: null, silentFem: false };
  segs.forEach((seg, idx) => {
    const last = idx === segs.length - 1;
    const r = countPart(qgPrefix(seg.text, last), last);
    base += r.base;
    dierese ||= r.dierese;
    r.spans.forEach(([a, b]) => spans.push([a + seg.offset, b + seg.offset]));
    if (last) result = { mute: r.mute, silentFem: r.silentFem };
  });
  return { base, dierese, spans, ...result };
}

/** Elided prefixes ending in qu' (qu', lorsqu', jusqu') carry no vowel of their own in the u. */
function qgPrefix(t: string, last: boolean): string {
  return last ? t : t.replace(/qu$/, "k_");
}

function countPart(w: string, allowMute: boolean): FrWordCount {
  if (!w) return { base: 0, mute: null, silentFem: false, dierese: false, spans: [] };
  const isOui = w === "oui";
  const mute = allowMute ? hasMuteEnding(w) : null;
  let silentFem = false;
  let strippedLen = w.length;
  let countable: FrWordCount["mute"] = null;
  if (mute) {
    const len = mute === "e" ? 1 : mute === "es" ? 2 : 3;
    const before = mask(w)[w.length - len - 1]; // masked, so the silent u of qu/gu is not a vowel
    strippedLen = w.length - len;
    if (isV(before) || before === "y") silentFem = true;
    else countable = mute;
    if (strippedLen === 0 || !/[aàâeéèêëiîïoôuùûüyœæ]/.test(mask(w).slice(0, strippedLen).replace(/[_J]/g, ""))) {
      // le, de, je, que, ne — the e is the only vowel: a counted, elidable e muet.
      return { base: 0, mute: "e", silentFem: false, dierese: false, spans: [[0, w.length]] };
    }
  }
  let stem = w.slice(0, strippedLen);
  // comiqu(e), langu(e): with the mute e gone, the u of qu/gu is still silent.
  if (mute && !silentFem) stem = stem.replace(/qu$/, "k_").replace(/gu$/, "g_");
  const m = mask(stem);
  const spans: [number, number][] = [];
  let dierese = false;
  let i = 0;
  let prevCons = "";
  while (i < m.length) {
    if (isV(m[i])) {
      let j = i;
      while (j + 1 < m.length && isV(m[j + 1])) j++;
      const final = j === m.length - 1;
      const r = clusterSpans(m.slice(i, j + 1), prevCons.replace(/[_J]/g, ""), final, isOui, m.slice(j + 1));
      r.spans.forEach(([a, b]) => spans.push([i + a, i + b]));
      dierese ||= r.dierese;
      i = j + 1;
      prevCons = "";
    } else {
      prevCons += m[i];
      i++;
    }
  }
  if (!spans.length && /[aàâeéèêëiîïoôuùûüyœæ]/.test(w)) spans.push([0, w.length]);
  // A silent feminine ending (pensé|es, joi|e) rides on the last nucleus for display.
  if (silentFem && spans.length) spans[spans.length - 1] = [spans[spans.length - 1][0], w.length];
  const base = spans.length;
  if (countable) spans.push([strippedLen, w.length]);
  return { base, mute: countable, silentFem, dierese, spans };
}

// ─── Line-level counting ─────────────────────────────────────────────────────

export interface FrLine {
  words: Word[];
  syllables: Syllable[];
  count: number;
  caesura: number | null;
  caesuraNote: string | null;
}

export function analyzeLine(tokens: Token[]): FrLine {
  const words: Word[] = [];
  const syllables: Syllable[] = [];
  let count = 0;
  tokens.forEach((t, wi) => {
    const w = lower(t.text);
    const c = countWord(w);
    const fn = isFunctionWord(w, "fr");
    const next = tokens[wi + 1];
    const isLast = wi === tokens.length - 1;
    const chunks = chunkBySpans(t.text, c.spans, "fr");
    const wordSyl: Syllable[] = [];
    for (let k = 0; k < c.base; k++) {
      wordSyl.push({ text: chunks[k] ?? "", stress: 0, mono: c.base === 1 && !c.mute, fn, word: wi, nucleus: "", dierese: c.dierese || undefined });
    }
    if (c.mute) {
      let counted: boolean;
      if (isLast) counted = false;
      else if (c.mute === "e") counted = !(next && startsWithVowelSound(next.text));
      else counted = true; // -es / -ent count before anything inside the line
      wordSyl.push({ text: chunks[c.base] ?? "e", stress: 0, mono: false, fn, word: wi, nucleus: "ə", emuet: counted || undefined, elided: !counted || undefined });
    }
    if (!fn) {
      for (let k = wordSyl.length - 1; k >= 0; k--) {
        if (!wordSyl[k].emuet && !wordSyl[k].elided) {
          wordSyl[k].stress = 2; // accent tonique of the word
          break;
        }
      }
    }
    const vowelsPh = g2p(w).filter((p) => FR_PH_VOWELS.has(p) && p !== "ə");
    let vi = 0;
    for (const s of wordSyl) if (!s.nucleus) s.nucleus = vowelsPh[vi++] ?? vowelsPh[vowelsPh.length - 1] ?? "a";
    for (const s of wordSyl) s.vowel = s.nucleus === "è" ? "e" : s.nucleus;
    const counted = wordSyl.filter((s) => !s.elided);
    count += counted.length;
    syllables.push(...wordSyl);
    words.push({ text: t.text, norm: w, syllables: counted, fn, onset: frOnset(w), start: t.start, end: t.end });
  });
  const countedAll = syllables.filter((s) => !s.elided);
  if (countedAll.length) countedAll[countedAll.length - 1].stress = 1;
  let caesura: number | null = null;
  let caesuraNote: string | null = null;
  const boundaryAfter = (n: number): boolean => {
    const s = countedAll[n - 1];
    const nx = countedAll[n];
    return !!s && !!nx && nx.word !== s.word && !s.emuet;
  };
  if (count === 12) {
    if (boundaryAfter(6)) caesura = 6;
    else caesuraNote = "the sixth syllable is inside a word or an e muet";
  } else if (count === 10) {
    caesura = [4, 6, 5].find((k) => boundaryAfter(k)) ?? null;
  }
  if (caesura) countedAll[caesura - 1].stress = 1;
  return { words, syllables, count, caesura, caesuraNote };
}

function frOnset(w: string): string {
  const s = w.replace(/^.*'/, "");
  if (!s || startsWithVowelSound(s)) return "";
  const ph = g2p(s);
  return ph[0] && !FR_PH_VOWELS.has(ph[0]) ? ph[0] : "";
}

// ─── Grapheme → phoneme (rough, for rhyme and assonance) ─────────────────────

export const FR_PH_VOWELS = new Set(["a", "e", "è", "i", "o", "u", "ü", "ö", "an", "on", "in", "ə"]);

type Rule = [RegExp, string[] | ((m: RegExpExecArray, s: string, i: number) => string[])];
const N = "(?![aeiouyéèêàâîôûnm])";
const RULES: Rule[] = [
  [/eaux?/y, ["o"]],
  [/au/y, ["o"]],
  [new RegExp(`(?:ain|aim|ein|eim)${N}`, "y"), ["in"]],
  [new RegExp(`oin${N}`, "y"), ["w", "in"]],
  [new RegExp(`ien${N}`, "y"), ["j", "in"]],
  [/oy(?=[aeiouyé])/y, ["w", "a", "j"]],
  [/oi|oî/y, ["w", "a"]],
  [/aî|ai|ei|eî|ay/y, ["è"]],
  [/ou|où|oû/y, ["u"]],
  [/œu|oeu|eu|eû|œ/y, ["ö"]],
  [new RegExp(`(?:an|am|en|em)${N}`, "y"), ["an"]],
  [new RegExp(`(?:on|om)${N}`, "y"), ["on"]],
  [new RegExp(`(?:un|um|in|im|yn|ym)${N}`, "y"), ["in"]],
  [/é/y, ["e"]],
  [/è|ê|ë/y, ["è"]],
  [/e(?=[xz]$)/y, ["e"]],
  [/e(?=t$)/y, ["è"]],
  [/e(?=r$)/y, (m, s) => (ER_SOUNDED.has(s) || (s.match(/[aàâeéèêëiîïoôuùûüyœæ]+/g) ?? []).length === 1 ? ["è"] : ["e"])],
  [/e(?=s$)/y, (m, s) => (/^(les|des|mes|tes|ses|ces)$/.test(s) ? ["e"] : ["ə"])],
  [/e$/y, ["ə"]],
  [/e(?=(?:ch|ph|th|gn|[bcdfgkptv][rl])[aeiouyéèê])/y, ["ə"]],
  [/e(?=[^aeiouyéèêàâîôû]{2})/y, ["è"]],
  [/e/y, ["ə"]],
  [/[aàâ]/y, ["a"]],
  [/[iîïy](?=[aouéèêàâô]|e[^s]|es.)/y, ["j"]],
  [/[iîïy]/y, ["i"]],
  [/[oô]/y, ["o"]],
  [/[uùûü]/y, ["ü"]],
  [/ch/y, ["š"]],
  [/ph/y, ["f"]],
  [/th/y, ["t"]],
  [/gn/y, ["ň"]],
  [/qu/y, ["k"]],
  [/gu(?=[eiéèêy])/y, ["g"]],
  [/g(?=[eiéèêy])/y, ["ž"]],
  [/g/y, ["g"]],
  [/ç/y, ["s"]],
  [/cc(?=[eiéèêy])/y, ["k", "s"]],
  [/c(?=[eiéèêy])/y, ["s"]],
  [/c/y, ["k"]],
  [/mn/y, ["n"]],
  [/ss/y, ["s"]],
  [/s/y, (m, s, i) => (isV(s[i - 1]) && isV(s[i + 1]) ? ["z"] : ["s"])],
  [/x/y, ["k", "s"]],
  [/h/y, []],
  [/ll/y, ["l"]],
  [/([bdfkmnprtvz])\1/y, (m) => [m[1]]],
  [/j/y, ["ž"]],
  [/w/y, ["w"]],
  [/[bdfklmnprtvz]/y, (m) => [m[0]]],
];

export function g2p(word: string): string[] {
  let s = lower(word).replace(/^.*'/, "").replace(/[^a-zàâäæçéèêëîïôöœùûüÿ]/g, "");
  if (!s) return [];
  if (!FINAL_SOUNDED.has(s)) {
    if (isVerbalEnt(s)) s = s.slice(0, -2); // chantent → chante
    if (/[^aeiouyéèê]es$/.test(s) && s.length > 3) s = s.slice(0, -1); // larmes → larme
    else if (s.length > 2) s = s.replace(/(?<=[^s])[sxz]$/, ""); // plural / silent s, x, z
    s = s.replace(/(?<=[aeiouyéèêàâîôûnm])(?:ct|t|d|p|g)$/, "").replace(/(?<=n)c$/, "").replace(/(?<=[aeiouyéèêàâîôûnm])(?:t|d|p)$/, "");
  }
  s = s.replace(/(?<=[aeouéè])ill/g, "y").replace(/(?<=[^aeiouyéèêàâîôû])ill(?=e|$)/g, (m, off: number, str: string) => (/^(ville|mille|tranquille|lille)/.test(str) ? "il" : "iy"));
  s = s.replace(/(?<=[aeouœ])il$/, "y");
  s = s.replace(/(?<=[aeiouyéèê])tion/, "sion").replace(/(?<=n)g(?=t|$)/, "");
  const out: string[] = [];
  let i = 0;
  outer: while (i < s.length) {
    for (const [re, emit] of RULES) {
      re.lastIndex = i;
      const m = re.exec(s);
      if (m && m.index === i) {
        const ph = typeof emit === "function" ? emit(m, s, i) : emit;
        out.push(...ph);
        i += Math.max(1, m[0].length);
        continue outer;
      }
    }
    i++;
  }
  return out.map((p) => (p === "y" ? "j" : p));
}

export function rhymeInfo(word: string): RhymeInfo {
  const w = lower(word).replace(/^.*'/, "");
  let ph = g2p(w);
  const ending: Ending = hasMuteEnding(w) ? "f" : "m";
  while (ph.length && ph[ph.length - 1] === "ə") ph = ph.slice(0, -1);
  let k = -1;
  for (let i = ph.length - 1; i >= 0; i--)
    if (FR_PH_VOWELS.has(ph[i]) && ph[i] !== "ə") {
      k = i;
      break;
    }
  if (k < 0) k = Math.max(0, ph.length - 1);
  const tail = ph.slice(k);
  const onset = k > 0 && !FR_PH_VOWELS.has(ph[k - 1]) ? ph[k - 1] : "";
  const display = "-" + (w.match(/[aàâeéèêëiîïoôuùûüyœæ]+[^aàâeéèêëiîïoôuùûüyœæ]*(?:e|es|ent)?$/)?.[0] ?? w.slice(-3));
  return { tail, last: tail, onset, vowel: tail[0] ?? "", coda: tail.slice(1), ending, display, word: w, rough: tail.join(""), full: ph };
}

/** Number of shared phonemes from the end (rime pauvre 1, suffisante 2, riche 3+). */
export function richness(a: RhymeInfo, b: RhymeInfo): number {
  const fa = a.full ?? [a.onset, ...a.tail].filter(Boolean);
  const fb = b.full ?? [b.onset, ...b.tail].filter(Boolean);
  let n = 0;
  for (let i = 1; i <= Math.min(fa.length, fb.length); i++) {
    if (fa[fa.length - i] === fb[fb.length - i]) n++;
    else break;
  }
  return n;
}
