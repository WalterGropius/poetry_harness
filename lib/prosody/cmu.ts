import "server-only";
import { dictionary } from "cmu-pronouncing-dictionary";
import type { EnLexicon } from "./en";

/** CMU Pronouncing Dictionary (134k words) folded into variant lists. Server-only: it is ~4 MB. */
let index: Map<string, string[]> | null = null;

function build(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [k, v] of Object.entries(dictionary)) {
    const base = k.replace(/\(\d+\)$/, "");
    const list = m.get(base);
    if (list) list.push(v);
    else m.set(base, [v]);
  }
  return m;
}

export const cmuLexicon: EnLexicon = (word) => {
  index ??= build();
  return index.get(word);
};

export function cmuWords(): Map<string, string[]> {
  index ??= build();
  return index;
}
