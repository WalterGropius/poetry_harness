import * as cs from "./cs";
import { detectDevices } from "./devices";
import * as en from "./en";
import { detectForm } from "./form";
import { analyzeFlow, flowFeatures } from "./flow";
import * as fr from "./fr";
import { poemMeter } from "./meter";
import { assignScheme } from "./rhyme";
import { clamp01, detectLang, isEndStopped, isFunctionWord, lower, mode, splitLines, tokenize } from "./text";
import type { Analysis, Lang, Line, RhymeInfo, Signature, Syllable, Word } from "./types";

export interface AnalyzeOptions {
  lang?: Lang | "auto";
  /** English pronouncing lexicon (CMU). Without it English falls back to spelling heuristics. */
  lexicon?: en.EnLexicon;
}

export function rhymeFor(lang: Lang, word: string, lexicon?: en.EnLexicon): RhymeInfo {
  if (lang === "fr") return fr.rhymeInfo(word);
  if (lang === "cs") return cs.rhymeInfo(word);
  return en.rhymeInfo(word, lexicon);
}

function analyzeEnLine(text: string, lexicon?: en.EnLexicon, choice?: string[][]): { words: Word[]; syllables: Syllable[] } {
  const toks = tokenize(text);
  const words: Word[] = [];
  const syllables: Syllable[] = [];
  toks.forEach((t, wi) => {
    const syls = choice?.[wi] ? en.syllablesFrom(t.text, wi, choice[wi]) : en.syllables(t.text, wi, lexicon).syls;
    syllables.push(...syls);
    words.push({ text: t.text, norm: lower(t.text), syllables: syls, fn: isFunctionWord(t.text, "en"), onset: en.onsetOf(t.text, lexicon), start: t.start, end: t.end });
  });
  return { words, syllables };
}

const vowelCount = (ph: string[]) => ph.filter((p) => /[012]$/.test(p)).length;

/**
 * English verse often wants "ev'ry", "temp'rate", "fire" as one syllable — or the reverse.
 * Pick, per line, the pronunciation variants that bring it to the poem's own norm
 * (positional mode across stanzas, else the global mode).
 */
function chooseEnVariants(raw: string[], lexicon?: en.EnLexicon): (string[][] | undefined)[] {
  const tokLines = raw.map((l) => (l.trim() ? tokenize(l) : []));
  const variants = tokLines.map((toks) => toks.map((t) => en.phoneVariants(t.text, lexicon)));
  const counts = variants.map((ws) => ws.reduce((a, v) => a + Math.max(1, vowelCount(v[0])), 0));
  // stanza positions
  const pos: number[] = [];
  const stanzaLens: number[] = [];
  let p = 0;
  raw.forEach((l) => {
    if (!l.trim()) {
      if (p) stanzaLens.push(p);
      p = 0;
      pos.push(-1);
    } else pos.push(p++);
  });
  if (p) stanzaLens.push(p);
  const regular = stanzaLens.length >= 2 && new Set(stanzaLens).size === 1 && stanzaLens[0] > 1;
  const global = mode(counts.filter((c, i) => pos[i] >= 0)) ?? 0;
  const target = (i: number) => {
    if (!regular) return global;
    return mode(counts.filter((c, j) => pos[j] === pos[i])) ?? global;
  };
  return variants.map((ws, i) => {
    if (pos[i] < 0) return undefined;
    const choice = ws.map((v) => v[0]);
    let count = counts[i];
    const want = target(i);
    for (let step = 0; step < 3 && count !== want; step++) {
      let best: { w: number; v: string[]; d: number } | null = null;
      ws.forEach((vs, w) => {
        for (const v of vs) {
          const d = Math.abs(count - Math.max(1, vowelCount(choice[w])) + Math.max(1, vowelCount(v)) - want);
          if (d < Math.abs(count - want) && (!best || d < best.d)) best = { w, v, d };
        }
      });
      if (!best) break;
      const b = best as { w: number; v: string[]; d: number };
      count += Math.max(1, vowelCount(b.v)) - Math.max(1, vowelCount(choice[b.w]));
      choice[b.w] = b.v;
    }
    return choice;
  });
}

export function analyze(text: string, opts: AnalyzeOptions = {}): Analysis {
  const lang: Lang = !opts.lang || opts.lang === "auto" ? detectLang(text) : opts.lang;
  const raw = splitLines(text);
  // Trim leading/trailing blank lines
  while (raw.length && !raw[0].trim()) raw.shift();
  while (raw.length && !raw[raw.length - 1].trim()) raw.pop();
  const enChoice = lang === "en" ? chooseEnVariants(raw, opts.lexicon) : [];

  const lines: Line[] = [];
  const stanzas: number[][] = [];
  let stanza = 0;
  let current: number[] = [];
  raw.forEach((rawLine, index) => {
    const t = rawLine;
    if (!t.trim()) {
      if (current.length) {
        stanzas.push(current);
        current = [];
        stanza++;
      }
      lines.push({ index, stanza, text: t, words: [], syllables: [], count: 0, pattern: "", rhyme: null, letter: "", meter: null, caesura: null, endStopped: true });
      return;
    }
    let words: Word[];
    let syllables: Syllable[];
    let caesura: number | null = null;
    if (lang === "fr") {
      const r = fr.analyzeLine(tokenize(t));
      words = r.words;
      syllables = r.syllables;
      caesura = r.caesura;
    } else if (lang === "cs") {
      const r = cs.analyzeLine(tokenize(t));
      words = r.words;
      syllables = r.syllables;
      // Czech alexandrine / long lines: a word boundary in the middle
      if (r.count === 12) caesura = boundaryAt(syllables, 6) ? 6 : null;
    } else {
      const r = analyzeEnLine(t, opts.lexicon, enChoice[index]);
      words = r.words;
      syllables = r.syllables;
    }
    const counted = syllables.filter((s) => !s.elided);
    const last = words[words.length - 1];
    lines.push({
      index,
      stanza,
      text: t,
      words,
      syllables,
      count: counted.length,
      pattern: counted.map((s) => (s.stress === 1 ? "/" : s.stress === 2 ? "\\" : "x")).join(""),
      rhyme: last ? rhymeFor(lang, last.text, opts.lexicon) : null,
      letter: "",
      meter: null,
      caesura,
      endStopped: isEndStopped(t),
    });
    current.push(index);
  });
  if (current.length) stanzas.push(current);

  const real = lines.filter((l) => l.words.length);

  // Rhyme scheme
  const { letters, pairs } = assignScheme(real, lang);
  real.forEach((l, i) => (l.letter = letters[i]));
  const scheme = stanzas.map((s) => s.map((i) => lines[i].letter).join("")).join(" ");

  // Metre
  let meterInfo: Analysis["meter"];
  const syllableMode = mode(real.map((l) => l.count));
  if (lang === "fr") {
    const globalShare = real.filter((l) => l.count === syllableMode).length / Math.max(1, real.length);
    // Heterometric but regular stanzas (Verlaine's 4·4·3) are still syllabic verse.
    const sizes = stanzas.map((s) => s.length);
    let positional = 0;
    if (stanzas.length >= 2 && new Set(sizes).size === 1) {
      let ok = 0;
      for (let k = 0; k < sizes[0]; k++) {
        const col = stanzas.map((s) => lines[s[k]].count);
        const m = mode(col);
        ok += col.filter((c) => c === m).length;
      }
      positional = ok / Math.max(1, real.length);
    }
    const share = Math.max(globalShare, positional);
    meterInfo = {
      foot: null,
      feet: null,
      regularity: clamp01(share),
      kind: share >= 0.7 ? "syllabic" : "free",
      syllables: syllableMode,
    };
  } else {
    const pm = poemMeter(real.map((l) => l.syllables.filter((s) => !s.elided)));
    real.forEach((l, i) => (l.meter = pm.perLine[i]));
    const stressCounts = real.map((l) => l.syllables.filter((s) => s.stress === 1 && !(s.mono && s.fn)).length);
    const stressSpread = stressCounts.length ? Math.max(...stressCounts) - Math.min(...stressCounts) : 99;
    const consistent = pm.consistency >= 0.7 || real.length <= 2;
    const kind: Analysis["meter"]["kind"] = pm.regularity >= 0.55 && consistent ? "accentual-syllabic" : stressSpread <= 1 && real.length >= 3 ? "accentual" : "free";
    meterInfo = {
      foot: kind === "accentual-syllabic" ? pm.foot : null,
      feet: kind === "accentual-syllabic" ? pm.feet : null,
      regularity: consistent ? pm.regularity : pm.regularity * 0.6,
      kind,
      syllables: syllableMode,
      alt: kind === "accentual-syllabic" ? pm.alt : null,
    };
  }

  const rhymeOf = (w: string) => rhymeFor(lang, w, opts.lexicon);
  const devices = detectDevices(lines, lang, rhymeOf);
  const form = detectForm({
    lang,
    lines: real,
    stanzas,
    letters: real.map((l) => l.letter),
    regularity: meterInfo.regularity,
    foot: meterInfo.foot,
    feet: meterInfo.feet,
    devices,
  });

  const flow = analyzeFlow(lines);
  const coupletShare = (() => {
    const L = real.map((l) => l.letter);
    let c = 0;
    for (let i = 0; i + 1 < L.length; i += 2) if (L[i] !== "x" && L[i] === L[i + 1]) c += 2;
    return c / Math.max(1, L.length);
  })();
  const ff = flowFeatures(flow, real.length, coupletShare);
  if (ff.includes("form:rap-verse") && ["form:unknown", "form:free-verse", "form:couplet", "form:quatrain"].includes(form.key)) {
    form.key = "form:rap-verse";
    form.confidence = Math.min(0.9, 0.5 + flow.density);
    form.notes = [`${Math.round(flow.density * 100)}% of syllables rhyme`, `${flow.multis} multisyllabic families`, `${flow.syllablesPerBar.toFixed(1)} syllables per bar`];
  }
  const features = [...new Set([...collectFeatures(lang, real, meterInfo, form.key, pairs, devices), ...ff])];
  const signature = computeSignature(lang, real, letters, meterInfo, form.confidence, devices, stanzas);
  signature.sound = clamp01(signature.sound * 0.6 + Math.min(1, flow.density * 1.6) * 0.4);
  const feminine = real.filter((l) => l.rhyme?.ending === "f").length;
  return {
    lang,
    flow,
    lines,
    stanzas,
    scheme,
    pairs,
    meter: meterInfo,
    form,
    devices,
    features,
    signature,
    stats: {
      lines: real.length,
      words: real.reduce((a, l) => a + l.words.length, 0),
      syllables: real.reduce((a, l) => a + l.count, 0),
      stanzas: stanzas.length,
      rhymed: real.filter((l) => l.letter && l.letter !== "x").length,
      feminine,
      masculine: real.length - feminine,
    },
  };
}

function boundaryAt(syls: Syllable[], n: number): boolean {
  const c = syls.filter((s) => !s.elided);
  return !!c[n - 1] && !!c[n] && c[n - 1].word !== c[n].word;
}

function collectFeatures(
  lang: Lang,
  real: Line[],
  meter: Analysis["meter"],
  formKey: string,
  pairs: Analysis["pairs"],
  devices: Analysis["devices"],
): string[] {
  const f = new Set<string>();
  if (meter.kind === "accentual-syllabic" && meter.foot) f.add(`meter:${meter.foot}`);
  if (meter.kind === "syllabic") f.add("meter:syllabic");
  if (meter.kind === "accentual") f.add("meter:accentual");
  if (meter.kind === "free") f.add("meter:free");
  const sm = meter.syllables;
  const share = (pred: (l: Line) => boolean) => real.filter(pred).length / Math.max(1, real.length);
  if ((lang === "fr" || lang === "cs") && share((l) => l.count === 12) >= 0.5) f.add("line:alexandrine");
  if (lang === "fr" && share((l) => l.count === 10) >= 0.5) f.add("line:decasyllable");
  if (lang === "fr" && share((l) => l.count === 8) >= 0.5) f.add("line:octosyllable");
  if (lang !== "en" && share((l) => l.count === 11) >= 0.5) f.add("line:hendecasyllable");
  if (meter.feet && meter.kind === "accentual-syllabic") {
    const k = { 3: "line:trimeter", 4: "line:tetrameter", 5: "line:pentameter", 6: "line:hexameter" }[meter.feet];
    if (k) f.add(k);
  }
  void sm;
  // Rhyme patterns within quatrains / couplets
  const letters = real.map((l) => l.letter).join("");
  if (/(.)\1/.test(letters.replace(/x/g, "")) && /([A-Z])\1([A-Z])\2/.test(letters)) f.add("rhyme:couplet");
  if (/([A-Z])([A-Z])\1\2/.test(letters)) f.add("rhyme:cross");
  if (/([A-Z])([A-Z])\2\1/.test(letters)) f.add("rhyme:enclosed");
  if (real.length >= 4 && new Set(letters.replace(/x/g, "")).size === 1 && !letters.includes("x")) f.add("rhyme:monorhyme");
  if (formKey === "form:terza-rima") f.add("rhyme:terza");
  if (pairs.some((p) => p.quality === "rich")) f.add("rhyme:rich");
  if (pairs.some((p) => p.quality === "slant" || p.quality === "weak")) f.add("rhyme:slant");
  const rhymedLines = real.filter((l) => l.letter && l.letter !== "x");
  if (rhymedLines.some((l) => l.rhyme?.ending === "f")) f.add("rhyme:feminine");
  if (rhymedLines.some((l) => l.rhyme?.ending === "m")) f.add("rhyme:masculine");
  if (formKey !== "form:unknown") f.add(formKey);
  for (const d of devices) f.add(d.key);
  return [...f];
}

function computeSignature(
  lang: Lang,
  real: Line[],
  letters: string[],
  meter: Analysis["meter"],
  formConfidence: number,
  devices: Analysis["devices"],
  stanzas: number[][],
): Signature {
  const n = Math.max(1, real.length);
  const rhymed = letters.filter((x) => x && x !== "x").length / n;
  const soundDevices = devices.filter((d) => ["device:alliteration", "device:assonance", "rhyme:internal", "device:consonance"].includes(d.key)).length;
  const sound = clamp01(rhymed * 0.55 + Math.min(1, soundDevices / n) * 0.45);
  const measure = clamp01(meter.regularity);
  const counts = real.map((l) => l.count);
  const mean = counts.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(counts.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const lenReg = clamp01(1 - sd / Math.max(1, mean));
  const sizes = stanzas.map((s) => s.length);
  const stanzaReg = sizes.length <= 1 ? 0.6 : clamp01(1 - (new Set(sizes).size - 1) / sizes.length);
  const shape = clamp01(lenReg * 0.4 + stanzaReg * 0.25 + formConfidence * 0.35);
  const words = real.flatMap((l) => l.words);
  const content = words.filter((w) => !w.fn);
  const ttr = new Set(content.map((w) => w.norm)).size / Math.max(1, content.length);
  const density = content.length / Math.max(1, words.length);
  const image = clamp01(density * 0.6 + ttr * 0.4);
  const PRON: Record<Lang, RegExp> = {
    en: /^(i|me|my|we|us|our|you|your|thou|thee|thy|ye)$/,
    fr: /^(je|j'|me|m'|moi|mon|ma|mes|nous|tu|te|t'|toi|ton|ta|tes|vous|votre|vos)$/,
    cs: /^(já|mě|mne|mi|mně|můj|má|moje|my|nás|ty|tě|tebe|ti|tobě|tvůj|tvá|vy|vás)$/,
  };
  const addressed = real.filter((l) => l.words.some((w) => PRON[lang].test(w.norm))).length / n;
  const marks = devices.filter((d) => ["device:apostrophe", "device:rhetorical-question", "device:exclamation"].includes(d.key)).length / n;
  const voice = clamp01(addressed * 0.65 + Math.min(1, marks) * 0.35);
  return { sound, measure, shape, image, voice };
}
