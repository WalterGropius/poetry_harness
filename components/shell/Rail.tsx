"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { patch, useVerso } from "@/lib/client/store";
import { useStatus, useT } from "@/lib/client/hooks";
import type { DictKey } from "@/lib/i18n";
import type { Lang } from "@/lib/atlas/types";

const I = {
  bridge: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </g>
  ),
  lab: (
    <g fill="currentColor">
      <rect x="3" y="14" width="2.4" height="6" rx=".6" />
      <rect x="7" y="8" width="2.4" height="12" rx=".6" />
      <rect x="11" y="12" width="2.4" height="8" rx=".6" />
      <rect x="15" y="5" width="2.4" height="15" rx=".6" />
      <rect x="19" y="10" width="2.4" height="10" rx=".6" />
    </g>
  ),
  loom: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M5 3v18M10 3v18M15 3v18M20 3v18" opacity=".55" />
      <path d="M3 7c4 0 4 3 9 3s5-3 9-3M3 15c4 0 4 3 9 3s5-3 9-3" />
    </g>
  ),
  transpose: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
    </g>
  ),
  atlas: (
    <g fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M5 6l7 4 7-5M12 10l-3 8M12 10l6 6M5 6l4 12" opacity=".7" />
      <circle cx="5" cy="6" r="2" fill="currentColor" />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" />
      <circle cx="9" cy="18" r="1.8" fill="currentColor" />
      <circle cx="18" cy="16" r="1.6" fill="currentColor" />
    </g>
  ),
  library: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="4" y="4" width="4" height="16" rx=".8" />
      <rect x="9.5" y="6" width="4" height="14" rx=".8" />
      <path d="M15.5 7.5l3.6-1 3 13.4-3.6 1z" />
    </g>
  ),
  babel: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7 20h10M8 16h8M9 12h6M10 8h4M11 4h2" />
      <path d="M7 20l4-16M17 20L13 4" opacity=".55" />
    </g>
  ),
};

const NAV: { href: string; key: DictKey; icon: keyof typeof I; kbd: string }[] = [
  { href: "/", key: "nav.bridge", icon: "bridge", kbd: "1" },
  { href: "/lab", key: "nav.lab", icon: "lab", kbd: "2" },
  { href: "/loom", key: "nav.loom", icon: "loom", kbd: "3" },
  { href: "/transpose", key: "nav.transpose", icon: "transpose", kbd: "4" },
  { href: "/atlas", key: "nav.atlas", icon: "atlas", kbd: "5" },
  { href: "/library", key: "nav.library", icon: "library", kbd: "6" },
  { href: "/babel", key: "nav.babel", icon: "babel", kbd: "7" },
];

export function ThemeSync() {
  const theme = useVerso((s) => s.ui.theme);
  const lang = useVerso((s) => s.ui.lang);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
  }, [theme, lang]);
  return null;
}

export function Rail() {
  const path = usePathname();
  const t = useT();
  const lang = useVerso((s) => s.ui.lang);
  const theme = useVerso((s) => s.ui.theme);
  const status = useStatus();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-1 border-t border-[var(--line)] bg-[var(--bg)]/95 px-2 py-1.5 backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:w-[76px] md:flex-col md:justify-start md:border-r md:border-t-0 md:px-0 md:py-4">
      <Link href="/" className="hidden flex-col items-center gap-1 pb-4 md:flex" aria-label="VERSO">
        <svg width="34" height="34" viewBox="0 0 34 34">
          <rect x="1" y="1" width="32" height="32" rx="9" fill="url(#vg)" stroke="var(--key-edge)" />
          <path d="M9 10l8 15 8-15" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="17" cy="25" r="1.6" fill="var(--ion)" />
          <defs>
            <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--key-top)" />
              <stop offset="1" stopColor="var(--key-bot)" />
            </linearGradient>
          </defs>
        </svg>
        <span className="mono text-[9px] tracking-[0.3em] text-[var(--ink-3)]">VERSO</span>
      </Link>
      <div className="flex flex-1 items-center justify-around gap-1 md:flex-none md:flex-col md:gap-2">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className="group flex flex-col items-center gap-1" title={`${t(n.key)} (${n.kbd})`}>
              <span className={`key key-square !h-[40px] !w-[40px] md:!h-[44px] md:!w-[44px] ${active ? "key-accent" : ""}`} data-pressed={active ? "true" : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  {I[n.icon]}
                </svg>
              </span>
              <span className={`mono hidden text-[8.5px] uppercase tracking-[0.12em] md:block ${active ? "text-[var(--ink)]" : "text-[var(--ink-3)] group-hover:text-[var(--ink-2)]"}`}>{t(n.key)}</span>
            </Link>
          );
        })}
      </div>
      <div className="hidden flex-col items-center gap-3 md:mt-auto md:flex">
        <div className="track flex-col !gap-1 !p-[3px]">
          {(["en", "fr", "cs"] as Lang[]).map((l) => (
            <button key={l} type="button" aria-pressed={l === lang} onClick={() => patch.ui({ lang: l })} className="!h-[24px] !w-[40px] !px-0">
              {l}
            </button>
          ))}
        </div>
        <button type="button" className="key key-sm !w-[48px] !px-0" onClick={() => patch.ui({ theme: theme === "night" ? "paper" : "night" })} title={t(theme === "night" ? "theme.paper" : "theme.night")}>
          {theme === "night" ? "☾" : "☀"}
        </button>
        <div className="flex flex-col items-center gap-1" title={status ? t(status.gateway ? "status.online" : "status.offline.tip") : ""}>
          <span className="led" data-on={status ? "true" : "false"} data-tone={status?.gateway ? "ok" : "accent"} />
          <span className="mono text-[8px] uppercase tracking-[0.1em] text-[var(--ink-3)]">{status ? (status.gateway ? "AI" : "OFF") : "··"}</span>
        </div>
      </div>
    </nav>
  );
}

/** Number keys 1–7 jump between stations (when not typing). */
export function StationKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = NAV.find((x) => x.kbd === e.key);
      if (n) window.location.assign(n.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
