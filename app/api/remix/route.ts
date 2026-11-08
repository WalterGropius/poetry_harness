import { generateText } from "ai";
import { gatewayOptions, hasGateway, MODELS } from "@/lib/ai/config";
import { centoPoem, rng } from "@/lib/ai/offline";
import { LANG_NAME, POET } from "@/lib/ai/prompts";
import { extractSkeleton } from "@/lib/prosody/skeleton";
import type { Lang } from "@/lib/prosody/types";
import { analyzeText } from "@/lib/server/engine";

export const maxDuration = 90;

const AI_OPS: Record<string, string> = {
  compress: "Compress the poem into a haiku-sized poem (3 lines, about 5-7-5 syllables in the poem's language) that keeps its central image and its sound.",
  explode: "Explode the poem: each line becomes a tercet that unfolds what the line only implied. Keep the order.",
  invert: "Invert the poem's register: if it is high, make it street-level; if it is plain, make it ceremonial. Same line count, same rhymes where possible.",
  answer: "Write the poem that answers this one — the addressee speaks back. Same form.",
};

export async function POST(req: Request) {
  const { text, lang, op, seed } = (await req.json()) as { text: string; lang?: Lang | "auto"; op: string; seed?: number };
  const a = analyzeText(text, lang ?? "auto");
  const stanzas = text.replace(/\r/g, "").trim().split(/\n\s*\n/).map((s) => s.split("\n"));
  const r = rng(seed ?? 5);
  switch (op) {
    case "reverse":
      return Response.json({ text: [...stanzas].reverse().map((s) => [...s].reverse().join("\n")).join("\n\n"), note: "Read from the last line up: the ending becomes the premise." });
    case "mirror":
      return Response.json({ text: stanzas.map((s) => s.map((l) => l.trim().split(/\s+/).reverse().join(" ")).join("\n")).join("\n\n"), note: "Each line reversed word by word: syntax breaks, sound remains." });
    case "erasure": {
      const out = stanzas.map((s) =>
        s
          .map((l) =>
            l
              .split(/(\s+)/)
              .map((w) => (/\s+/.test(w) ? w : r() < 0.32 ? w : "·".repeat(Math.max(1, Math.min(w.length, 6)))))
              .join(""),
          )
          .join("\n"),
      );
      return Response.json({ text: out.join("\n\n"), note: "Erasure: a third of the words survive. In the Lab you can choose them yourself.", erasure: true });
    }
    case "cento": {
      const s = extractSkeleton(a);
      const lines = centoPoem(a.lang, s, seed ?? 9);
      let i = 0;
      const t = s.stanzas.map((n) => lines.slice(i, (i += n)).map((l) => l.text).join("\n")).join("\n\n");
      return Response.json({ text: t, note: "Cento: the same skeleton refilled with lines from the library.", sources: lines.map((l) => l.source) });
    }
    default: {
      const instr = AI_OPS[op];
      if (!instr) return Response.json({ error: `unknown op ${op}` }, { status: 400 });
      if (!hasGateway()) return Response.json({ error: "This remix needs the AI Gateway (set AI_GATEWAY_API_KEY). Offline remixes: reverse, mirror, erasure, cento." }, { status: 503 });
      const res = await generateText({
        model: MODELS.poet,
        instructions: POET,
        prompt: `${instr}\nWrite in ${LANG_NAME[a.lang]}. Return only the new poem.\n\n${text}`,
        reasoning: "low",
        providerOptions: gatewayOptions([`remix:${op}`]),
        abortSignal: req.signal,
      });
      return Response.json({ text: res.text.trim(), note: instr });
    }
  }
}
