/**
 * Skeletons: a poem's rhythm with the words taken out. Extract one from any analysis,
 * then measure how well another poem (in any of the three languages) fills it.
 */
import { compareRhyme } from "./rhyme";
import type { Analysis, Lang, LineFit, Skeleton, SkeletonFit } from "./types";

export function extractSkeleton(a: Analysis, meta: { title?: string; author?: string } = {}): Skeleton {
  const real = a.lines.filter((l) => l.words.length);
  const refrainOf = new Map<number, string>();
  let r = 0;
  for (const d of a.devices.filter((d) => d.key === "device:refrain")) {
    const id = `R${++r}`;
    d.lines.forEach((i) => refrainOf.set(i, id));
  }
  return {
    v: 1,
    title: meta.title,
    author: meta.author,
    lang: a.lang,
    stanzas: a.stanzas.map((s) => s.length),
    lines: real.map((l) => ({
      syllables: l.count,
      pattern: a.lang === "fr" ? "" : l.pattern.replace(/\\/g, "x"),
      rhyme: l.letter || "x",
      ending: l.rhyme?.ending ?? "m",
      caesura: l.caesura,
      refrain: refrainOf.get(l.index),
      endWord: l.words[l.words.length - 1]?.norm,
    })),
    meter: { foot: a.meter.foot, feet: a.meter.feet, kind: a.meter.kind },
    form: a.form.key,
  };
}

/** Human-readable one-liner, e.g. "14 × 10σ · iamb ×5 · ABAB CDCD EFEF GG". */
export function describeSkeleton(s: Skeleton): string {
  const counts = s.lines.map((l) => l.syllables);
  const uniq = [...new Set(counts)];
  const len = uniq.length === 1 ? `${s.lines.length} × ${uniq[0]}σ` : `${s.lines.length} lines (${Math.min(...counts)}–${Math.max(...counts)}σ)`;
  const meter = s.meter.foot ? `${s.meter.foot} ×${s.meter.feet}` : s.meter.kind;
  let i = 0;
  const scheme = s.stanzas
    .map((n) => {
      const part = s.lines.slice(i, i + n).map((l) => l.rhyme).join("");
      i += n;
      return part;
    })
    .join(" ");
  return `${len} · ${meter} · ${scheme}`;
}

function patternSimilarity(want: string, got: string): number {
  if (!want || !got) return 1;
  const n = Math.max(want.length, got.length);
  let same = 0;
  for (let i = 0; i < Math.min(want.length, got.length); i++) {
    if (want[i] === got[i]) same++;
    else if (got[i] === "\\") same += 0.6;
  }
  return same / n;
}

/**
 * Fit a candidate analysis against a skeleton. Cross-language rules:
 * French targets ignore stress; French sources supply no stress pattern; Czech and English
 * targets are judged on stress positions only where the skeleton has them.
 */
export function fitSkeleton(s: Skeleton, a: Analysis, opts: { offset?: number } = {}): SkeletonFit {
  const real = a.lines.filter((l) => l.words.length);
  const offset = opts.offset ?? 0;
  const target: Lang = a.lang;
  const fits: LineFit[] = real.map((l, k) => {
    const i = k + offset;
    const want = s.lines[i];
    if (!want) return { index: l.index, score: 0, syllables: { want: 0, got: l.count }, stress: null, rhyme: "free", ending: "free", notes: ["beyond the skeleton"] };
    const notes: string[] = [];
    const dSyl = Math.abs(l.count - want.syllables);
    const sylScore = dSyl === 0 ? 1 : dSyl === 1 ? 0.65 : dSyl === 2 ? 0.35 : 0.1;
    if (dSyl) notes.push(`${l.count} for ${want.syllables} syllables`);
    let stress: number | null = null;
    if (target !== "fr" && want.pattern) {
      stress = patternSimilarity(want.pattern, l.pattern);
      if (stress < 0.7) notes.push("stresses drift from the pattern");
    }
    // Rhyme: does this line rhyme with earlier lines that share its letter?
    let rhyme: LineFit["rhyme"] = "free";
    if (want.rhyme !== "x") {
      const partners = s.lines
        .map((sl, j) => ({ sl, j }))
        .filter(({ sl, j }) => j < i && sl.rhyme === want.rhyme && j - offset >= 0 && j - offset < real.length)
        .map(({ j }) => real[j - offset]);
      if (partners.length && l.rhyme) {
        const ok = partners.some((p) => p.rhyme && compareRhyme(l.rhyme!, p.rhyme, target).quality !== "none");
        rhyme = ok ? "ok" : "miss";
        if (!ok) notes.push(`should rhyme with line ${partners[0].index + 1}`);
      }
    }
    let ending: LineFit["ending"] = "free";
    if (l.rhyme && s.lang === target) {
      ending = l.rhyme.ending === want.ending ? "ok" : "miss";
      if (ending === "miss") notes.push(want.ending === "f" ? "wants a feminine ending" : "wants a masculine ending");
    }
    const caesuraOk = want.caesura && target === "fr" ? (l.caesura === want.caesura ? 1 : 0.6) : 1;
    if (caesuraOk < 1) notes.push(`césure should fall after ${want.caesura}`);
    const parts = [sylScore * (target === "fr" ? 0.55 : 0.4), (stress ?? sylScore) * (target === "fr" ? 0 : 0.25), rhyme === "miss" ? 0 : 0.25, ending === "miss" ? 0.03 : 0.08];
    const weight = target === "fr" ? 0.88 : 0.98;
    const score = Math.max(0, Math.min(1, (parts.reduce((x, y) => x + y, 0) / weight) * caesuraOk));
    return { index: l.index, score, syllables: { want: want.syllables, got: l.count }, stress, rhyme, ending, notes };
  });
  const score = fits.length ? fits.reduce((x, f) => x + f.score, 0) / fits.length : 0;
  return { score, lines: fits };
}

/** Built-in skeletons for forms, so you can write into a shape without a source poem. */
export function formSkeleton(form: string, lang: Lang): Skeleton | null {
  const L = (syllables: number, rhyme: string, pattern = "", ending: "m" | "f" = "m", caesura: number | null = null, refrain?: string) => ({ syllables, rhyme, pattern, ending, caesura, refrain });
  const iamb = (k: number) => "x/".repeat(k);
  const troch = (k: number) => "/x".repeat(k);
  const len = lang === "fr" ? 12 : lang === "cs" ? 10 : 10;
  const pat = lang === "fr" ? "" : lang === "cs" ? iamb(5) : iamb(5);
  const cs = lang === "fr" ? 6 : null;
  const mk = (stanzas: number[], lines: ReturnType<typeof L>[], foot: Skeleton["meter"]["foot"], feet: number | null, kind: Skeleton["meter"]["kind"]): Skeleton => ({
    v: 1,
    lang,
    stanzas,
    lines,
    meter: { foot, feet, kind },
    form,
  });
  switch (form) {
    case "form:sonnet-shakespearean":
      return mk([4, 4, 4, 2], [..."ABABCDCDEFEFGG"].map((r) => L(len, r, pat, "m", cs)), lang === "fr" ? null : "iamb", lang === "fr" ? null : 5, lang === "fr" ? "syllabic" : "accentual-syllabic");
    case "form:sonnet-petrarchan":
      return mk([4, 4, 3, 3], [..."ABBAABBACDECDE"].map((r) => L(len, r, pat, "m", cs)), lang === "fr" ? null : "iamb", lang === "fr" ? null : 5, lang === "fr" ? "syllabic" : "accentual-syllabic");
    case "form:sonnet-french":
      return mk([4, 4, 3, 3], [..."ABBAABBACCDEED"].map((r, i) => L(12, r, lang === "fr" ? "" : iamb(6), i % 2 ? "f" : "m", 6)), lang === "fr" ? null : "iamb", lang === "fr" ? null : 6, lang === "fr" ? "syllabic" : "accentual-syllabic");
    case "form:haiku":
      return mk([3], [L(5, "x"), L(7, "x"), L(5, "x")], null, null, "syllabic");
    case "form:tanka":
      return mk([5], [5, 7, 5, 7, 7].map((n) => L(n, "x")), null, null, "syllabic");
    case "form:cinquain":
      return mk([5], [2, 4, 6, 8, 2].map((n) => L(n, "x")), null, null, "syllabic");
    case "form:limerick":
      return mk([5], [L(8, "A", "x/xx/xx/"), L(8, "A", "x/xx/xx/"), L(5, "B", "x/xx/"), L(5, "B", "x/xx/"), L(8, "A", "x/xx/xx/")], "amphibrach", 3, "accentual-syllabic");
    case "form:villanelle": {
      const s = "ABA ABA ABA ABA ABA ABAA".replace(/ /g, "");
      const refr = ["R1", "", "R2", "", "", "R1", "", "", "R2", "", "", "R1", "", "", "R2", "", "", "R1", "R2"];
      return mk([3, 3, 3, 3, 3, 4], [...s].map((r, i) => L(len, r, pat, "m", cs, refr[i] || undefined)), lang === "fr" ? null : "iamb", lang === "fr" ? null : 5, lang === "fr" ? "syllabic" : "accentual-syllabic");
    }
    case "form:terza-rima":
      return mk([3, 3, 3, 3, 2], [..."ABABCBCDCDEDEE"].map((r) => L(len, r, pat, "m", cs)), lang === "fr" ? null : "iamb", lang === "fr" ? null : 5, lang === "fr" ? "syllabic" : "accentual-syllabic");
    case "form:quatrain":
      return mk([4], [..."ABAB"].map((r) => L(lang === "fr" ? 8 : 8, r, lang === "fr" ? "" : iamb(4))), lang === "fr" ? null : "iamb", lang === "fr" ? null : 4, lang === "fr" ? "syllabic" : "accentual-syllabic");
    case "form:ballad-stanza":
      return mk([4, 4], [..."xAxAxBxB"].map((r, i) => L(i % 2 ? 6 : 8, r, i % 2 ? iamb(3) : iamb(4))), "iamb", 4, "accentual-syllabic");
    case "form:couplet":
      return mk([2, 2, 2], [..."AABBCC"].map((r) => L(len, r, pat, "m", cs)), lang === "fr" ? null : "iamb", lang === "fr" ? null : 5, lang === "fr" ? "syllabic" : "accentual-syllabic");
    case "form:triolet":
      return mk([8], [..."ABAAABAB"].map((r, i) => L(8, r, lang === "fr" ? "" : iamb(4), "m", null, i === 0 || i === 3 || i === 6 ? "R1" : i === 1 || i === 7 ? "R2" : undefined)), lang === "fr" ? null : "iamb", 4, lang === "fr" ? "syllabic" : "accentual-syllabic");
    case "form:blank-verse":
      return mk([10], Array.from({ length: 10 }, () => L(10, "x", iamb(5))), "iamb", 5, "accentual-syllabic");
    case "form:trochaic-tetrameter":
      return mk([4], Array.from({ length: 4 }, (_, i) => L(7, "AABB"[i], troch(4).slice(0, 7))), "trochee", 4, "accentual-syllabic");
    default:
      return null;
  }
}

export const SKELETON_FORMS = [
  "form:sonnet-shakespearean",
  "form:sonnet-petrarchan",
  "form:sonnet-french",
  "form:villanelle",
  "form:terza-rima",
  "form:triolet",
  "form:ballad-stanza",
  "form:quatrain",
  "form:couplet",
  "form:blank-verse",
  "form:limerick",
  "form:haiku",
  "form:tanka",
  "form:cinquain",
] as const;
