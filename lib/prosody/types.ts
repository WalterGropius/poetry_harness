import type { Lang } from "@/lib/atlas/types";

export type { Lang };

/** A single counted (or elided) syllable. */
export interface Syllable {
  /** Orthographic chunk shown in scansion (may be "" for elided e muet). */
  text: string;
  /** 1 = strong, 2 = secondary, 0 = weak. */
  stress: 0 | 1 | 2;
  /** Belongs to a monosyllabic word (metrically flexible). */
  mono: boolean;
  /** Belongs to a function word (article, preposition, pronoun…). */
  fn: boolean;
  /** Czech vowel quantity (á é í ó ú ů ý, ou). */
  long?: boolean;
  /** French e muet that IS counted. */
  emuet?: boolean;
  /** French e muet that is NOT counted (elided, or line-final). */
  elided?: boolean;
  /** French diérèse applied inside this word. */
  dierese?: boolean;
  /** Metrically ambivalent (Czech proclitic groups): cheap in either position. */
  flex?: boolean;
  /** Index of the word inside the line. */
  word: number;
  /** Rough vowel nucleus in the shared phonetic alphabet (for assonance). */
  nucleus: string;
  /** Precise vowel identity for the language (ARPAbet for English) — used by the flow engine. */
  vowel?: string;
}

export interface Word {
  text: string;
  norm: string;
  /** Counted syllables only (elided ones are kept in Line.syllables with elided flag). */
  syllables: Syllable[];
  fn: boolean;
  /** Initial consonant sound (shared alphabet) — for alliteration. */
  onset: string;
  /** Character offsets within the line text. */
  start: number;
  end: number;
}

export interface MeterFit {
  foot: Foot;
  feet: number;
  /** Normalised cost: 0 = perfect fit. */
  cost: number;
  /** Template that won, using "x" (weak) and "/" (strong). */
  template: string;
  /** Indices of syllables that deviate from the template. */
  deviations: number[];
}

export type Foot = "iamb" | "trochee" | "anapest" | "dactyl" | "amphibrach";

export type RhymeQuality = "identical" | "rich" | "perfect" | "weak" | "slant" | "none";
export type Ending = "m" | "f";

export interface RhymeInfo {
  /** Phonemes from the rhyme vowel to the end (shared alphabet). */
  tail: string[];
  /** Phonemes of the last syllable (vowel + coda). */
  last: string[];
  /** Consonant(s) right before the rhyme vowel — "consonne d'appui". */
  onset: string;
  vowel: string;
  coda: string[];
  ending: Ending;
  /** Display form of the rhyming part, e.g. "-ay", "-ère", "-ách". */
  display: string;
  /** Normalised word for identity checks. */
  word: string;
  /** Last syllable in the shared rough phonetic alphabet (cross-language rhymes). */
  rough: string;
  /** Whole-word phonemes (French/Czech richness). */
  full?: string[];
  /** English: pronunciation came from spelling, not the lexicon. */
  guessed?: boolean;
}

export interface Line {
  index: number;
  stanza: number;
  text: string;
  words: Word[];
  /** All syllables in order, including elided (flagged). */
  syllables: Syllable[];
  /** Metrical syllable count (elided excluded). */
  count: number;
  /** Stress pattern of counted syllables: "/" strong, "\\" secondary, "x" weak. */
  pattern: string;
  rhyme: RhymeInfo | null;
  /** Rhyme letter (A, B, …) or "x" for unrhymed, "" for blank lines. */
  letter: string;
  meter: MeterFit | null;
  /** French/Czech caesura position (syllables before it), if any. */
  caesura: number | null;
  /** True when the line ends with punctuation. */
  endStopped: boolean;
}

export interface Device {
  key: string; // EngineKey
  lines: number[];
  /** Short evidence, e.g. "s s s", "Ô", "the same first word". */
  evidence: string;
  /** Word indices highlighted per line. */
  words?: Record<number, number[]>;
}

export interface RhymePair {
  a: number;
  b: number;
  quality: RhymeQuality;
  /** French richness: number of shared phonemes (1 pauvre, 2 suffisante, 3+ riche). */
  richness: number;
}

export interface FormGuess {
  key: string; // EngineKey of form, or "form:unknown"
  confidence: number;
  notes: string[];
}

export interface Signature {
  sound: number;
  measure: number;
  shape: number;
  image: number;
  voice: number;
}

export interface Analysis {
  lang: Lang;
  /** Rap-style rhyme families across every syllable (multis, internals, mosaics). */
  flow: import("./flow").FlowAnalysis;
  lines: Line[];
  /** Indices of lines per stanza (blank lines excluded). */
  stanzas: number[][];
  scheme: string;
  pairs: RhymePair[];
  meter: {
    foot: Foot | null;
    feet: number | null;
    regularity: number;
    kind: "accentual-syllabic" | "syllabic" | "accentual" | "free";
    /** Dominant syllable count (mode). */
    syllables: number | null;
    /** A second reading the ear may hear (e.g. Czech iamb ↔ trochee). */
    alt?: Foot | null;
  };
  form: FormGuess;
  devices: Device[];
  /** EngineKeys detected — light up Atlas nodes. */
  features: string[];
  signature: Signature;
  stats: {
    lines: number;
    words: number;
    syllables: number;
    stanzas: number;
    rhymed: number;
    feminine: number;
    masculine: number;
  };
}

/** A language-neutral rhythm template extracted from a poem ("export its rhythm to a different story"). */
export interface Skeleton {
  v: 1;
  title?: string;
  author?: string;
  lang: Lang;
  stanzas: number[];
  lines: SkeletonLine[];
  meter: { foot: Foot | null; feet: number | null; kind: Analysis["meter"]["kind"] };
  form: string;
}

export interface SkeletonLine {
  syllables: number;
  /** "x/" pattern of the source line ("" when the source is syllabic only). */
  pattern: string;
  rhyme: string;
  ending: Ending;
  caesura: number | null;
  /** Refrain id when the line repeats (A1, A2, …). */
  refrain?: string;
  /** Source end word (for sestina-like end-word constraints). */
  endWord?: string;
}

export interface LineFit {
  index: number;
  score: number;
  syllables: { want: number; got: number };
  stress: number | null;
  rhyme: "ok" | "miss" | "free";
  ending: "ok" | "miss" | "free";
  notes: string[];
}

export interface SkeletonFit {
  score: number;
  lines: LineFit[];
}
