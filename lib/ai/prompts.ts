import type { Lang } from "@/lib/atlas/types";
import type { Analysis, Skeleton } from "@/lib/prosody/types";
import { REGISTERS } from "./registers";
export { REGISTERS };

export const LANG_NAME: Record<Lang, string> = { en: "English", fr: "French", cs: "Czech" };

/** The voice behind every generation. Written the way a master teaches, not the way a model is instructed. */
export const POET = `You are the poet inside VERSO, a poetry workbench. You have written tens of thousands of poems and taught hundreds of poets, in English, French and Czech, from Petrarch to drill. You write as a working poet, never as an assistant.

What you know in your hands:
- A line is counted before it is felt. English verse counts stresses inside syllables (iambs, trochees, sprung rhythm). French counts syllables: e muet is counted before a consonant, elided before a vowel or h muet, silent at line end; diérèse in -ion; the alexandrine breaks at 6; masculine and feminine rhymes alternate; rime riche shares the consonne d'appui. Czech stresses the first syllable of every word, prepositions take the stress of their noun, vowel length is independent of stress; a Czech iamb needs a monosyllable at the start; r and l can be syllabic (vlk, prst); Czech rhymes from the penultimate vowel in two-syllable endings.
- Rap counts bars and beats: four stresses a bar, rhyme families that run across several words and several bars (multisyllabic, internal, mosaic), assonance carrying more than consonants, breath as punctuation, punchlines landing on the fourth beat. Czech rap lives on vowel rhymes, initial stress on the downbeat, street register without borrowed English unless the borrowing is the point. French rap lives on assonance chains, verlan and the swallowed e.
- The image does the work. Concrete nouns, exact verbs, one surprising adjective at most. No abstractions where a thing would do. No clichés: in English avoid "tapestry, whisper(s), echo(es), symphony, dance of, embrace, soul's, ethereal, shattered"; in French avoid "âme, cœur brisé, éternité, douce mélancolie" unless you earn them; in Czech avoid "duše, věčnost, srdce krvácí, něha" unless you earn them.
- Form is a promise. Honour the exact line count, syllable counts and rhyme letters you are given. A slant rhyme is a choice, not a failure — but only when it means something.
- Every line must be in the target language as a native poet would write it, with correct diacritics and typography.`;

export function registerBrief(id: string | undefined): string {
  return REGISTERS.find((r) => r.id === id)?.brief ?? (id ? `Register: ${id}.` : "");
}

/** Line-by-line contract for a skeleton, in plain words the model can follow. */
export function describeSkeletonForPrompt(s: Skeleton, target: Lang, fidelity: "strict" | "loose"): string {
  const rows: string[] = [];
  let i = 0;
  s.stanzas.forEach((n, si) => {
    rows.push(`Stanza ${si + 1}:`);
    for (let k = 0; k < n; k++, i++) {
      const l = s.lines[i];
      if (!l) continue;
      const syl = fidelity === "strict" ? `${l.syllables} syllables` : `about ${l.syllables} syllables (±3)`;
      const stress = target !== "fr" && l.pattern && fidelity === "strict" ? `, stresses ${l.pattern}` : "";
      const rhyme = l.rhyme === "x" ? "unrhymed" : `rhyme ${l.rhyme}`;
      const end = target === "fr" ? (l.ending === "f" ? ", feminine ending (mute e)" : ", masculine ending") : "";
      const caes = l.caesura && target === "fr" ? `, césure after ${l.caesura}` : "";
      const refrain = l.refrain ? `, refrain ${l.refrain} (repeat the same line every time ${l.refrain} appears)` : "";
      rows.push(`  ${i + 1}. ${syl}${stress}; ${rhyme}${end}${caes}${refrain}`);
    }
  });
  return rows.join("\n");
}

export function analysisDigest(a: Analysis): string {
  const real = a.lines.filter((l) => l.words.length);
  const meter = a.meter.foot ? `${a.meter.foot} × ${a.meter.feet} (regularity ${Math.round(a.meter.regularity * 100)}%)` : `${a.meter.kind} (dominant ${a.meter.syllables} syllables)`;
  const devices = [...new Set(a.devices.map((d) => d.key))].join(", ");
  const fam = a.flow.families
    .filter((f) => f.len >= 2)
    .slice(0, 6)
    .map((f) => f.members.map((m) => `“${m.text}” (l.${m.line + 1})`).join(" ~ "))
    .join("; ");
  return [
    `Language: ${LANG_NAME[a.lang]}. ${real.length} lines in ${a.stanzas.length} stanza(s).`,
    `Form (engine guess): ${a.form.key} (${Math.round(a.form.confidence * 100)}%) — ${a.form.notes.join("; ")}.`,
    `Metre: ${meter}. Rhyme scheme: ${a.scheme}.`,
    `Devices: ${devices || "none detected"}.`,
    `Flow: ${Math.round(a.flow.density * 100)}% of syllables in rhyme families; ${a.flow.multis} multisyllabic families${fam ? `: ${fam}` : ""}.`,
    `5D: sound ${a.signature.sound.toFixed(2)}, measure ${a.signature.measure.toFixed(2)}, shape ${a.signature.shape.toFixed(2)}, image ${a.signature.image.toFixed(2)}, voice ${a.signature.voice.toFixed(2)}.`,
    "Lines (number · syllables · rhyme letter · stress pattern):",
    ...real.map((l, k) => `${k + 1} · ${l.count} · ${l.letter || "-"} · ${l.pattern} · ${l.text.trim()}`),
  ].join("\n");
}

export const STEERS: Record<string, string> = {
  sound: "Push SOUND: more alliteration, assonance and internal rhyme; make the vowels chime.",
  measure: "Push MEASURE: tighten the metre — exact syllable count, stresses exactly on the beat.",
  shape: "Push SHAPE: use the line break as a tool — enjambment, a hard end-stop, a turn.",
  image: "Push IMAGE: one concrete, surprising image; replace any abstraction with a thing.",
  voice: "Push VOICE: direct address, a question or a command; a speaker with a stake.",
  turn: "Make a TURN (volta): change direction — argument, tense, scale or tone.",
  strange: "Make it STRANGE: an unexpected word from another register, still exact.",
};

/** Chaos vector: perturbations injected when the dial is up. Seeded so a run is reproducible. */
const CHAOS_MOVES = [
  "Smuggle in one word from a technical manual.",
  "Let one line be a question nobody can answer.",
  "Use a colour that does not exist.",
  "Borrow the syntax of a weather forecast for one line.",
  "Rhyme a concrete noun with an abstract one.",
  "Put a number in the poem.",
  "Let an object speak for one line.",
  "Cross the poem with the rhythm of a children's rhyme for one line.",
  "Mention a street, a station or a bridge by name.",
  "End a line on a preposition and make it hurt.",
  "Use one word from a fourth language, unglossed.",
  "Make one line out of a list of three nouns.",
];

export function chaosInstruction(chaos: number, seed: number): string {
  if (chaos <= 0.05) return "";
  const n = Math.max(1, Math.round(chaos * 3));
  const picks: string[] = [];
  let x = seed || 1;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    picks.push(CHAOS_MOVES[x % CHAOS_MOVES.length]);
  }
  return `CHAOS VECTOR ${Math.round(chaos * 100)}%: ${[...new Set(picks)].join(" ")}${chaos > 0.7 ? " Take one real risk the form would not expect." : ""}`;
}
