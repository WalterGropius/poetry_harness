import { babel } from "@/lib/server/babel";
import type { Lang } from "@/lib/prosody/types";

export async function POST(req: Request) {
  const { word, lang } = (await req.json()) as { word?: string; lang?: Lang };
  if (!word?.trim()) return Response.json({ error: "empty" }, { status: 400 });
  return Response.json(babel(word, lang ?? "en"));
}
