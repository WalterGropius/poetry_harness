import "server-only";
import { analyze } from "@/lib/prosody/analyze";
import { cmuLexicon } from "@/lib/prosody/cmu";
import { extractSkeleton } from "@/lib/prosody/skeleton";
import type { Analysis, Lang } from "@/lib/prosody/types";
import { NODES } from "@/lib/atlas/nodes";

export function analyzeText(text: string, lang?: Lang | "auto"): Analysis {
  return analyze(text, { lang: lang ?? "auto", lexicon: cmuLexicon });
}

/** Atlas node ids that the analysis lights up. */
export function litNodes(a: Analysis): string[] {
  const keys = new Set(a.features);
  return NODES.filter((n) => n.engine && keys.has(n.engine)).map((n) => n.id);
}

export function fullAnalysis(text: string, lang?: Lang | "auto", meta: { title?: string; author?: string } = {}) {
  const analysis = analyzeText(text, lang);
  return { analysis, skeleton: extractSkeleton(analysis, meta), lit: litNodes(analysis) };
}
