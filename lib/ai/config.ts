import "server-only";

/**
 * Every model call goes through Vercel AI Gateway (plain "provider/model" strings).
 * Locally: AI_GATEWAY_API_KEY. On Vercel: OIDC is picked up automatically.
 * Without either (or with VERSO_OFFLINE=1) the harness runs its offline twins.
 */
export const MODELS = {
  /** Writes poems, lines and transpositions. */
  poet: process.env.VERSO_POET_MODEL ?? "anthropic/claude-opus-5.5",
  /** Composes the generative-UI reading (Lens). */
  reader: process.env.VERSO_READER_MODEL ?? "anthropic/claude-opus-5.5",
  /** Gateway fallbacks, tried in order if the primary is unavailable. */
  fallbacks: (process.env.VERSO_FALLBACK_MODELS ?? "anthropic/claude-sonnet-5.5").split(",").map((s) => s.trim()).filter(Boolean),
  /** Decision model for the "second reader" scores. */
  judge: process.env.VERSO_JUDGE_MODEL ?? "typesafe-ai/jev",
};

export function hasGateway(): boolean {
  if (process.env.VERSO_OFFLINE === "1") return false;
  return !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
}

export function gatewayOptions(tags: string[] = []) {
  return {
    gateway: {
      models: MODELS.fallbacks,
      tags: ["verso", ...tags],
    },
  };
}
