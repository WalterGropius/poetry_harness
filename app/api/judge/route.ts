import { experimental_decide } from "ai";
import { hasGateway, MODELS } from "@/lib/ai/config";

export const maxDuration = 30;

/**
 * The second reader: a decision model scores candidates on the two dimensions the
 * deterministic engine cannot measure — image and freshness. It advises; the author decides.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { candidates: string[]; context?: string; lang?: string };
  const cands = (body.candidates ?? []).slice(0, 6);
  if (!hasGateway() || !cands.length) return Response.json({ offline: true, scores: [] });
  try {
    const questions: Record<string, Parameters<typeof experimental_decide>[0]["questions"][string]> = {};
    cands.forEach((_, i) => {
      questions[`image_${i}`] = { type: "score", instructions: `Candidate ${i + 1}: how concrete and surprising is its imagery?`, criteria: ["abstract or generic", "a clear image", "a vivid, specific, surprising image"] };
      questions[`fresh_${i}`] = { type: "boolean", instructions: `Candidate ${i + 1}: does it avoid cliché and stock phrasing?` };
    });
    const r = await experimental_decide({
      model: MODELS.judge,
      state: { poem_so_far: body.context ?? "", language: body.lang ?? "", candidates: cands.map((text, i) => ({ n: i + 1, text })) },
      questions,
      abortSignal: req.signal,
    });
    const answers = r.answers as Record<string, { score?: number; probability?: number }>;
    const scores = cands.map((_, i) => ({ image: (answers[`image_${i}`]?.score ?? 0) / 2, fresh: answers[`fresh_${i}`]?.probability ?? null }));
    return Response.json({ offline: false, model: MODELS.judge, scores });
  } catch (err) {
    return Response.json({ offline: false, error: err instanceof Error ? err.message : String(err), scores: [] });
  }
}
