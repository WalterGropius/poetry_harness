import type { Lang } from "@/lib/atlas/types";

/** Genres / registers a poem can be written or transposed into. */
export const REGISTERS: { id: string; label: Record<Lang, string>; brief: string }[] = [
  { id: "contemporary-rap", label: { en: "contemporary rap", fr: "rap contemporain", cs: "současný rap" }, brief: "Contemporary rap verse: bars, dense multisyllabic and internal rhyme, punchlines, present tense, street-level detail, breath control. No hook unless asked." },
  { id: "boom-bap", label: { en: "90s boom-bap", fr: "boom-bap 90s", cs: "boom-bap 90. let" }, brief: "Laid-back 90s boom-bap: jazzy, wry, dense internal rhyme, storytelling, 'Oakland underground' cool; similes with a smirk." },
  { id: "elizabethan", label: { en: "Elizabethan sonnet", fr: "sonnet élisabéthain", cs: "alžbětinský sonet" }, brief: "Elizabethan diction: conceits, argument across quatrains, a turn, a closing couplet that clinches." },
  { id: "symbolist", label: { en: "Symbolist", fr: "symboliste", cs: "symbolistní" }, brief: "Symbolist: correspondences, synaesthesia, music before meaning, suggestion over statement, rare precise words." },
  { id: "romantic", label: { en: "Romantic", fr: "romantique", cs: "romantický (Mácha)" }, brief: "Romantic: night landscapes, longing, the self against nature, Mácha-like sound-painting and oxymoron." },
  { id: "poetism", label: { en: "Poetism", fr: "poétisme", cs: "poetismus" }, brief: "Czech Poetism (1920s): playful, cosmopolitan, lists of bright images, cinema, travel, joy; associative leaps." },
  { id: "folk", label: { en: "folk song", fr: "chanson populaire", cs: "lidová píseň" }, brief: "Folk song: short lines, refrains, trochaic swing, concrete rural images, repetition with variation." },
  { id: "plain", label: { en: "plain contemporary lyric", fr: "lyrique contemporaine", cs: "civilní lyrika" }, brief: "Plain-spoken contemporary lyric: everyday objects, exact observation, quiet turns, no ornament for its own sake." },
  { id: "spoken-word", label: { en: "spoken word", fr: "slam", cs: "spoken word / slam" }, brief: "Spoken word / slam: built for the voice, anaphora, rising lists, direct address, a final line that lands in silence." },
  { id: "imagist", label: { en: "Imagist", fr: "imagiste", cs: "imažistický" }, brief: "Imagist: direct treatment of the thing, no superfluous word, the rhythm of the musical phrase." },
  { id: "baroque", label: { en: "Baroque", fr: "baroque", cs: "barokní" }, brief: "Baroque: vanitas, paradox, antithesis, dense conceits, mortality and splendour in one breath." },
];

