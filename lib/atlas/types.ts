/** The Atlas: a trilingual semantic net of poetic forms, meters, devices, movements, poets and concepts. */
export type Lang = "en" | "fr" | "cs";
export type Tri = { en: string; fr: string; cs: string };

export type NodeKind =
  | "form" // fixed / stanzaic forms: sonnet, villanelle, haiku…
  | "meter" // feet & metrical systems: iamb, alexandrine, sprung rhythm…
  | "device" // sound, syntax and rhetoric: alliteration, enjambment, anaphora…
  | "movement" // schools, periods, groups: Pléiade, Symbolism, Poetism…
  | "poet" // people
  | "concept" // ideas about poems: volta, persona, ekphrasis…
  | "constraint"; // generative constraints: lipogram, N+7, cento…

export interface AtlasExample {
  lang: Lang;
  /** ≤ 4 lines, separated by \n. Public domain only (author died before 1955) — otherwise omit the example. */
  text: string;
  /** "Author, Title (year)" */
  source: string;
}

export interface AtlasNode {
  /** kebab-case, unique, ASCII: "sonnet-petrarchan", "macha", "poetism" */
  id: string;
  kind: NodeKind;
  label: Tri;
  /** 1–2 sentences per language, in the voice of a master teacher: exact, concrete, never generic. */
  gloss: Tri;
  /** [start, end?] years. Poets: [birth, death]. Forms/movements: origin or active period. */
  era?: [number, number?];
  /** Traditions where the node matters most. */
  langs?: Lang[];
  /** ids of related nodes (treated as undirected edges). Every id must exist. 2–8 per node. */
  links: string[];
  example?: AtlasExample;
  /** One-line "try this" exercise, imperative, in each language. */
  exercise?: Tri;
  /** Feature key emitted by the prosody engine that should light this node up (see ENGINE_KEYS). */
  engine?: string;
}

/** Keys the prosody engine can emit. Atlas nodes reference these via `engine`. */
export const ENGINE_KEYS = [
  // meters
  "meter:iamb", "meter:trochee", "meter:dactyl", "meter:anapest", "meter:amphibrach",
  "meter:syllabic", "meter:accentual", "meter:free",
  // line types
  "line:alexandrine", "line:decasyllable", "line:octosyllable", "line:hendecasyllable",
  "line:pentameter", "line:tetrameter", "line:trimeter", "line:hexameter",
  // rhyme
  "rhyme:couplet", "rhyme:cross", "rhyme:enclosed", "rhyme:monorhyme", "rhyme:terza",
  "rhyme:feminine", "rhyme:masculine", "rhyme:rich", "rhyme:slant", "rhyme:internal",
  "rhyme:multisyllabic", "rhyme:mosaic", "rhyme:chain",
  // forms
  "form:sonnet-shakespearean", "form:sonnet-petrarchan", "form:sonnet-french", "form:haiku",
  "form:tanka", "form:villanelle", "form:limerick", "form:quatrain", "form:couplet",
  "form:terza-rima", "form:ballad-stanza", "form:free-verse", "form:rondeau", "form:triolet",
  "form:pantoum", "form:ghazal", "form:sestina", "form:cinquain", "form:blank-verse",
  "form:rap-verse",
  // devices
  "device:alliteration", "device:assonance", "device:consonance", "device:anaphora",
  "device:epistrophe", "device:refrain", "device:enjambment", "device:caesura", "device:rejet",
  "device:apostrophe", "device:rhetorical-question", "device:exclamation", "device:repetition",
  "device:lipogram", "device:diaeresis", "device:e-muet", "device:volta",
] as const;
export type EngineKey = (typeof ENGINE_KEYS)[number];
