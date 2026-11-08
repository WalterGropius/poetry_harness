"use client";
/**
 * Local-first state: everything lives in this browser (self-hosted, no database).
 * A tiny external store persisted to localStorage, read with useSyncExternalStore.
 */
import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/atlas/types";
import type { Skeleton } from "@/lib/prosody/types";

export type Provenance = "chosen" | "written" | "varied" | "cento" | "draft";

export interface LoomLine {
  text: string;
  prov: Provenance;
  move?: string;
  /** how many alternatives were on the table when this line was chosen */
  of?: number;
}

export interface TrailEvent {
  t: number;
  kind: "keep" | "reject" | "write" | "vary" | "steer" | "draft" | "edit" | "clear";
  text?: string;
  detail?: string;
}

export interface RelayStep {
  id: string;
  text: string;
  lang: Lang;
  register?: string;
  story?: string;
  title?: string;
  author?: string;
  fit?: number | null;
  offline?: boolean;
}

export interface VersoState {
  ui: { lang: Lang; theme: "night" | "paper" };
  lab: { text: string; lang: Lang | "auto"; title?: string; author?: string };
  loom: {
    lang: Lang;
    subject: string;
    register: string;
    form: string; // engine form key, "free", or "skeleton"
    skeleton: Skeleton | null;
    lines: LoomLine[];
    trail: TrailEvent[];
    chaos: number;
    k: number;
    steer: string[];
  };
  relay: RelayStep[];
}

const DEFAULT: VersoState = {
  ui: { lang: "en", theme: "night" },
  lab: { text: "", lang: "auto" },
  loom: { lang: "en", subject: "", register: "plain", form: "form:sonnet-shakespearean", skeleton: null, lines: [], trail: [], chaos: 0.15, k: 4, steer: [] },
  relay: [],
};

const KEY = "verso:v1";
let state: VersoState = DEFAULT;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<VersoState>;
      state = { ...DEFAULT, ...s, ui: { ...DEFAULT.ui, ...s.ui }, lab: { ...DEFAULT.lab, ...s.lab }, loom: { ...DEFAULT.loom, ...s.loom }, relay: s.relay ?? [] };
    }
  } catch {
    /* private mode or corrupted — start fresh */
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked */
  }
}

export function getState(): VersoState {
  hydrate();
  return state;
}

export function setState(fn: (s: VersoState) => VersoState) {
  hydrate();
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useVerso<T>(select: (s: VersoState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(getState()),
    () => select(DEFAULT),
  );
}

export const patch = {
  ui: (p: Partial<VersoState["ui"]>) => setState((s) => ({ ...s, ui: { ...s.ui, ...p } })),
  lab: (p: Partial<VersoState["lab"]>) => setState((s) => ({ ...s, lab: { ...s.lab, ...p } })),
  loom: (p: Partial<VersoState["loom"]>) => setState((s) => ({ ...s, loom: { ...s.loom, ...p } })),
  relay: (r: RelayStep[]) => setState((s) => ({ ...s, relay: r })),
};

export function trail(e: Omit<TrailEvent, "t">) {
  setState((s) => ({ ...s, loom: { ...s.loom, trail: [...s.loom.trail, { ...e, t: Date.now() }].slice(-400) } }));
}
