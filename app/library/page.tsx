"use client";
import Link from "next/link";
import { useState } from "react";
import type { Lang } from "@/lib/atlas/types";
import { POEMS } from "@/lib/corpus/poems";
import { useT, useUiLang } from "@/lib/client/hooks";
import { Track } from "@/components/ui/controls";

export default function LibraryPage() {
  const t = useT();
  const ui = useUiLang();
  const [lang, setLang] = useState<Lang | "all">("all");
  const list = POEMS.filter((p) => lang === "all" || p.lang === lang);
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-3 py-4 md:px-6 md:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">
            <span className="text-[var(--accent)]">06</span> / {t("nav.library")} · {POEMS.length}
          </span>
          <h1 className="verse text-[30px] leading-none md:text-[38px]">{t("lib.title")}</h1>
          <p className="max-w-2xl text-[13.5px] text-[var(--ink-3)]">{t("lib.note")}</p>
        </div>
        <Track value={lang} onChange={setLang} options={[{ value: "all", label: "∀" }, { value: "en", label: "EN" }, { value: "fr", label: "FR" }, { value: "cs", label: "CS" }]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p, i) => (
          <Link key={p.id} href={`/lab?p=${p.id}`} className="plate rise group flex flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${i * 25}ms` }}>
            <div className="flex items-center justify-between">
              <span className="eyebrow">
                {p.lang.toUpperCase()} · {p.year}
                {p.excerpt ? ` · ${t("lib.excerpt")}` : ""}
              </span>
              <span className="mono text-[10px] text-[var(--ink-4)] group-hover:text-[var(--accent)]">{t("lib.open")} →</span>
            </div>
            <div>
              <h2 className="verse text-[22px] leading-tight">{p.title}</h2>
              <span className="text-[12.5px] text-[var(--ink-3)]">{p.author}</span>
            </div>
            <pre className="verse line-clamp-4 whitespace-pre-wrap text-[14.5px] leading-snug text-[var(--ink-2)]">{p.text.split("\n").slice(0, 4).join("\n")}</pre>
            <p className="mt-auto border-t border-[var(--line)] pt-3 text-[12.5px] italic leading-relaxed text-[var(--ink-3)]">{p.note[ui]}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
