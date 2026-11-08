# VERSO — a poetry harness

**Make any poem. Read any poem. Move any rhythm.** English · French · Czech — from Petrarch to drill.

VERSO is a self-hosted poetry workbench built like a modernist spaceship: a deterministic prosody engine that hears verse the way a trained poet does, a model behind Vercel AI Gateway that writes like one, and an interface where **you author by choosing** — every line is a decision you sign.

```
Bridge ─┬─ Lab ........ reverse-engineer any poem or verse: scansion, rhyme families, form, lineage, a generative reading
        ├─ Loom ....... compose line by line by curating living candidates (steer, chaos dial, provenance trail)
        ├─ Transpose .. carry a poem's rhythm into another story / language / genre — and relay it onward
        ├─ Atlas ...... the semantic net: forms, metres, devices, movements, poets; lit by what you write
        ├─ Library .... public-domain specimens in three languages
        └─ Babel ...... the parallel lexicon: rhymes at home, sound-twins in the other two languages
```

Paste Shakespeare, Mácha, Baudelaire — or the verse you love from MF DOOM — and the Lab maps it. Then transpose Sonnet 18 into Czech contemporary rap, and that into French Symbolism, keeping the skeleton every step of the way.

## The engine (`lib/prosody`)

Deterministic, fast, offline. No model is asked to count.

| | English | French | Czech |
|---|---|---|---|
| syllables | CMU Pronouncing Dictionary (134k) + spelling fallback, prefix stems (*untrimm'd*) | classical counting: e muet counted / elided / silent at line end, `-es`/`-ent` before vowels, h aspiré, diérèse in `-ion` & after consonant + liquid, synérèse, `qu`/`gu` | vowel nuclei, diphthong *ou*, **syllabic r and l** (*vlk, prst, bratr*) |
| stress | lexical stress; monosyllables metrically flexible; poetic variants chosen by the poem's own norm (*ev'ry, temp'rate, fire*) | accent tonique on the word's last full syllable; **césure** at 6 (alexandrin) or 4/5/6 (décasyllabe) | fixed initial stress; **prepositions take the stress** of their noun (ambivalent in metre); enclitics (*se, si, mi, jsem…*) unstressed; vowel length marked separately |
| rhyme | from the last stressed vowel; promoted rhymes (*temperate / date*), slant & consonance only nearby and same gender | phoneme rhyme from a rough G2P, **masculine never with feminine**, richness (pauvre / suffisante / riche) | from the **penultimate vowel** for two-syllable endings (*odbila / svítila*), one syllable for monosyllables, final devoicing (*květ / pohled*) |

Shared: metre fitting by edit-distance against foot templates (with licences: feminine ending, headless line, catalexis, initial inversion), ambiguity reporting (Czech iamb ↔ trochee), rhyme-scheme lettering, devices (alliteration, assonance, internal rhyme, anaphora, epistrophe, refrain, enjambment, rejet, caesura, apostrophe, volta, lipogram, diérèse, e muet), **form detection** (Shakespearean / Petrarchan / French sonnet, villanelle, terza rima, triolet, pantoum, ghazal, sestina, rondeau, limerick, haiku, tanka, cinquain, ballad stanza, blank verse, couplets, free verse, **rap verse**), and a **5D signature** — Sound, Measure, Shape, Image, Voice.

**Flow** (`lib/prosody/flow.ts`) hears rhyme the way rappers do: runs of 1–4 vowel sounds, across word boundaries, recurring within four bars — multisyllabic, internal, mosaic and chained families mapped onto every syllable, with density and syllables-per-bar.

**Skeletons** (`lib/prosody/skeleton.ts`) are a poem with the words taken out — line lengths, stress patterns, rhyme letters, endings, césures, refrains — exportable as JSON and fillable in any of the three languages. `fitSkeleton` scores how well a new poem fills one.

Tests pin the engine to real readings of real poems: `npm test`.

## Models — everything through Vercel AI Gateway

All model calls use AI SDK v7 with plain gateway model strings (`lib/ai/config.ts`):

| role | default | used for |
|---|---|---|
| poet | `anthropic/claude-opus-5.5` | Loom candidates & drafts, transpositions, AI remixes |
| reader | `anthropic/claude-opus-5.5` | the Lens (generative reading) |
| fallbacks | `anthropic/claude-sonnet-5.5` | gateway `models` fallback chain |
| judge | `typesafe-ai/jev` | *second reader*: image & freshness scores via `experimental_decide` — it advises, you decide |

Every generated candidate is re-analysed by the engine and scored against the target skeleton before you see it.

**Offline twins.** Without a gateway key (or with `VERSO_OFFLINE=1`) nothing breaks: the engine is fully local, the Lens composes its reading deterministically, and the Loom/Transpose become a **cento machine** — lines drawn from the public-domain library that fit the skeleton's syllables and rhymes.

## Generative UI — the Lens (`lib/genui`, `components/genui`)

The reading of a poem is composed live by the model as a [json-render](https://json-render.dev) spec, streamed as JSON-Patch lines and rendered progressively. The model may only use VERSO's glyph catalog — `Spread, Section, Margin, Lines, Device, Lineage, Meter, Pentagon, FlowMap, Quote, Compare, Exercise, Fork` — and glyphs that show data (scansion, rhyme families, metre) are rendered **from the engine**, referenced by line number: the model decides what to show and what to say, never the facts. Unknown glyphs are dropped server-side.

## Run it

```bash
npm install
cp .env.example .env.local   # add AI_GATEWAY_API_KEY, or leave empty for offline twins
npm run dev
```

Open http://localhost:3000. Number keys `1`–`7` jump between stations; in the Loom, `⏎` asks for candidates and `1`–`6` keep one.

Deploy on Vercel: import the repo; the gateway authenticates with the deployment's OIDC token, no key needed.

> Behind an HTTPS proxy (some sandboxes), Node's built-in `fetch` ignores `HTTPS_PROXY`; start with `NODE_USE_ENV_PROXY=1 npm run dev` (Node ≥ 22.21).

## Data & licences

- Library texts are public domain (authors who died long ago; standard modern editions; excerpts marked). No copyrighted lyrics are bundled — paste your own; nothing leaves your browser except to your own server.
- Czech and French word lists are original compilations for this project.
- CMU Pronouncing Dictionary via `cmu-pronouncing-dictionary` (ISC). Fonts are self-hosted via Fontsource: Newsreader, Inter Tight, IBM Plex Mono (OFL).
- State is local-first (`localStorage`): your drafts, relay chains and curation trails stay in your browser.

## Map

```
app/                 stations (Bridge, Lab, Loom, Transpose, Atlas, Library, Babel) + API routes
  api/analyze        engine → analysis + skeleton + lit Atlas nodes
  api/compose        Loom candidates (NDJSON), validated against the skeleton
  api/transpose      skeleton-preserving transposition (NDJSON, line by line)
  api/lens           json-render patch stream (model or deterministic twin)
  api/judge          decision-model second reader
  api/remix          reverse · mirror · erasure · cento · compress · explode · invert · answer
  api/babel          parallel lexicon
lib/prosody/         the engine (en, fr, cs, meter, rhyme, devices, form, flow, skeleton)
lib/atlas/           the semantic net (trilingual nodes)
lib/ai/              gateway config, the poet's voice, registers, offline twins
lib/genui/           Lens catalog + deterministic spec
components/          tactile UI kit (keys, dials, tracks, screens), poem views, Atlas graph, Lens registry
tests/               engine regression tests on real poems
```
