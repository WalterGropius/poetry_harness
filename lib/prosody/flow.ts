/**
 * Flow: rhyme the way rappers hear it. Rhyme families are runs of vowel sounds
 * (one to four syllables, crossing word boundaries) that recur within a few bars —
 * multisyllabic, internal, mosaic and chained rhymes, mapped onto every syllable.
 */
import type { Line, Syllable } from "./types";

export interface FlowMember {
  line: number;
  /** Index into the line's counted syllables. */
  start: number;
  len: number;
  words: number[];
  text: string;
  end: boolean; // ends at the line end
}

export interface RhymeFamily {
  id: number;
  key: string; // vowel sequence
  len: number; // syllables per unit
  members: FlowMember[];
}

export interface FlowAnalysis {
  families: RhymeFamily[];
  /** line index → family id per counted syllable (-1 = none) */
  map: Record<number, number[]>;
  density: number;
  multis: number;
  longest: number;
  internal: number;
  mosaic: number;
  chains: number;
  syllablesPerBar: number;
  bars: { line: number; syllables: number; stresses: number; rhymed: number }[];
}

const WINDOW = 4; // bars within which a repeated sound is heard as a rhyme

function counted(l: Line): Syllable[] {
  return l.syllables.filter((s) => !s.elided);
}

function vkey(s: Syllable): string {
  return (s.vowel ?? s.nucleus ?? "?").toLowerCase();
}

function strong(s: Syllable): boolean {
  return s.stress >= 1 || (s.mono && !s.fn) || !!s.flex;
}

export function analyzeFlow(lines: Line[]): FlowAnalysis {
  const real = lines.filter((l) => l.words.length);
  const syls = new Map<number, Syllable[]>(real.map((l) => [l.index, counted(l)]));
  const assigned = new Map<number, number[]>(real.map((l) => [l.index, new Array(syls.get(l.index)!.length).fill(-1)]));
  const families: RhymeFamily[] = [];
  const order = real.map((l) => l.index);
  const pos = new Map(order.map((li, k) => [li, k]));

  // Candidate units, longest first.
  for (const len of [4, 3, 2, 1]) {
    const byKey = new Map<string, FlowMember[]>();
    for (const l of real) {
      const ss = syls.get(l.index)!;
      for (let i = 0; i + len <= ss.length; i++) {
        const unit = ss.slice(i, i + len);
        if (!strong(unit[0])) continue; // a rhyme starts on a beat
        if (len === 1) {
          // single-syllable rhymes only count at the line end or on content words, with the word's coda agreeing
          const atEnd = i + len === ss.length;
          if (!atEnd) continue;
        }
        if (unit.some((s) => vkey(s) === "?" || vkey(s) === "ə") && len <= 2 && unit.every((s) => vkey(s) === "ə")) continue;
        const key = unit.map(vkey).join("-");
        const wordsIdx = [...new Set(unit.map((s) => s.word))];
        const text = wordsIdx.map((w) => l.words[w]?.text ?? "").join(" ");
        const m: FlowMember = { line: l.index, start: i, len, words: wordsIdx, text, end: i + len === ss.length };
        byKey.set(key, [...(byKey.get(key) ?? []), m]);
      }
    }
    // Strongest keys first: more members, then more stressed vowels.
    const keys = [...byKey.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [key, members] of keys) {
      // members not yet (even partly) taken
      const free = members.filter((m) => assigned.get(m.line)!.slice(m.start, m.start + m.len).every((x) => x === -1));
      // drop identical words (repetition is not rhyme) except at line ends of refrains
      // group by proximity
      free.sort((a, b) => pos.get(a.line)! - pos.get(b.line)! || a.start - b.start);
      let group: FlowMember[] = [];
      const flush = () => {
        const distinct = new Set(group.map((g) => g.text.toLowerCase()));
        if (group.length >= 2 && distinct.size >= 2) {
          // len 1 rhymes need the codas to agree too: delegate to the line-end scheme instead.
          if (len === 1) {
            const letters = new Set(group.map((g) => lines[g.line].letter));
            if (letters.size !== 1 || [...letters][0] === "x" || [...letters][0] === "") {
              group = [];
              return;
            }
          }
          // avoid overlapping inside one line
          const taken: FlowMember[] = [];
          for (const g of group) {
            const row = assigned.get(g.line)!;
            if (row.slice(g.start, g.start + g.len).every((x) => x === -1)) taken.push(g);
          }
          if (taken.length >= 2) {
            const id = families.length;
            families.push({ id, key, len, members: taken });
            for (const g of taken) {
              const row = assigned.get(g.line)!;
              for (let k = g.start; k < g.start + g.len; k++) row[k] = id;
            }
          }
        }
        group = [];
      };
      for (const m of free) {
        const last = group[group.length - 1];
        if (last && pos.get(m.line)! - pos.get(last.line)! > WINDOW) flush();
        // don't let a unit rhyme with the overlapping unit right next to it in the same line
        if (last && last.line === m.line && m.start < last.start + last.len) continue;
        group.push(m);
      }
      flush();
    }
  }

  const total = [...syls.values()].reduce((a, s) => a + s.length, 0) || 1;
  const rhymed = [...assigned.values()].reduce((a, row) => a + row.filter((x) => x >= 0).length, 0);
  const multis = families.filter((f) => f.len >= 2).length;
  const longest = families.reduce((a, f) => Math.max(a, f.len), 0);
  const internal = families.reduce((a, f) => a + f.members.filter((m) => !m.end).length, 0);
  const mosaic = families.reduce((a, f) => a + f.members.filter((m) => m.words.length >= 2).length, 0);
  const chains = families.filter((f) => new Set(f.members.map((m) => m.line)).size >= 4).length;
  const map: Record<number, number[]> = {};
  for (const [li, row] of assigned) map[li] = row;
  const bars = real.map((l) => ({
    line: l.index,
    syllables: syls.get(l.index)!.length,
    stresses: syls.get(l.index)!.filter(strong).length,
    rhymed: assigned.get(l.index)!.filter((x) => x >= 0).length,
  }));
  return {
    families,
    map,
    density: rhymed / total,
    multis,
    longest,
    internal,
    mosaic,
    chains,
    syllablesPerBar: total / Math.max(1, real.length),
    bars,
  };
}

/** Features the flow engine contributes to the Atlas. */
export function flowFeatures(f: FlowAnalysis, lineCount: number, coupletShare: number): string[] {
  const out: string[] = [];
  if (f.multis >= 2) out.push("rhyme:multisyllabic");
  if (f.mosaic >= 2) out.push("rhyme:mosaic");
  if (f.chains >= 1) out.push("rhyme:chain");
  if (f.internal >= 2) out.push("rhyme:internal");
  if (lineCount >= 8 && f.syllablesPerBar >= 9 && (f.density >= 0.3 || f.multis >= 3) && coupletShare >= 0.3) out.push("form:rap-verse");
  return out;
}
