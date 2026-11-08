"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/atlas/types";
import { t as translate, type DictKey } from "@/lib/i18n";
import type { Analysis, Skeleton } from "@/lib/prosody/types";
import { useVerso } from "./store";

export function useT() {
  const lang = useVerso((s) => s.ui.lang);
  return useCallback((k: DictKey) => translate(k, lang), [lang]);
}

export function useUiLang(): Lang {
  return useVerso((s) => s.ui.lang);
}

export interface AnalysisResult {
  analysis: Analysis;
  skeleton: Skeleton;
  lit: string[];
}

/** Debounced engine call. The engine is deterministic and fast; this keeps typing smooth. */
export function useAnalysis(text: string, lang: Lang | "auto", meta: { title?: string; author?: string } = {}, delay = 260) {
  const { title, author } = meta;
  const key = JSON.stringify([text, lang, title ?? "", author ?? ""]);
  const [res, setRes] = useState<{ key: string; data: AnalysisResult | null } | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    if (!text.trim()) return;
    const id = ++seq.current;
    const h = setTimeout(async () => {
      try {
        const r = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, lang, title, author }) });
        const j = (await r.json()) as AnalysisResult;
        if (id === seq.current) setRes({ key, data: j.analysis ? j : null });
      } catch {
        if (id === seq.current) setRes({ key, data: null });
      }
    }, delay);
    return () => clearTimeout(h);
  }, [key, text, lang, title, author, delay]);
  // Keep showing the previous reading while the next one is computed: typing stays smooth.
  const empty = !text.trim();
  return { data: empty ? null : (res?.data ?? null), busy: !empty && res?.key !== key };
}

export async function analyzeOnce(text: string, lang: Lang | "auto") {
  const r = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, lang }) });
  return (await r.json()) as AnalysisResult;
}

/** POST and consume an NDJSON event stream. Returns an abort function. */
export function streamNdjson(url: string, body: unknown, onEvent: (e: Record<string, unknown> & { type: string }) => void, onEnd?: () => void): () => void {
  const ctl = new AbortController();
  (async () => {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
      if (!res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const p of parts) if (p.trim()) onEvent(JSON.parse(p));
      }
      if (buf.trim()) onEvent(JSON.parse(buf));
    } catch (err) {
      if ((err as Error).name !== "AbortError") onEvent({ type: "error", message: (err as Error).message });
    } finally {
      onEnd?.();
    }
  })();
  return () => ctl.abort();
}

export interface Status {
  gateway: boolean;
  models: { poet: string; reader: string; judge: string; fallbacks: string[] };
}

let statusCache: Promise<Status> | null = null;
export function useStatus(): Status | null {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    statusCache ??= fetch("/api/status").then((r) => r.json());
    statusCache.then(setS).catch(() => setS(null));
  }, []);
  return s;
}

/** Rhyme-family palette: distinct in both hulls. */
export const FAMILY_COLORS = ["#ff8a5b", "#7fd1c7", "#f2c14e", "#b39dfa", "#8bd17c", "#ff7eb6", "#6fb7ff", "#e8a87c", "#c3e86b", "#f59f9f", "#9ad0ff", "#d9a0ff"];
export const LETTER_COLORS: Record<string, string> = Object.fromEntries("ABCDEFGHIJKLMNOPQRSTUVWYZ".split("").map((c, i) => [c, FAMILY_COLORS[i % FAMILY_COLORS.length]]));
