import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

/**
 * The Lens catalog: the only glyphs a model may use to compose a reading of a poem.
 * Facts (scansion, rhyme, families) are referenced by line number and rendered from the
 * deterministic engine — the model chooses what to show and what to say, never the data.
 */
export const lensCatalog = defineCatalog(schema, {
  components: {
    Spread: {
      props: z.object({ title: z.string(), kicker: z.string().nullable(), columns: z.enum(["1", "2", "3"]).nullable() }),
      description: "Root layout of a reading. Title is the reading's thesis in under 8 words; kicker a mono overline. Children flow into 1–3 columns.",
    },
    Section: {
      props: z.object({ index: z.string().nullable(), title: z.string() }),
      description: "A numbered section (index like '01'). Group 1–4 glyphs per section.",
    },
    Margin: {
      props: z.object({ text: z.string(), tone: z.enum(["observe", "praise", "warn", "dare"]).nullable() }),
      description: "A master's marginal note, 1–3 sentences, concrete, about THIS poem. 'dare' = a challenge to the reader.",
    },
    Lines: {
      props: z.object({ from: z.number(), to: z.number(), mode: z.enum(["text", "scansion", "rhyme", "flow"]).nullable(), caption: z.string().nullable() }),
      description: "Show poem lines from..to (1-based, inclusive) rendered by the engine: plain text, scansion grid, rhyme letters, or rap-style rhyme-family colours.",
    },
    Device: {
      props: z.object({ node: z.string(), lines: z.array(z.number()), note: z.string() }),
      description: "Point at a device/technique in specific lines. node = an Atlas node id from the provided list.",
    },
    Lineage: {
      props: z.object({ nodes: z.array(z.string()), caption: z.string().nullable() }),
      description: "A historical path through Atlas node ids (2–6), oldest first, e.g. petrarch → sonnet-petrarchan → shakespeare.",
    },
    Meter: {
      props: z.object({ caption: z.string().nullable() }),
      description: "The engine's metre gauge and line-length chart for the whole poem.",
    },
    Pentagon: {
      props: z.object({ caption: z.string().nullable() }),
      description: "The 5D signature (sound, measure, shape, image, voice) of the poem.",
    },
    FlowMap: {
      props: z.object({ caption: z.string().nullable() }),
      description: "Rhyme-family statistics (density, multisyllabic, mosaic, chains) with the top families. Use for rap and dense sound-work.",
    },
    Quote: {
      props: z.object({ text: z.string(), source: z.string() }),
      description: "A short public-domain comparison quote (≤ 2 lines) from another poem. Only quote what you know verbatim.",
    },
    Compare: {
      props: z.object({ left: z.string(), right: z.string(), leftLabel: z.string(), rightLabel: z.string() }),
      description: "Side-by-side: a line of the poem vs a rewrite or a line from tradition, to show one technique.",
    },
    Exercise: {
      props: z.object({ title: z.string(), prompt: z.string(), form: z.string().nullable() }),
      description: "A 10-minute exercise derived from this poem. form = optional engine form key (form:sonnet-french…). Its button opens the Loom.",
    },
    Fork: {
      props: z.object({ question: z.string(), options: z.array(z.object({ label: z.string(), op: z.enum(["transpose", "remix", "loom", "atlas"]), arg: z.string() })) }),
      description: "End a reading with 2–4 next moves. op transpose: arg = 'lang|register' (e.g. 'cs|contemporary rap'); remix: arg = remix id (reverse, erasure, cento, compress, explode, invert); loom: arg = seed text; atlas: arg = node id.",
    },
  },
  actions: {},
});
