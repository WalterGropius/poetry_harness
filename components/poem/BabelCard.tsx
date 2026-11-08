"use client";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/atlas/types";
import { useT } from "@/lib/client/hooks";
import { Key, Panel, Spinner } from "@/components/ui/controls";

export interface BabelResult {
  word: string;
  lang: Lang;
  display: string;
  rough: string;
  ending: "m" | "f";
  rhymes: string[];
  near: string[];
  twins: Partial<Record<Lang, string[]>>;
}

export function useBabel(word: string | null, lang: Lang) {
  const key = `${lang}:${word ?? ""}`;
  const [res, setRes] = useState<{ key: string; data: BabelResult | null } | null>(null);
  useEffect(() => {
    if (!word) return;
    let live = true;
    fetch("/api/babel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ word, lang }) })
      .then((r) => r.json())
      .then((j: BabelResult) => live && setRes({ key, data: j }))
      .catch(() => live && setRes({ key, data: null }));
    return () => {
      live = false;
    };
  }, [key, word, lang]);
  return { data: res?.data ?? null, busy: !!word && res?.key !== key };
}

export function WordCloud({ words, tone = "ink", onPick }: { words: string[]; tone?: "ink" | "ion" | "accent"; onPick?: (w: string) => void }) {
  if (!words.length) return <span className="text-[12px] text-[var(--ink-4)]">—</span>;
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-1">
      {words.map((w, i) => (
        <button key={w} type="button" onClick={() => onPick?.(w)} className="verse text-[15px] italic transition-colors hover:text-[var(--accent)]" style={{ color: tone === "ion" ? "var(--ion)" : tone === "accent" ? "var(--accent)" : i < 6 ? "var(--ink)" : "var(--ink-2)" }}>
          {w}
        </button>
      ))}
    </div>
  );
}

export function BabelCard({ word, lang, onClose }: { word: string; lang: Lang; onClose: () => void }) {
  const t = useT();
  const [w, setW] = useState(word); // parent remounts with key={word}
  const { data, busy } = useBabel(w, lang);
  return (
    <Panel
      index="↯"
      title={`${t("nav.babel")} · ${w}`}
      right={
        <Key size="sm" tone="ghost" onClick={onClose}>
          ×
        </Key>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        {busy && <Spinner />}
        {data && (
          <>
            <div className="flex items-baseline gap-2">
              <span className="verse text-[22px]">{data.word}</span>
              <span className="mono text-[11px] text-[var(--ink-3)]">
                {data.display} · /{data.rough}/ · {data.ending === "f" ? "♀" : "♂"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="eyebrow">{t("babel.rhymes")}</span>
              <WordCloud words={data.rhymes.slice(0, 18)} onPick={setW} />
            </div>
            {(Object.entries(data.twins) as [Lang, string[]][]).map(([l, ws]) => (
              <div key={l} className="flex flex-col gap-1">
                <span className="eyebrow">
                  {t("babel.twins")} · {l.toUpperCase()}
                </span>
                <WordCloud words={ws.slice(0, 12)} tone="ion" />
              </div>
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
