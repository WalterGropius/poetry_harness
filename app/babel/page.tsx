"use client";
import { useState } from "react";
import type { Lang } from "@/lib/atlas/types";
import { useT } from "@/lib/client/hooks";
import { Key, Panel, Spinner, Track } from "@/components/ui/controls";
import { useBabel, WordCloud } from "@/components/poem/BabelCard";

export default function BabelPage() {
  const t = useT();
  const [lang, setLang] = useState<Lang>("cs");
  const [input, setInput] = useState("noc");
  const [word, setWord] = useState<string | null>("noc");
  const { data, busy } = useBabel(word, lang);
  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5 px-3 py-4 md:px-6 md:py-6">
      <div className="flex flex-col gap-1">
        <span className="eyebrow">
          <span className="text-[var(--accent)]">07</span> / {t("nav.babel")}
        </span>
        <h1 className="verse text-[30px] leading-none md:text-[38px]">{t("babel.title")}</h1>
        <p className="max-w-2xl text-[13.5px] text-[var(--ink-3)]">{t("babel.sub")}</p>
      </div>
      <form
        className="plate flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setWord(input.trim() || null);
        }}
      >
        <input className="field verse min-w-[220px] flex-1 !text-[26px]" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
        <Track value={lang} onChange={(l) => setLang(l)} options={(["en", "fr", "cs"] as Lang[]).map((l) => ({ value: l, label: l.toUpperCase() }))} />
        <Key tone="accent" size="lg" type="submit">
          ⏎
        </Key>
        {busy && <Spinner />}
      </form>
      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel index={data.lang.toUpperCase()} title={`${t("babel.rhymes")} · ${data.display}`} right={<span className="mono text-[10px] text-[var(--ink-3)]">/{data.rough}/ {data.ending === "f" ? "♀" : "♂"}</span>}>
            <div className="flex flex-col gap-4 p-4">
              <WordCloud words={data.rhymes} onPick={(w) => { setInput(w); setWord(w); }} />
              {data.near.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-[var(--line)] pt-3">
                  <span className="eyebrow">{t("babel.near")}</span>
                  <WordCloud words={data.near} tone="accent" onPick={(w) => { setInput(w); setWord(w); }} />
                </div>
              )}
            </div>
          </Panel>
          {(Object.entries(data.twins) as [Lang, string[]][]).map(([l, ws]) => (
            <Panel key={l} index={l.toUpperCase()} title={`${t("babel.twins")} · ${t(`lang.${l}` as "lang.en")}`}>
              <div className="p-4">
                <WordCloud
                  words={ws}
                  tone="ion"
                  onPick={(w) => {
                    setLang(l);
                    setInput(w);
                    setWord(w);
                  }}
                />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
