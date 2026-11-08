import { describe, expect, test } from "vitest";
import { analyze } from "@/lib/prosody/analyze";
import { cmuLexicon } from "@/lib/prosody/cmu";
import { countWord } from "@/lib/prosody/fr";
import { nuclei } from "@/lib/prosody/cs";
import { extractSkeleton, fitSkeleton } from "@/lib/prosody/skeleton";
import { poemById } from "@/lib/corpus/poems";
import type { Lang } from "@/lib/prosody/types";

const A = (id: string) => {
  const p = poemById(id)!;
  return analyze(p.text, { lang: p.lang as Lang, lexicon: cmuLexicon });
};
const real = (a: ReturnType<typeof analyze>) => a.lines.filter((l) => l.words.length);
const scheme = (a: ReturnType<typeof analyze>) => a.scheme.replace(/\s+/g, "");

describe("English", () => {
  test("Sonnet 18 is a Shakespearean sonnet in iambic pentameter", () => {
    const a = A("sonnet-18");
    expect(a.form.key).toBe("form:sonnet-shakespearean");
    expect(a.meter.foot).toBe("iamb");
    expect(a.meter.feet).toBe(5);
    expect(scheme(a)).toBe("ABABCDCDEFEFGG");
    expect(real(a).every((l) => l.count === 10)).toBe(true); // ev'ry, temp'rate chosen by the metre
  });
  test("Sonnet 130 too", () => {
    const a = A("sonnet-130");
    expect(a.form.key).toBe("form:sonnet-shakespearean");
    expect(scheme(a)).toBe("ABABCDCDEFEFGG");
  });
  test("The Tyger is trochaic tetrameter in couplets", () => {
    const a = A("the-tyger");
    expect(a.meter.foot).toBe("trochee");
    expect(a.meter.feet).toBe(4);
    expect(a.features).toContain("rhyme:couplet");
  });
  test("Whitman is free verse", () => {
    expect(A("song-of-myself").meter.kind).toBe("free");
  });
  test("Dickinson alternates 8 and 6 (ballad stanza)", () => {
    const a = A("because-i-could-not-stop");
    expect(a.form.key).toBe("form:ballad-stanza");
  });
});

describe("French", () => {
  test("word counts: e muet, diérèse, synérèse", () => {
    expect(countWord("violons").base).toBe(3);
    expect(countWord("nation").base).toBe(3);
    expect(countWord("ciel").base).toBe(1);
    expect(countWord("prier").base).toBe(2);
    expect(countWord("pensée").base).toBe(2);
    expect(countWord("pensée").silentFem).toBe(true);
    expect(countWord("hommes").mute).toBe("es");
    expect(countWord("qu'il").base).toBe(1);
  });
  test("L'Albatros: alexandrines with césure at 6, crossed rhymes, alternation", () => {
    const a = A("albatros");
    expect(real(a).every((l) => l.count === 12)).toBe(true);
    expect(real(a).every((l) => l.caesura === 6)).toBe(true);
    expect(scheme(a)).toBe("ABABCDCDEFEFGHGH");
    expect(real(a).map((l) => l.rhyme?.ending).join("")).toBe("fmfm".repeat(4));
  });
  test("Chanson d'automne counts 4·4·3", () => {
    const a = A("chanson-d-automne");
    expect(real(a).map((l) => l.count).join("")).toBe("443443".repeat(3));
    expect(a.meter.kind).toBe("syllabic");
  });
  test("Rimbaud and Hugo hold twelve (h aspiré in “de houx” blocks elision)", () => {
    for (const id of ["dormeur-du-val", "demain-des-l-aube", "el-desdichado", "correspondances"]) expect(real(A(id)).every((l) => l.count === 12)).toBe(true);
    expect(scheme(A("demain-des-l-aube"))).toBe("ABABCDCDEFEF");
  });
  test("El Desdichado: masculine never rhymes with feminine", () => {
    expect(scheme(A("el-desdichado"))).toBe("ABABABABCDDCEE");
  });
});

describe("Czech", () => {
  test("syllabic r and l", () => {
    expect(nuclei("vlk").length).toBe(1);
    expect(nuclei("prst").length).toBe(1);
    expect(nuclei("bratr").length).toBe(2);
    expect(nuclei("Brno").length).toBe(2);
    expect(nuclei("lhal").length).toBe(1);
    expect(nuclei("bloudila").length).toBe(3);
  });
  test("Máj: iambic tetrameter, ABBA CDDC EFFE", () => {
    const a = A("maj");
    expect(a.meter.foot).toBe("iamb");
    expect(a.meter.feet).toBe(4);
    expect(scheme(a).slice(0, 12)).toBe("ABBACDDCEFFE");
  });
  test("Erben rhymes from the penultimate vowel (odbila/svítila, hořela/visela)", () => {
    expect(scheme(A("svatebni-kosile"))).toBe("AABB");
  });
  test("Kde domov můj is trochaic", () => {
    expect(A("kde-domov-muj").meter.foot).toBe("trochee");
  });
});

describe("Flow", () => {
  const verse = `I keep the ledger of a broken metronome,
my pen's a stranger in a stolen Rome, alone,
the rhythm's danger is the kettle's overtone,
I fold the anger into letters that I own.
Cold as a mausoleum, bold as a museum,
I told 'em to see 'em, then rolled to the coliseum,
the flow is a fever, the throne is a lever,
I go where the river don't know if I leave her.`;
  test("finds multisyllabic, mosaic and chained families; calls it a rap verse", () => {
    const a = analyze(verse, { lang: "en", lexicon: cmuLexicon });
    expect(a.flow.multis).toBeGreaterThanOrEqual(3);
    expect(a.flow.longest).toBeGreaterThanOrEqual(3);
    expect(a.features).toContain("rhyme:multisyllabic");
    expect(a.form.key).toBe("form:rap-verse");
  });
  test("Czech syllabic-l rhymes (mlha / vlna / plná)", () => {
    const a = analyze("Beton a mlha, to je moje vlna,\ntlačím to dál, dokud není plná.", { lang: "cs" });
    expect(a.flow.families.some((f) => f.members.map((m) => m.text).join(" ").includes("mlha"))).toBe(true);
  });
});

describe("Skeletons", () => {
  test("a poem fills its own skeleton; a stranger does not", () => {
    const s18 = A("sonnet-18");
    const sk = extractSkeleton(s18);
    expect(fitSkeleton(sk, s18).score).toBeGreaterThan(0.95);
    expect(fitSkeleton(sk, A("albatros")).score).toBeLessThan(0.8);
  });
});
