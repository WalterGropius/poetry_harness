import type { Device, FormGuess, Lang, Line } from "./types";

interface FormInput {
  lang: Lang;
  lines: Line[]; // non-empty lines only
  stanzas: number[][];
  letters: string[]; // per non-empty line
  regularity: number;
  foot: string | null;
  feet: number | null;
  devices: Device[];
}

const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

export function detectForm(f: FormInput): FormGuess {
  const n = f.lines.length;
  const counts = f.lines.map((l) => l.count);
  const sizes = f.stanzas.map((s) => s.length);
  const L = f.letters.join("");
  const notes: string[] = [];
  const refrains = f.devices.filter((d) => d.key === "device:refrain");
  const mostlyRhymed = f.letters.filter((x) => x !== "x").length / Math.max(1, n);
  const scheme = (from: number, to: number) => normalizeScheme(f.letters.slice(from, to).join(""));

  // Haiku / tanka / cinquain (syllable shapes)
  if (n === 3 && near(counts[0], 5) && near(counts[1], 7) && near(counts[2], 5)) {
    return { key: "form:haiku", confidence: counts.join() === "5,7,5" ? 0.95 : 0.7, notes: [`${counts.join("-")}`] };
  }
  if (n === 5 && near(counts[0], 5) && near(counts[1], 7) && near(counts[2], 5) && near(counts[3], 7) && near(counts[4], 7)) {
    return { key: "form:tanka", confidence: counts.join() === "5,7,5,7,7" ? 0.92 : 0.65, notes: [`${counts.join("-")}`] };
  }
  if (n === 5 && near(counts[0], 2) && near(counts[1], 4) && near(counts[2], 6) && near(counts[3], 8) && near(counts[4], 2)) {
    return { key: "form:cinquain", confidence: 0.85, notes: [`${counts.join("-")}`] };
  }
  // Limerick: AABBA, lines 3–4 short
  if (n === 5 && scheme(0, 5) === "AABBA" && counts[2] < counts[0] && counts[3] < counts[1]) {
    return { key: "form:limerick", confidence: 0.9, notes: ["AABBA", "short third and fourth lines"] };
  }
  // Sonnets
  if (n === 14) {
    const s = scheme(0, 14);
    if (/^ABAB CDCD EFEF GG$/.test(spaced(s, [4, 4, 4, 2])) || /^ABABCDCDEFEFGG$/.test(s)) {
      return { key: "form:sonnet-shakespearean", confidence: 0.96, notes: ["ABAB CDCD EFEF GG", "three quatrains and a couplet"] };
    }
    const oct = s.slice(0, 8);
    const ses = normalizeScheme(f.letters.slice(8).join(""));
    if (oct === "ABBAABBA" || oct === "ABABABAB") {
      if (/^(AABCCB|AABCBC|AABBCC)$/.test(ses)) {
        return { key: "form:sonnet-french", confidence: 0.92, notes: [`${oct} + ${f.letters.slice(8).join("")}`, "sizain CCD EED / CCD EDE"] };
      }
      return { key: "form:sonnet-petrarchan", confidence: 0.9, notes: [`octave ${oct}`, `sestet ${f.letters.slice(8).join("")}`] };
    }
    if (sizes.join() === "4,4,3,3") return { key: "form:sonnet-french", confidence: 0.6, notes: ["4-4-3-3 shape", "irregular rhyme"] };
    if (sizes.join() === "4,4,4,2") return { key: "form:sonnet-shakespearean", confidence: 0.6, notes: ["4-4-4-2 shape", "irregular rhyme"] };
    if (mostlyRhymed > 0.6) return { key: "form:sonnet-petrarchan", confidence: 0.45, notes: ["fourteen rhymed lines"] };
  }
  // Villanelle: 19 lines, refrains, 5 tercets + quatrain
  if (n === 19 && (sizes.join() === "3,3,3,3,3,4" || refrains.length >= 2)) {
    return { key: "form:villanelle", confidence: refrains.length >= 2 ? 0.93 : 0.6, notes: ["19 lines", `${refrains.length} refrains`] };
  }
  // Triolet: 8 lines, ABaAabAB with lines 1=4=7, 2=8
  if (n === 8 && refrains.some((r) => r.lines.length >= 3)) {
    return { key: "form:triolet", confidence: 0.85, notes: ["eight lines, the first returns three times"] };
  }
  // Sestina: 39 lines, six end words recurring
  if (n === 39 || (n >= 36 && sizes.filter((s) => s === 6).length >= 6)) {
    return { key: "form:sestina", confidence: 0.75, notes: ["six sestets and an envoi"] };
  }
  // Rondeau: 13–15 lines with a short refrain from the opening
  if (n >= 13 && n <= 15) {
    const first = f.lines[0].words.slice(0, 3).map((w) => w.norm).join(" ");
    const returns = f.lines.filter((l, i) => i > 0 && l.words.length <= 4 && l.words.map((w) => w.norm).join(" ").startsWith(first)).length;
    if (first && returns >= 2) return { key: "form:rondeau", confidence: 0.75, notes: ["rentrement from the opening words"] };
  }
  // Pantoum: quatrains where lines 2&4 return as 1&3 of the next stanza
  if (sizes.length >= 3 && sizes.every((s) => s === 4)) {
    let links = 0;
    for (let k = 0; k < f.stanzas.length - 1; k++) {
      const a = f.stanzas[k].map((i) => f.lines.find((l) => l.index === i)?.text.trim().toLowerCase());
      const b = f.stanzas[k + 1].map((i) => f.lines.find((l) => l.index === i)?.text.trim().toLowerCase());
      if (a[1] && a[1] === b[0] && a[3] && a[3] === b[2]) links++;
    }
    if (links >= Math.max(1, f.stanzas.length - 2)) return { key: "form:pantoum", confidence: 0.9, notes: ["interlocking repeated lines"] };
  }
  // Ghazal: couplets sharing a radif (repeated end word)
  if (sizes.length >= 4 && sizes.every((s) => s === 2)) {
    const ends = f.stanzas.map((s) => f.lines.find((l) => l.index === s[1])?.words.at(-1)?.norm);
    const radif = ends[0];
    if (radif && ends.filter((e) => e === radif).length >= Math.ceil(ends.length * 0.75)) {
      return { key: "form:ghazal", confidence: 0.85, notes: [`radif “${radif}”`] };
    }
  }
  // Terza rima: tercets ABA BCB CDC
  if (sizes.length >= 3 && sizes.filter((s) => s === 3).length >= sizes.length - 1) {
    let ok = 0;
    for (let k = 0; k < f.stanzas.length - 1; k++) {
      const a = f.stanzas[k].map((i) => f.letters[f.lines.findIndex((l) => l.index === i)]);
      const b = f.stanzas[k + 1].map((i) => f.letters[f.lines.findIndex((l) => l.index === i)]);
      if (a.length === 3 && a[0] === a[2] && a[1] !== "x" && a[1] === b[0]) ok++;
    }
    if (ok >= Math.max(1, f.stanzas.length - 2)) return { key: "form:terza-rima", confidence: 0.88, notes: ["ABA BCB CDC…"] };
  }
  // Ballad stanza: quatrains, alternating long/short lines, xAxA or ABAB
  if (sizes.length >= 1 && sizes.every((s) => s === 4)) {
    const alternating = f.stanzas.every((s) => {
      const c = s.map((i) => f.lines.find((l) => l.index === i)!.count);
      return c[0] > c[1] + 1 && c[2] > c[3] + 1;
    });
    if (alternating) return { key: "form:ballad-stanza", confidence: 0.75, notes: ["alternating four- and three-beat lines"] };
  }
  // Blank verse: unrhymed, regular iambic pentameter
  if (n >= 5 && mostlyRhymed < 0.25 && f.foot === "iamb" && f.feet === 5 && f.regularity > 0.6) {
    return { key: "form:blank-verse", confidence: 0.8, notes: ["unrhymed iambic pentameter"] };
  }
  // Couplets / quatrains
  if (n >= 2 && /^(AA|BB|CC|DD|EE|FF|GG|HH|II|JJ)+$/.test(pairsOf(L))) {
    return { key: "form:couplet", confidence: 0.7, notes: ["AA BB CC…"] };
  }
  if (sizes.length >= 1 && sizes.every((s) => s === 4) && mostlyRhymed > 0.4) {
    return { key: "form:quatrain", confidence: 0.6, notes: [`${sizes.length} quatrain${sizes.length > 1 ? "s" : ""}`] };
  }
  // Free verse
  const spread = Math.max(...counts) - Math.min(...counts);
  if (n >= 3 && (f.regularity < 0.55 || spread > 6) && mostlyRhymed < 0.5) {
    notes.push("no stable metre or rhyme");
    return { key: "form:free-verse", confidence: 0.7, notes };
  }
  return { key: "form:unknown", confidence: 0.2, notes: [`${n} lines`] };
}

/** Re-letter a scheme from A in order of appearance (so a sestet "CDECDE" becomes "ABCABC"). */
export function normalizeScheme(s: string): string {
  const map = new Map<string, string>();
  let k = 0;
  return [...s]
    .map((c) => {
      if (c === "x") return "x";
      if (!map.has(c)) map.set(c, "ABCDEFGHIJKLMNOPQRSTUVWYZ"[k++]);
      return map.get(c)!;
    })
    .join("");
}

function spaced(s: string, groups: number[]): string {
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    out.push(s.slice(i, i + g));
    i += g;
  }
  return out.join(" ");
}

function pairsOf(s: string): string {
  return s;
}
