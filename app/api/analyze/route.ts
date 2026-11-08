import { fullAnalysis } from "@/lib/server/engine";
import type { Lang } from "@/lib/prosody/types";

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; lang?: Lang | "auto"; title?: string; author?: string };
  const text = (body.text ?? "").slice(0, 20000);
  if (!text.trim()) return Response.json({ error: "empty" }, { status: 400 });
  return Response.json(fullAnalysis(text, body.lang ?? "auto", { title: body.title, author: body.author }));
}
