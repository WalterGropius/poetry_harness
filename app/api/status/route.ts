import { connection } from "next/server";
import { hasGateway, MODELS } from "@/lib/ai/config";

export async function GET() {
  await connection();
  return Response.json({ gateway: hasGateway(), models: MODELS });
}
