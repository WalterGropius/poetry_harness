/**
 * Deterministic twin of the Lens: composes a reading spec from the engine alone,
 * so the generative surface still works without a gateway.
 */
import type { AtlasNode, Lang } from "@/lib/atlas/types";
import type { Analysis } from "@/lib/prosody/types";

type Patch = { op: "add"; path: string; value: unknown };

const T = {
  measure: { en: "Measure", fr: "Mesure", cs: "Míra" },
  sound: { en: "Sound", fr: "Son", cs: "Zvuk" },
  lineage: { en: "Lineage", fr: "Lignée", cs: "Rodokmen" },
  next: { en: "Next move", fr: "Coup suivant", cs: "Další tah" },
  where: { en: "Where to take it?", fr: "Où l'emmener ?", cs: "Kam s ní dál?" },
} as const;

const FOOT: Record<string, Record<Lang, string>> = {
  iamb: { en: "iambic", fr: "iambique", cs: "jambický" },
  trochee: { en: "trochaic", fr: "trochaïque", cs: "trochejský" },
  anapest: { en: "anapestic", fr: "anapestique", cs: "anapestický" },
  dactyl: { en: "dactylic", fr: "dactylique", cs: "daktylský" },
  amphibrach: { en: "amphibrachic", fr: "amphibraque", cs: "amfibrachický" },
};

function meterSentence(a: Analysis, ui: Lang): string {
  const reg = Math.round(a.meter.regularity * 100);
  if (a.meter.kind === "syllabic") {
    return {
      en: `Syllabic verse: ${reg}% of lines hold ${a.meter.syllables} syllables. Count the e muet before consonants — it is where the line breathes.`,
      fr: `Vers syllabique : ${reg} % des vers comptent ${a.meter.syllables} syllabes. Comptez l'e muet devant consonne : c'est là que le vers respire.`,
      cs: `Sylabický verš: ${reg} % veršů drží ${a.meter.syllables} slabik. Počítejte němé e před souhláskou — tam verš dýchá.`,
    }[ui];
  }
  if (a.meter.kind === "accentual-syllabic" && a.meter.foot) {
    const f = FOOT[a.meter.foot][ui];
    const alt = a.meter.alt ? FOOT[a.meter.alt][ui] : null;
    return {
      en: `${f[0].toUpperCase() + f.slice(1)}, ${a.meter.feet} feet a line, ${reg}% regular.${alt ? ` But listen again: a ${alt} reading is almost as strong — the ambiguity is the music.` : ""} The deviations are where the meaning presses against the metre.`,
      fr: `Mètre ${f}, ${a.meter.feet} pieds par vers, régulier à ${reg} %.${alt ? ` Mais écoutez encore : une lecture ${alt} se défend presque autant — l'ambiguïté est la musique.` : ""} Les écarts sont les endroits où le sens pousse contre le mètre.`,
      cs: `${f[0].toUpperCase() + f.slice(1)} verš, ${a.meter.feet} stop, pravidelnost ${reg} %.${alt ? ` Poslechněte si ho znovu: ${alt} čtení je skoro stejně silné — dvojznačnost je hudba.` : ""} Odchylky jsou místa, kde význam tlačí proti metru.`,
    }[ui];
  }
  return {
    en: "No stable metre: the line is shaped by breath, syntax and repetition. Read it aloud and mark where you pause.",
    fr: "Pas de mètre stable : le vers se règle sur le souffle, la syntaxe et la répétition. Lisez à voix haute et marquez vos pauses.",
    cs: "Žádné pevné metrum: verš tvaruje dech, syntax a opakování. Čtěte nahlas a značte si, kde se zastavíte.",
  }[ui];
}

function soundSentence(a: Analysis, ui: Lang): string {
  const d = Math.round(a.flow.density * 100);
  const top = a.flow.families.filter((f) => f.len >= 2).sort((x, y) => y.members.length - x.members.length)[0];
  const fam = top ? top.members.map((m) => `“${m.text}”`).slice(0, 3).join(" / ") : "";
  return {
    en: `${d}% of the syllables sit inside a rhyme family${top ? `; the strongest chain is ${fam}` : ""}. Rhyme is not only at the end of the line — follow the colours.`,
    fr: `${d} % des syllabes appartiennent à une famille de rimes${top ? ` ; la chaîne la plus forte : ${fam}` : ""}. La rime n'est pas qu'en fin de vers — suivez les couleurs.`,
    cs: `${d} % slabik patří do nějaké rýmové rodiny${top ? `; nejsilnější řetěz: ${fam}` : ""}. Rým není jen na konci verše — sledujte barvy.`,
  }[ui];
}

export function offlineLensPatches(a: Analysis, ui: Lang, atlas: AtlasNode[], lit: string[], title?: string): Patch[] {
  const p: Patch[] = [];
  const add = (path: string, value: unknown) => p.push({ op: "add", path, value });
  const real = a.lines.filter((l) => l.words.length);
  const formNode = atlas.find((n) => n.engine === a.form.key);
  const headline = formNode ? formNode.label[ui] : { en: "A reading", fr: "Une lecture", cs: "Čtení" }[ui];
  add("/root", "spread");
  add("/elements/spread", { type: "Spread", props: { title: title ? `${title} — ${headline}` : headline, kicker: `${a.lang.toUpperCase()} · ${real.length}L · ${a.scheme}`, columns: "2" }, children: ["s1", "s2", "s3", "s4"] });
  add("/elements/s1", { type: "Section", props: { index: "01", title: T.measure[ui] }, children: ["meter", "m1", "lines1"] });
  add("/elements/meter", { type: "Meter", props: { caption: null }, children: [] });
  add("/elements/m1", { type: "Margin", props: { text: meterSentence(a, ui), tone: "observe" }, children: [] });
  add("/elements/lines1", { type: "Lines", props: { from: 1, to: Math.min(4, real.length), mode: "scansion", caption: null }, children: [] });
  add("/elements/s2", { type: "Section", props: { index: "02", title: T.sound[ui] }, children: ["flow", "m2", "lines2"] });
  add("/elements/flow", { type: "FlowMap", props: { caption: null }, children: [] });
  add("/elements/m2", { type: "Margin", props: { text: soundSentence(a, ui), tone: "praise" }, children: [] });
  add("/elements/lines2", { type: "Lines", props: { from: 1, to: Math.min(8, real.length), mode: "flow", caption: null }, children: [] });
  const devices = a.devices.filter((d) => atlas.some((n) => n.engine === d.key)).slice(0, 3);
  const devIds = devices.map((_, i) => `dev${i}`);
  add("/elements/s3", { type: "Section", props: { index: "03", title: T.lineage[ui] }, children: ["pent", ...devIds, "lineage"] });
  add("/elements/pent", { type: "Pentagon", props: { caption: null }, children: [] });
  devices.forEach((d, i) => {
    const node = atlas.find((n) => n.engine === d.key)!;
    add(`/elements/dev${i}`, { type: "Device", props: { node: node.id, lines: d.lines.slice(0, 4).map((x) => real.findIndex((l) => l.index === x) + 1).filter((x) => x > 0), note: node.gloss[ui] }, children: [] });
  });
  const chain = formNode ? [...formNode.links.filter((id) => atlas.find((n) => n.id === id)?.kind === "poet").slice(0, 2), formNode.id, ...lit.filter((id) => id !== formNode.id).slice(0, 2)] : lit.slice(0, 4);
  add("/elements/lineage", { type: "Lineage", props: { nodes: chain.slice(0, 5), caption: null }, children: [] });
  add("/elements/s4", { type: "Section", props: { index: "04", title: T.next[ui] }, children: ["ex", "fork"] });
  const ex = formNode?.exercise?.[ui];
  add("/elements/ex", { type: "Exercise", props: { title: formNode ? formNode.label[ui] : "Exercise", prompt: ex ?? { en: "Rewrite the first line keeping only its stresses.", fr: "Réécrivez le premier vers en ne gardant que ses accents.", cs: "Přepište první verš, ponechte jen jeho přízvuky." }[ui], form: a.form.key !== "form:unknown" ? a.form.key : null }, children: [] });
  const other = (["en", "fr", "cs"] as Lang[]).filter((l) => l !== a.lang);
  add("/elements/fork", {
    type: "Fork",
    props: {
      question: T.where[ui],
      options: [
        { label: { en: `Transpose to ${other[0].toUpperCase()} rap`, fr: `Transposer en rap ${other[0].toUpperCase()}`, cs: `Převést do rapu (${other[0].toUpperCase()})` }[ui], op: "transpose", arg: `${other[0]}|contemporary-rap` },
        { label: { en: `Transpose to ${other[1].toUpperCase()} Symbolist`, fr: `Transposer en symboliste ${other[1].toUpperCase()}`, cs: `Převést do symbolismu (${other[1].toUpperCase()})` }[ui], op: "transpose", arg: `${other[1]}|symbolist` },
        { label: { en: "Erasure", fr: "Caviardage", cs: "Výmaz" }[ui], op: "remix", arg: "erasure" },
        { label: { en: "Reverse", fr: "Renverser", cs: "Obrátit" }[ui], op: "remix", arg: "reverse" },
      ],
    },
    children: [],
  });
  return p;
}
