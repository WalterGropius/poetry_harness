import { Output, streamText } from "ai";
import { z } from "zod";
import { gatewayOptions, hasGateway, MODELS } from "@/lib/ai/config";
import { centoPoem } from "@/lib/ai/offline";
import { analysisDigest, chaosInstruction, describeSkeletonForPrompt, LANG_NAME, POET, registerBrief } from "@/lib/ai/prompts";
import { extractSkeleton, fitSkeleton } from "@/lib/prosody/skeleton";
import type { Lang, Skeleton } from "@/lib/prosody/types";
import { analyzeText, litNodes } from "@/lib/server/engine";
import { ndjson, sleep } from "@/lib/server/ndjson";

export const maxDuration = 180;

interface TransposeBody {
  source: { text: string; lang?: Lang | "auto"; title?: string; author?: string };
  target: { lang: Lang; register?: string; story?: string };
  fidelity?: "strict" | "loose";
  chaos?: number;
  chaosSeed?: number;
  skeleton?: Skeleton;
}

function join(lines: string[], s: Skeleton): string {
  const out: string[] = [];
  let i = 0;
  for (const n of s.stanzas) {
    out.push(lines.slice(i, i + n).join("\n"));
    i += n;
  }
  return out.filter(Boolean).join("\n\n");
}

export async function POST(req: Request) {
  const b = (await req.json()) as TransposeBody;
  const src = analyzeText(b.source.text, b.source.lang ?? "auto");
  const s = b.skeleton ?? extractSkeleton(src, { title: b.source.title, author: b.source.author });
  const n = s.lines.length;
  const fidelity = b.fidelity ?? "strict";
  const target = b.target.lang;

  return ndjson(async (emit, signal) => {
    const online = hasGateway();
    emit({ type: "meta", offline: !online, model: online ? MODELS.poet : "offline:cento", skeleton: s, source: { lang: src.lang, scheme: src.scheme, form: src.form.key } });
    let lines: string[] = [];
    if (!online) {
      const picked = centoPoem(target, s, b.chaosSeed ?? 11);
      for (const [i, p] of picked.entries()) {
        lines.push(p.text);
        emit({ type: "line", i, text: p.text, source: p.source });
        await sleep(110);
      }
    } else {
      const prompt = [
        `TRANSPOSITION. Keep the rhythm, change everything else.`,
        `Source poem (${LANG_NAME[src.lang]}) — study its moves, do not translate it:`,
        b.source.text.trim(),
        ``,
        `Engine reading of the source:`,
        analysisDigest(src),
        ``,
        `Write a NEW poem in ${LANG_NAME[target]}.`,
        b.target.story ? `Its story: ${b.target.story}.` : `Its story: your choice — but not the source's subject.`,
        registerBrief(b.target.register),
        chaosInstruction(b.chaos ?? 0, b.chaosSeed ?? 3),
        ``,
        `It must fill this skeleton exactly — ${n} lines, same stanza breaks, same rhyme letters${fidelity === "strict" ? ", same syllable counts" : ", syllables may breathe ±3"}:`,
        describeSkeletonForPrompt(s, target, fidelity),
        ``,
        `Where the source has multisyllabic or internal rhyme families, build equivalent families in the new language at the same positions. Return exactly ${n} lines; each element is one line, no numbering.`,
      ]
        .filter((x) => x !== "")
        .join("\n");
      const result = streamText({
        model: MODELS.poet,
        instructions: POET,
        prompt,
        reasoning: "medium",
        output: Output.array({ element: z.object({ text: z.string() }), minItems: n, maxItems: n }),
        providerOptions: gatewayOptions(["transpose"]),
        abortSignal: signal,
        onError: ({ error }) => console.error("[transpose]", error),
      });
      let i = 0;
      for await (const el of result.elementStream) {
        const text = (el as { text: string }).text.replace(/^\s*\d+[.)]\s*/, "").trim();
        lines.push(text);
        emit({ type: "line", i: i++, text });
      }
    }
    lines = lines.slice(0, n);
    const text = join(lines, s);
    const out = analyzeText(text, target);
    const fit = fitSkeleton(s, out);
    emit({ type: "fit", text, fit, analysis: { scheme: out.scheme, form: out.form, meter: out.meter, signature: out.signature, flow: { density: out.flow.density, multis: out.flow.multis } }, lit: litNodes(out) });
  }, req.signal);
}
