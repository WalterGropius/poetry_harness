import "server-only";

export type Emit = (event: Record<string, unknown>) => void;

/** Stream newline-delimited JSON events; errors become a final {type:"error"} event. */
export function ndjson(run: (emit: Emit, signal: AbortSignal) => Promise<void>, signal: AbortSignal): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (e) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await run(emit, signal);
        emit({ type: "done" });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
