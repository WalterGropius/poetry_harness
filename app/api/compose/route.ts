import { Output, streamText } from "ai";
import { z } from "zod";
import { gatewayOptions, hasGateway, MODELS } from "@/lib/ai/config";
import { centoCandidates, centoPoem } from "@/lib/ai/offline";
import { chaosInstruction, describeSkeletonForPrompt, LANG_NAME, POET, registerBrief, STEERS } from "@/lib/ai/prompts";
import { NODES } from "@/lib/atlas/nodes";
import { formSkeleton } from "@/lib/prosody/skeleton";
import { fitSkeleton } from "@/lib/prosody/skeleton";
import type { Lang, Skeleton } from "@/lib/prosody/types";
import { analyzeText } from "@/lib/server/engine";
import { ndjson, sleep } from "@/lib/server/ndjson";

export const maxDuration = 120;

interface ComposeBody {
  mode: "draft" | "next" | "vary";
  lang: Lang;
  seed: { subject: string; register?: string; voice?: string; constraints?: string };
  form?: string;
  skeleton?: Skeleton;
  lines?: string[];
  index?: number;
  steer?: string[];
  chaos?: number;
  chaosSeed?: number;
  k?: number;
  rejected?: string[];
}

const TECHNIQUES = NODES.filter((n) => ["device", "meter", "concept", "constraint"].includes(n.kind)).map((n) => n.id);

function skeletonFor(b: ComposeBody): Skeleton | null {
  if (b.skeleton) return b.skeleton;
  if (b.form) return formSkeleton(b.form, b.lang);
  return null;
}

/** Lines as a poem text with the skeleton's stanza breaks. */
function withStanzas(lines: string[], s: Skeleton | null): string {
  if (!s) return lines.join("\n");
  const out: string[] = [];
  let i = 0;
  for (const n of s.stanzas) {
    const chunk = lines.slice(i, i + n);
    if (!chunk.length) break;
    out.push(chunk.join("\n"));
    i += n;
  }
  if (i < lines.length) out.push(lines.slice(i).join("\n"));
  return out.join("\n\n");
}

function scoreLine(b: ComposeBody, s: Skeleton | null, lines: string[], index: number) {
  const a = analyzeText(withStanzas(lines, s), b.lang);
  const real = a.lines.filter((l) => l.words.length);
  const line = real[index];
  if (!s || !line) return { score: null as number | null, notes: [] as string[], line: line ? { count: line.count, pattern: line.pattern, letter: line.letter } : null };
  const fit = fitSkeleton(s, a);
  const lf = fit.lines[index];
  return { score: lf?.score ?? null, notes: lf?.notes ?? [], line: { count: line.count, pattern: line.pattern, letter: line.letter } };
}

function scoreDraft(b: ComposeBody, s: Skeleton | null, text: string) {
  const a = analyzeText(text, b.lang);
  const fit = s ? fitSkeleton(s, a) : null;
  return { score: fit?.score ?? null, scheme: a.scheme, form: a.form.key, meter: a.meter, signature: a.signature, notes: fit ? fit.lines.flatMap((l) => l.notes).slice(0, 4) : [] };
}

export async function POST(req: Request) {
  const b = (await req.json()) as ComposeBody;
  const s = skeletonFor(b);
  const lines = (b.lines ?? []).map((l) => l.trim()).filter(Boolean);
  const k = Math.min(Math.max(b.k ?? (b.mode === "draft" ? 2 : 4), 1), 6);
  const chaos = Math.max(0, Math.min(1, b.chaos ?? 0));
  const chaosSeed = b.chaosSeed ?? Date.now() % 100000;
  const index = b.mode === "vary" ? (b.index ?? lines.length - 1) : lines.length;

  return ndjson(async (emit, signal) => {
    const online = hasGateway();
    emit({ type: "meta", offline: !online, model: online ? MODELS.poet : "offline:cento" });

    // ── Offline twin: cento from the library ────────────────────────────────
    if (!online) {
      if (b.mode === "draft") {
        if (!s) throw new Error("Offline drafting needs a form or skeleton — pick one and the library will assemble a cento.");
        for (let c = 0; c < k; c++) {
          const picked = centoPoem(b.lang, s, chaosSeed + c * 101);
          const text = withStanzas(picked.map((p) => p.text), s);
          emit({ type: "candidate", id: `d${c}`, text, move: "cento — assembled from the public-domain library", sources: picked.map((p) => p.source), fit: scoreDraft(b, s, text) });
          await sleep(120);
        }
        return;
      }
      const want = s?.lines[index];
      const partnerIdx = want && want.rhyme !== "x" ? s!.lines.findIndex((l, i) => i < index && l.rhyme === want.rhyme) : -1;
      const partner = partnerIdx >= 0 && lines[partnerIdx] ? analyzeText(lines[partnerIdx], b.lang).lines.find((l) => l.words.length)?.rhyme : null;
      const base = b.mode === "vary" ? lines.filter((_, i) => i !== index) : lines;
      const picks = centoCandidates(b.lang, { syllables: want?.syllables ?? 8, rhymeWith: partner, tolerance: 2 }, new Set([...base, ...(b.rejected ?? [])]), k, chaosSeed);
      for (const [c, p] of picks.entries()) {
        const next = [...lines];
        if (b.mode === "vary") next[index] = p.text;
        else next.push(p.text);
        emit({ type: "candidate", id: `l${c}`, text: p.text, move: `cento — ${p.source}`, technique: "cento", fit: scoreLine(b, s, next, index) });
        await sleep(90);
      }
      return;
    }

    // ── Online: the poet through the gateway ────────────────────────────────
    const steer = (b.steer ?? []).map((x) => STEERS[x]).filter(Boolean).join(" ");
    const chaosLine = chaosInstruction(chaos, chaosSeed);
    const contract = s ? describeSkeletonForPrompt(s, b.lang, "strict") : "Free form; choose line lengths deliberately.";
    const common = [
      `Write in ${LANG_NAME[b.lang]}.`,
      `Subject / story: ${b.seed.subject || "(the poet's choice)"}.`,
      registerBrief(b.seed.register),
      b.seed.voice ? `Voice: ${b.seed.voice}.` : "",
      b.seed.constraints ? `Constraints: ${b.seed.constraints}.` : "",
      steer,
      chaosLine,
    ]
      .filter(Boolean)
      .join("\n");

    let prompt: string;
    let element;
    if (b.mode === "draft") {
      prompt = `${common}\n\nThe form, line by line:\n${contract}\n\nWrite ${k} complete, different drafts. Each draft: the poem's lines separated by \\n, stanzas separated by a blank line (\\n\\n). "move": one sentence naming the poem's central move. "technique": one Atlas id from this list that the draft leans on: ${TECHNIQUES.slice(0, 80).join(", ")}.`;
      element = z.object({ text: z.string(), move: z.string(), technique: z.string() });
    } else {
      const want = s?.lines[index];
      const partners = want && want.rhyme !== "x" ? s!.lines.map((l, i) => (i < index && l.rhyme === want.rhyme ? lines[i] : null)).filter(Boolean) : [];
      const target = want
        ? `Line ${index + 1} must have ${want.syllables} syllables${b.lang !== "fr" && want.pattern ? ` (stresses ${want.pattern})` : ""}${partners.length ? ` and rhyme with: ${partners.map((p) => `“${p}”`).join(", ")}` : want.rhyme === "x" ? ", unrhymed" : ` and open rhyme ${want.rhyme}`}${want.refrain && s!.lines.findIndex((l) => l.refrain === want.refrain) < index ? `. It is refrain ${want.refrain}: repeat that earlier line exactly, or vary it by one word at most` : ""}.`
        : "Continue with one line.";
      const poemSoFar = lines.map((l, i) => `${i + 1}. ${l}`).join("\n") || "(empty — this is the first line)";
      prompt =
        b.mode === "next"
          ? `${common}\n\nThe whole form:\n${contract}\n\nThe poem so far:\n${poemSoFar}\n\n${target}\n\nOffer ${k} genuinely different candidates for line ${index + 1} — different images, different syntax, not paraphrases. "move": 3–8 words naming what the line does. "technique": one Atlas id from: ${TECHNIQUES.slice(0, 80).join(", ")}.${b.rejected?.length ? `\nThe author rejected these; go elsewhere: ${b.rejected.slice(-6).map((r) => `“${r}”`).join(", ")}` : ""}`
          : `${common}\n\nThe whole form:\n${contract}\n\nThe poem:\n${poemSoFar}\n\nRewrite line ${index + 1} (“${lines[index]}”). ${target}\n\nOffer ${k} variations that keep what is alive in it and change one thing each. "move": 3–8 words. "technique": one Atlas id from: ${TECHNIQUES.slice(0, 80).join(", ")}.`;
      element = z.object({ text: z.string(), move: z.string(), technique: z.string() });
    }

    const result = streamText({
      model: MODELS.poet,
      instructions: POET,
      prompt,
      reasoning: b.mode === "draft" ? "medium" : "low",
      output: Output.array({ element, minItems: k, maxItems: k }),
      providerOptions: gatewayOptions([`compose:${b.mode}`]),
      abortSignal: signal,
      onError: ({ error }) => console.error("[compose]", error),
    });
    let c = 0;
    for await (const el of result.elementStream) {
      const e = el as { text: string; move: string; technique: string };
      const text = b.mode === "draft" ? e.text.replace(/\\n/g, "\n").trim() : e.text.split("\n")[0].trim();
      if (b.mode === "draft") emit({ type: "candidate", id: `d${c++}`, text, move: e.move, technique: e.technique, fit: scoreDraft(b, s, text) });
      else {
        const next = [...lines];
        if (b.mode === "vary") next[index] = text;
        else next.push(text);
        emit({ type: "candidate", id: `l${c++}`, text, move: e.move, technique: e.technique, fit: scoreLine(b, s, next, index) });
      }
    }
  }, req.signal);
}
