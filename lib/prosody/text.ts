import type { Lang } from "./types";

/** Letters of all three languages (plus apostrophes and inner hyphens handled by the tokenizer). */
export const LETTER = "a-zA-ZàâäæçéèêëîïôöœùûüÿÀÂÄÆÇÉÈÊËÎÏÔÖŒÙÛÜŸáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ";
const WORD_RE = new RegExp(`[${LETTER}]+(?:['’][${LETTER}]+)*(?:['’](?=\\s|$))?|['’][${LETTER}]+`, "g");

export interface Token {
  text: string;
  start: number;
  end: number;
}

export function tokenize(line: string): Token[] {
  const out: Token[] = [];
  for (const m of line.matchAll(WORD_RE)) {
    out.push({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return out;
}

export function normalizeApostrophes(s: string): string {
  return s.replace(/[’‘`´]/g, "'");
}

export function lower(s: string): string {
  return normalizeApostrophes(s).toLocaleLowerCase();
}

/** Split a poem into lines, keeping blank lines as stanza breaks. */
export function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").replace(/\t/g, " ").split("\n").map((l) => l.replace(/\s+$/, ""));
}

const PUNCT_END = /[.,;:!?…—–\-)»"”'’]\s*$/;
export function isEndStopped(line: string): boolean {
  return PUNCT_END.test(line.trim());
}

export function hasMidPunctuation(line: string): number[] {
  const t = line.trim();
  const out: number[] = [];
  for (let i = 1; i < t.length - 1; i++) if (/[,;:.!?—–]/.test(t[i])) out.push(i);
  return out;
}

// ─── Function words ────────────────────────────────────────────────────────────

const EN_FN = new Set(
  `a an the and or but nor so yet for of to in on at by with from into onto upon as than that which who whom whose what when where while if though although because since unless till until
  i me my mine we us our you your thou thee thy thine ye he him his she her it its they them their this these those there here
  is am are was were be been being do does did have has had hath doth shall should will would can could may might must 'tis 'twas
  not no o oh ah all each some any such own both either neither more most very too just then now ere oft o'er`.split(/\s+/),
);

const FR_FN = new Set(
  `le la les l' un une des du de d' au aux et ou mais donc or ni car que qu' qui quoi dont où si ne n' pas plus
  je j' me m' moi tu te t' toi il elle on nous vous ils elles se s' lui leur leurs eux y en
  mon ma mes ton ta tes son sa ses notre nos votre vos ce cet cette ces c' ça
  à dans par pour sur sous sans avec chez vers entre contre depuis pendant comme
  est sont es suis était être ai as a avait ont avoir fut`.split(/\s+/),
);

const CS_FN = new Set(
  `a i ani ale nebo či že aby kdyby když jak jako než ať protože
  v ve na do od ode z ze s se k ke ku o u po za pro při před přede pod pode nad nade bez přes skrz mezi kolem
  já mě mne mi mně mnou ty tě tebe ti tobě tebou on ona ono oni ony ho jej jeho mu jemu ji jí jim je jich nich ním ní
  my nás nám námi vy vás vám vámi se si sebe sobě sebou
  můj moje má tvůj tvoje tvá jeho její náš naše váš vaše svůj svoje svá
  ten ta to ti ty tu tom tím těch těm ten tento tato toto
  jsem jsi je jsme jste jsou byl byla bylo byli byly by bych bys bychom
  už ještě jen až tak též taky prý kde kam kdy co kdo jak proč tam tu zde sem teď pak`.split(/\s+/),
);

export function isFunctionWord(word: string, lang: Lang): boolean {
  const w = lower(word);
  if (lang === "en") return EN_FN.has(w);
  if (lang === "fr") return FR_FN.has(w) || /^[ldjmtsnc]'$/.test(w);
  return CS_FN.has(w);
}

/** Czech enclitics: never take stress. */
export const CS_ENCLITICS = new Set(`se si mi ti mu ho jsem jsi jsme jste by bych bys bychom byste`.split(" "));

/** Czech prepositions that pull the stress of the following word onto themselves (proclitics). */
export const CS_PROCLITICS = new Set(
  `v ve na do od ode z ze s se k ke ku o u po za pro při před přede pod pode nad nade bez přes skrz`.split(" "),
);

// ─── Stopwords for lexical density ────────────────────────────────────────────

export function isStopword(word: string, lang: Lang): boolean {
  return isFunctionWord(word, lang);
}

// ─── Language detection ───────────────────────────────────────────────────────

export function detectLang(text: string): Lang {
  const t = lower(text);
  const cs = (t.match(/[ěščřžůťďň]/g) ?? []).length;
  const fr = (t.match(/[àâçèêëîïôœùûÿ]/g) ?? []).length;
  const words = t.match(/[a-zà-ÿœěščřžůťďňáéíóúý']+/g) ?? [];
  let frw = 0;
  let csw = 0;
  let enw = 0;
  for (const w of words) {
    if (/^(le|la|les|des|et|je|tu|il|elle|qui|que|dans|une|est|du|au|sur|pour|pas|vous|nous|mon|ma|mes|son|sa|ses|ce|cette)$/.test(w) || /^[ldjmtsnc]'/.test(w)) frw++;
    if (/^(a|je|se|na|v|ve|že|to|jsem|byl|byla|jak|ale|tak|do|po|za|kde|když|mi|ti|ty|já|ten|ta|co|jen|už)$/.test(w)) csw++;
    if (/^(the|and|of|to|is|in|that|with|my|thy|thou|you|i|a|for|not|but|his|her|shall|be|was|are)$/.test(w)) enw++;
  }
  const scores: Record<Lang, number> = {
    cs: cs * 3 + csw * 1.5,
    fr: fr * 2 + frw * 1.6,
    en: enw * 1.6,
  };
  // "a" and "je" are ambiguous between cs/fr/en; diacritics usually decide.
  const best = (Object.entries(scores) as [Lang, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] === 0 ? "en" : best[0];
}

// ─── Orthographic syllable splitting (display only) ──────────────────────────

const DIGRAPHS: Record<Lang, string[]> = {
  en: ["tch", "ch", "sh", "th", "ph", "wh", "gh", "ck", "qu"],
  fr: ["ch", "ph", "th", "gn", "qu", "gu"],
  cs: ["ch"],
};
const ONSETS: Record<Lang, Set<string>> = {
  en: new Set("bl br cl cr dr fl fr gl gr pl pr tr sc sk sl sm sn sp st sw tw thr str spr scr shr".split(" ")),
  fr: new Set("bl br cl cr dr fl fr gl gr pl pr tr vr chr phr".split(" ")),
  cs: new Set("bl br dl dr hl hr chl chr kl kr ml mr pl pr sl sm sn sp st str tl tr vl vr zl zr".split(" ")),
};

function clusterUnits(cl: string, lang: Lang): string[] {
  const out: string[] = [];
  let i = 0;
  const low = cl.toLocaleLowerCase();
  while (i < cl.length) {
    const d = DIGRAPHS[lang].find((g) => low.startsWith(g, i));
    const len = d ? d.length : 1;
    out.push(cl.slice(i, i + len));
    i += len;
  }
  return out;
}

/** Where to cut a consonant cluster sitting between two nuclei (returns offset inside the cluster). */
function cutInCluster(cl: string, lang: Lang): number {
  if (!cl) return 0;
  const units = clusterUnits(cl, lang);
  const low = units.map((u) => u.toLocaleLowerCase());
  if (units.length === 1) return low[0] === "ck" ? cl.length : 0;
  const lenOf = (k: number) => units.slice(0, k).join("").length;
  const lastTwo = low.slice(-2).join("");
  const lastThree = low.slice(-3).join("");
  if (units.length >= 3 && ONSETS[lang].has(lastThree)) return lenOf(units.length - 3);
  if (lang === "fr" || lang === "cs") {
    if (ONSETS[lang].has(lastTwo)) return lenOf(units.length - 2);
    return units.length === 2 ? lenOf(1) : lenOf(1);
  }
  if (ONSETS[lang].has(lastTwo)) return lenOf(units.length - 2);
  return lenOf(units.length - 1);
}

/** Cut a word into display chunks given its nucleus spans [start, end). */
export function chunkBySpans(word: string, spans: [number, number][], lang: Lang): string[] {
  if (spans.length <= 1) return [word];
  const cuts: number[] = [];
  for (let k = 0; k < spans.length - 1; k++) {
    const a = spans[k][1];
    const b = spans[k + 1][0];
    const cl = word.slice(a, b);
    cuts.push(a + cutInCluster(cl, lang));
  }
  const out: string[] = [];
  let prev = 0;
  for (const c of cuts) {
    out.push(word.slice(prev, c));
    prev = c;
  }
  out.push(word.slice(prev));
  return out;
}

/** Orthographic vowel-group spans adjusted to exactly n nuclei (merging silent tails, splitting hiatus). */
export function orthSpans(word: string, n: number, vowel: RegExp): [number, number][] {
  const chars = [...word];
  const groups: [number, number][] = [];
  let i = 0;
  while (i < chars.length) {
    if (vowel.test(chars[i])) {
      let j = i;
      while (j + 1 < chars.length && vowel.test(chars[j + 1])) j++;
      groups.push([i, j + 1]);
      i = j + 1;
    } else i++;
  }
  if (!groups.length) return [[0, word.length]];
  while (groups.length > n && groups.length > 1) {
    const last = groups.pop()!;
    groups[groups.length - 1] = [groups[groups.length - 1][0], last[1]];
  }
  while (groups.length < n) {
    let k = -1;
    let len = 0;
    groups.forEach(([a, b], idx) => {
      if (b - a > len) {
        len = b - a;
        k = idx;
      }
    });
    if (k < 0 || len < 2) break;
    const [a, b] = groups[k];
    groups.splice(k, 1, [a, a + 1], [a + 1, b]);
  }
  return groups;
}

export function splitOrthographic(word: string, n: number, vowel: RegExp, lang: Lang = "en"): string[] {
  if (n <= 1 || word.length <= 1) return [word];
  const spans = orthSpans(word, n, vowel);
  const chunks = chunkBySpans(word, spans, lang);
  while (chunks.length < n) chunks.push("");
  return chunks;
}

export function mode(nums: number[]): number | null {
  if (!nums.length) return null;
  const m = new Map<number, number>();
  for (const n of nums) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
}
