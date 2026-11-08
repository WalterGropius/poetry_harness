import { streamText } from "ai";
import { gatewayOptions, hasGateway, MODELS } from "@/lib/ai/config";
import { analysisDigest, POET } from "@/lib/ai/prompts";
import { NODES } from "@/lib/atlas/nodes";
import type { Lang } from "@/lib/atlas/types";
import { offlineLensPatches } from "@/lib/genui/offline-spec";
import { lensCatalog } from "@/lib/genui/catalog";
import { fullAnalysis } from "@/lib/server/engine";
import { sleep } from "@/lib/server/ndjson";

export const maxDuration = 120;

const TYPES = new Set(lensCatalog.componentNames);

const LENS_RULES = `You compose a READING of one poem as a generative interface, using only the glyphs below. You are the master in the margin: every word you write is about THIS poem, specific, surprising, teachable. Discovery should feel accidental — point at a technique, name its history once, move on.

OUTPUT FORMAT — JSONL, one RFC 6902 JSON Patch per line, nothing else (no prose, no code fences):
{"op":"add","path":"/root","value":"spread"}
{"op":"add","path":"/elements/spread","value":{"type":"Spread","props":{"title":"…","kicker":"…","columns":"2"},"children":["s1","s2"]}}
{"op":"add","path":"/elements/s1","value":{"type":"Section","props":{"index":"01","title":"…"},"children":["a","b"]}}
Emit the root, then each element right after its parent so the reading assembles while it streams. Every child key must be defined. Every element has "children" (use [] for leaves). Props marked nullable may be null.

GLYPHS:
- Spread {title, kicker|null, columns "1"|"2"|"3"|null} — root. Title = your thesis about the poem in ≤ 8 words.
- Section {index|null, title} — 3 to 5 sections, each with 2–4 glyphs.
- Margin {text, tone "observe"|"praise"|"warn"|"dare"|null} — 1–3 sentences.
- Lines {from, to, mode "text"|"scansion"|"rhyme"|"flow"|null, caption|null} — 1-based line numbers; the engine renders them. Use "flow" to show rap-style rhyme families, "scansion" for stress grids.
- Device {node, lines[], note} — node must be an Atlas id from the list below.
- Lineage {nodes[], caption|null} — 2–6 Atlas ids, oldest first.
- Meter {caption|null}, Pentagon {caption|null}, FlowMap {caption|null} — engine instruments.
- Quote {text, source} — ≤ 2 lines of public-domain verse you know verbatim; otherwise don't.
- Compare {left, right, leftLabel, rightLabel} — a line vs a rewrite that shows one technique.
- Exercise {title, prompt, form|null} — a 10-minute exercise from this poem.
- Fork {question, options[{label, op "transpose"|"remix"|"loom"|"atlas", arg}]} — finish with one Fork. transpose arg = "lang|register-id" (registers: contemporary-rap, boom-bap, elizabethan, symbolist, romantic, poetism, folk, plain, spoken-word, imagist, baroque); remix arg ∈ reverse, mirror, erasure, cento, compress, explode, invert.

Trust the ENGINE FACTS for counts, stresses and rhymes; never contradict them, but you may interpret them (e.g. why a line breaks the metre).`;

export async function POST(req: Request) {
  const body = (await req.json()) as { prompt?: string; context?: { text?: string; lang?: Lang | "auto"; ui?: Lang; title?: string; author?: string } };
  const ctx = body.context ?? {};
  const text = (ctx.text ?? "").slice(0, 12000);
  const ui: Lang = ctx.ui ?? "en";
  const { analysis, lit } = fullAnalysis(text, ctx.lang ?? "auto", { title: ctx.title, author: ctx.author });
  const enc = new TextEncoder();

  if (!hasGateway()) {
    const patches = offlineLensPatches(analysis, ui, NODES, lit, ctx.title);
    const stream = new ReadableStream<Uint8Array>({
      async start(c) {
        for (const p of patches) {
          c.enqueue(enc.encode(JSON.stringify(p) + "\n"));
          await sleep(70);
        }
        c.close();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "x-verso-offline": "1" } });
  }

  // Atlas ids the reader may cite: what the engine lit, their neighbours, and the core canon.
  const allowed = new Set<string>(lit);
  for (const id of lit) NODES.find((n) => n.id === id)?.links.forEach((l) => allowed.add(l));
  NODES.filter((n) => n.kind === "poet" || n.kind === "movement").forEach((n) => allowed.add(n.id));
  const atlasList = NODES.filter((n) => allowed.has(n.id))
    .map((n) => `${n.id} (${n.kind}: ${n.label.en})`)
    .join(", ");
  const langName = { en: "English", fr: "French", cs: "Czech" }[ui];

  const result = streamText({
    model: MODELS.reader,
    instructions: `${POET}\n\n${LENS_RULES}\n\nATLAS IDS: ${atlasList}`,
    prompt: `Write every visible string of the reading in ${langName} (the reader's interface language), quoting the poem in its own language.${body.prompt ? `\nThe reader asks: ${body.prompt}` : ""}\n\n${ctx.title ? `“${ctx.title}”${ctx.author ? ` — ${ctx.author}` : ""}\n` : ""}POEM:\n${text}\n\nENGINE FACTS:\n${analysisDigest(analysis)}\nLit Atlas nodes: ${lit.join(", ") || "none"}`,
    reasoning: "low",
    providerOptions: gatewayOptions(["lens"]),
    abortSignal: req.signal,
    onError: ({ error }) => console.error("[lens]", error),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      let buf = "";
      const forward = (line: string) => {
        const t = line.trim().replace(/^```(?:jsonl?|json)?$/, "");
        if (!t || !t.startsWith("{")) return;
        try {
          const patch = JSON.parse(t) as { op: string; path: string; value?: { type?: string } };
          if (patch.path?.startsWith("/elements/") && patch.op === "add" && patch.value && typeof patch.value === "object" && "type" in patch.value) {
            if (!TYPES.has(String(patch.value.type))) return; // guardrail: unknown glyphs never reach the client
          }
          c.enqueue(enc.encode(JSON.stringify(patch) + "\n"));
        } catch (e) {
          if (process.env.NODE_ENV !== "production") console.warn("[lens] dropped:", (e as Error).message, JSON.stringify(t.slice(-80)));
        }
      };
      try {
        for await (const chunk of result.textStream) {
          buf += chunk;
          const parts = buf.split("\n");
          buf = parts.pop() ?? "";
          parts.forEach(forward);
        }
        forward(buf);
        const fin = await result.finishReason;
        if (process.env.NODE_ENV !== "production") console.log("[lens] finish:", fin, (await result.usage).outputTokens);
      } catch (err) {
        console.error("[lens stream]", err);
      }
      c.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
