/**
 * Metre fitting for accentual-syllabic verse (English, Czech).
 * Each line is aligned against foot templates with a small edit-distance DP whose
 * costs encode how a trained ear forgives: monosyllables are flexible, a stressed
 * syllable of a polysyllable in a weak position is a real violation.
 */
import type { Foot, MeterFit, Syllable } from "./types";

export const FEET: Record<Foot, number[]> = {
  iamb: [0, 1],
  trochee: [1, 0],
  anapest: [0, 0, 1],
  dactyl: [1, 0, 0],
  amphibrach: [0, 1, 0],
};

function subCost(s: Syllable, strong: boolean, first = false): number {
  if (s.flex) return strong ? 0.1 : 0.15;
  if (s.mono) {
    if (s.fn) return strong ? 0.3 : 0;
    return strong ? 0 : 0.3;
  }
  if (s.stress === 1) return strong ? 0 : first ? 0.35 : 1; // line-initial inversion is the commonest licence
  if (s.stress === 2) return strong ? 0.05 : 0.25;
  return strong ? 0.45 : 0;
}

function align(syls: Syllable[], tpl: number[]): { cost: number; dev: number[] } {
  const n = syls.length;
  const m = tpl.length;
  const INS = (s: Syllable) => (s.stress === 0 || s.mono || s.flex ? 0.85 : 1.3); // extra syllable
  const DEL = (strong: number) => (strong ? 1.4 : 1.0); // missing syllable
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  const bt: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (i === 0 && j === 0) continue;
      let best = Infinity;
      let move = 0;
      if (i > 0 && j > 0) {
        const c = dp[i - 1][j - 1] + subCost(syls[i - 1], tpl[j - 1] === 1, i === 1);
        if (c < best) {
          best = c;
          move = 1;
        }
      }
      if (i > 0) {
        const c = dp[i - 1][j] + INS(syls[i - 1]);
        if (c < best) {
          best = c;
          move = 2;
        }
      }
      if (j > 0) {
        const c = dp[i][j - 1] + DEL(tpl[j - 1]);
        if (c < best) {
          best = c;
          move = 3;
        }
      }
      dp[i][j] = best;
      bt[i][j] = move;
    }
  }
  const dev: number[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const mv = bt[i][j];
    if (mv === 1) {
      if (subCost(syls[i - 1], tpl[j - 1] === 1) >= 0.45) dev.push(i - 1);
      i--;
      j--;
    } else if (mv === 2) {
      dev.push(i - 1);
      i--;
    } else {
      j--;
    }
  }
  return { cost: dp[n][m], dev: dev.reverse() };
}

/** Templates for a foot type and number of feet, with the classic licences. */
function templates(foot: Foot, k: number): { tpl: number[]; licence: number }[] {
  const base = Array.from({ length: k }, () => FEET[foot]).flat();
  const out: { tpl: number[]; licence: number }[] = [{ tpl: base, licence: 0 }];
  const fem = [...base, 0];
  if (foot === "iamb" || foot === "anapest") {
    out.push({ tpl: fem, licence: 0.02 }); // feminine ending
    out.push({ tpl: [...fem, 0], licence: 0.06 });
    out.push({ tpl: base.slice(1), licence: 0.08 }); // headless
    if (foot === "anapest") out.push({ tpl: base.slice(2), licence: 0.1 });
  }
  if (foot === "trochee" || foot === "dactyl") {
    out.push({ tpl: base.slice(0, -1), licence: 0.0 }); // catalectic (Tyger Tyger, burning bright)
    if (foot === "dactyl") out.push({ tpl: base.slice(0, -2), licence: 0.02 });
    out.push({ tpl: [0, ...base], licence: 0.1 }); // anacrusis
  }
  if (foot === "amphibrach") {
    out.push({ tpl: base.slice(0, -1), licence: 0.03 });
  }
  return out;
}

const FOOT_BIAS: Record<Foot, number> = { iamb: 0, trochee: 0.01, anapest: 0.04, dactyl: 0.04, amphibrach: 0.06 };

export function fitLine(syls: Syllable[], foot: Foot): MeterFit | null {
  const counted = syls;
  if (!counted.length) return null;
  const fl = FEET[foot].length;
  let best: MeterFit | null = null;
  const kMin = Math.max(1, Math.floor(counted.length / fl) - 1);
  const kMax = Math.min(8, Math.ceil(counted.length / fl) + 1);
  for (let k = kMin; k <= kMax; k++) {
    for (const { tpl, licence } of templates(foot, k)) {
      if (!tpl.length) continue;
      const { cost, dev } = align(counted, tpl);
      const norm = cost / Math.max(tpl.length, counted.length) + licence + FOOT_BIAS[foot];
      if (!best || norm < best.cost) {
        best = { foot, feet: k, cost: norm, template: tpl.map((x) => (x ? "/" : "x")).join(""), deviations: dev };
      }
    }
  }
  return best;
}

export function bestFit(syls: Syllable[]): MeterFit | null {
  let best: MeterFit | null = null;
  for (const foot of Object.keys(FEET) as Foot[]) {
    const f = fitLine(syls, foot);
    if (f && (!best || f.cost < best.cost)) best = f;
  }
  return best;
}

export interface PoemMeter {
  foot: Foot | null;
  feet: number | null;
  regularity: number;
  perLine: (MeterFit | null)[];
  /** Runner-up foot when the ear could go either way (Czech iamb vs trochee). */
  alt: Foot | null;
  /** Share of lines whose foot count sits in the poem's one or two dominant values. */
  consistency: number;
}

/** Choose the single foot that best explains the whole poem, then report each line under it. */
export function poemMeter(lines: Syllable[][]): PoemMeter {
  const nonEmpty = lines.filter((l) => l.length);
  if (!nonEmpty.length) return { foot: null, feet: null, regularity: 0, perLine: lines.map(() => null), alt: null, consistency: 0 };
  let bestFoot: Foot | null = null;
  let bestAvg = Infinity;
  let bestPer: (MeterFit | null)[] = [];
  const ranked: { foot: Foot; avg: number }[] = [];
  for (const foot of Object.keys(FEET) as Foot[]) {
    const per = lines.map((l) => (l.length ? fitLine(l, foot) : null));
    const costs = per.filter(Boolean).map((p) => p!.cost);
    const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
    ranked.push({ foot, avg });
    if (avg < bestAvg) {
      bestAvg = avg;
      bestFoot = foot;
      bestPer = per;
    }
  }
  const feetList = bestPer.filter(Boolean).map((p) => p!.feet);
  const feet = modeOf(feetList);
  const regularity = Math.max(0, Math.min(1, 1 - bestAvg * 2.2));
  ranked.sort((a, b) => a.avg - b.avg);
  const alt = ranked[1] && ranked[1].avg - ranked[0].avg < 0.035 ? ranked[1].foot : null;
  const freq = new Map<number, number>();
  feetList.forEach((f) => freq.set(f, (freq.get(f) ?? 0) + 1));
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const topTwo = (top[0]?.[1] ?? 0) + (top[1] && Math.abs(top[1][0] - top[0][0]) === 1 ? top[1][1] : 0);
  const consistency = feetList.length ? topTwo / feetList.length : 0;
  return { foot: bestFoot, feet, regularity, perLine: bestPer, alt, consistency };
}

function modeOf(xs: number[]): number | null {
  if (!xs.length) return null;
  const m = new Map<number, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export const FEET_NAMES: Record<number, string> = {
  1: "monometer", 2: "dimeter", 3: "trimeter", 4: "tetrameter", 5: "pentameter", 6: "hexameter", 7: "heptameter", 8: "octameter",
};
