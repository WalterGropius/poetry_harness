"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Lang } from "@/lib/atlas/types";
import { NODES } from "@/lib/atlas/nodes";
import type { Skeleton } from "@/lib/prosody/types";
import { getState, patch } from "./store";

/** Moves between stations: the poem travels with you. */
export function useMoves() {
  const router = useRouter();
  return {
    toLab: useCallback(
      (text: string, lang: Lang | "auto" = "auto", meta: { title?: string; author?: string } = {}) => {
        patch.lab({ text, lang, title: meta.title, author: meta.author });
        router.push("/lab");
      },
      [router],
    ),
    toAtlas: useCallback((id: string) => router.push(`/atlas?n=${encodeURIComponent(id)}`), [router]),
    toTranspose: useCallback(
      (src: { text: string; lang: Lang; title?: string; author?: string }, to?: { lang: Lang; register?: string }) => {
        patch.relay([{ id: `s${Date.now()}`, text: src.text, lang: src.lang, title: src.title, author: src.author }]);
        const q = to ? `?to=${to.lang}&reg=${encodeURIComponent(to.register ?? "plain")}` : "";
        router.push(`/transpose${q}`);
      },
      [router],
    ),
    toLoom: useCallback(
      (opts: { subject?: string; form?: string | null; skeleton?: Skeleton | null; lang?: Lang; register?: string; keepLines?: boolean }) => {
        const cur = getState().loom;
        patch.loom({
          subject: opts.subject ?? cur.subject,
          form: opts.skeleton ? "skeleton" : (opts.form ?? cur.form),
          skeleton: opts.skeleton ?? (opts.form ? null : cur.skeleton),
          lang: opts.lang ?? cur.lang,
          register: opts.register ?? cur.register,
          lines: opts.keepLines ? cur.lines : [],
        });
        router.push("/loom");
      },
      [router],
    ),
  };
}

export function formLabel(key: string, ui: Lang): string {
  const n = NODES.find((x) => x.engine === key);
  if (n) return n.label[ui];
  if (key === "form:unknown") return { en: "No fixed form", fr: "Sans forme fixe", cs: "Bez pevné formy" }[ui];
  return key.replace(/^form:/, "").replace(/-/g, " ");
}

export function nodeByEngine(key: string) {
  return NODES.find((x) => x.engine === key);
}

export function download(name: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
