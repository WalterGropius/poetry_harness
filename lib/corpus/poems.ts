import type { Lang } from "@/lib/atlas/types";

export interface Poem {
  id: string;
  title: string;
  author: string;
  /** Atlas node id of the poet, when there is one. */
  poet?: string;
  year: number;
  lang: Lang;
  text: string;
  /** Short note from the master: what to listen for. */
  note: { en: string; fr: string; cs: string };
  /** Excerpt of a longer work. */
  excerpt?: boolean;
}

/** Public-domain library. Texts follow standard modern editions; excerpts are marked. */
export const POEMS: Poem[] = [
  {
    id: "sonnet-18",
    title: "Sonnet 18",
    author: "William Shakespeare",
    poet: "shakespeare",
    year: 1609,
    lang: "en",
    text: `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date;
Sometime too hot the eye of heaven shines,
And often is his gold complexion dimm'd;
And every fair from fair sometime declines,
By chance or nature's changing course untrimm'd;
But thy eternal summer shall not fade,
Nor lose possession of that fair thou ow'st;
Nor shall Death brag thou wander'st in his shade,
When in eternal lines to time thou grow'st:
So long as men can breathe or eyes can see,
So long lives this, and this gives life to thee.`,
    note: {
      en: "Listen for the turn at line 9 (“But”) and how the couplet makes the poem itself the thing that lasts.",
      fr: "Écoutez la volta du vers 9 (« But ») : le distique final fait du poème lui-même ce qui demeure.",
      cs: "Poslouchejte obrat na 9. verši („But“): závěrečné dvojverší udělá z básně samotné to, co přetrvá.",
    },
  },
  {
    id: "sonnet-130",
    title: "Sonnet 130",
    author: "William Shakespeare",
    poet: "shakespeare",
    year: 1609,
    lang: "en",
    text: `My mistress' eyes are nothing like the sun;
Coral is far more red than her lips' red;
If snow be white, why then her breasts are dun;
If hairs be wires, black wires grow on her head.
I have seen roses damask'd, red and white,
But no such roses see I in her cheeks;
And in some perfumes is there more delight
Than in the breath that from my mistress reeks.
I love to hear her speak, yet well I know
That music hath a far more pleasing sound;
I grant I never saw a goddess go;
My mistress, when she walks, treads on the ground:
And yet, by heaven, I think my love as rare
As any she belied with false compare.`,
    note: {
      en: "An anti-blazon: every Petrarchan comparison is refused, so the final praise lands as plain truth.",
      fr: "Un contre-blason : chaque comparaison pétrarquiste est refusée, et l'éloge final sonne vrai.",
      cs: "Anti-blason: každé petrarkovské přirovnání odmítne, a tak závěrečná chvála zní jako prostá pravda.",
    },
  },
  {
    id: "the-tyger",
    title: "The Tyger",
    author: "William Blake",
    poet: "blake",
    year: 1794,
    lang: "en",
    text: `Tyger Tyger, burning bright,
In the forests of the night;
What immortal hand or eye,
Could frame thy fearful symmetry?

In what distant deeps or skies.
Burnt the fire of thine eyes?
On what wings dare he aspire?
What the hand, dare seize the fire?

And what shoulder, & what art,
Could twist the sinews of thy heart?
And when thy heart began to beat,
What dread hand? & what dread feet?

What the hammer? what the chain,
In what furnace was thy brain?
What the anvil? what dread grasp,
Dare its deadly terrors clasp!

When the stars threw down their spears
And water'd heaven with their tears:
Did he smile his work to see?
Did he who made the Lamb make thee?

Tyger Tyger burning bright,
In the forests of the night:
What immortal hand or eye,
Dare frame thy fearful symmetry?`,
    note: {
      en: "Trochaic tetrameter with the last syllable cut off — seven syllables that hammer. The one change in the last stanza, “Could” to “Dare”, is the whole poem.",
      fr: "Tétramètre trochaïque catalectique : sept syllabes qui martèlent. Le seul changement de la dernière strophe, « Could » → « Dare », est tout le poème.",
      cs: "Trochejský tetrametr s useknutou poslední slabikou: sedm slabik jako údery kladiva. Jediná změna v poslední sloce, „Could“ na „Dare“, je celá báseň.",
    },
  },
  {
    id: "because-i-could-not-stop",
    title: "Because I could not stop for Death",
    author: "Emily Dickinson",
    poet: "dickinson",
    year: 1890,
    lang: "en",
    excerpt: true,
    text: `Because I could not stop for Death –
He kindly stopped for me –
The Carriage held but just Ourselves –
And Immortality.

We slowly drove – He knew no haste
And I had put away
My labor and my leisure too,
For His Civility –

We passed the School, where Children strove
At Recess – in the Ring –
We passed the Fields of Gazing Grain –
We passed the Setting Sun –`,
    note: {
      en: "Hymn metre (8·6·8·6) slowed by dashes; the rhymes slip from exact (me / Immortality) to slant (Ring / Sun).",
      fr: "Mètre d'hymne (8·6·8·6) freiné par les tirets ; les rimes glissent de l'exact (me / Immortality) à l'approximatif (Ring / Sun).",
      cs: "Hymnický metr (8·6·8·6) zpomalený pomlčkami; rýmy kloužou od přesných (me / Immortality) k nepřesným (Ring / Sun).",
    },
  },
  {
    id: "hope-is-the-thing",
    title: "“Hope” is the thing with feathers",
    author: "Emily Dickinson",
    poet: "dickinson",
    year: 1891,
    lang: "en",
    text: `“Hope” is the thing with feathers –
That perches in the soul –
And sings the tune without the words –
And never stops – at all –

And sweetest – in the Gale – is heard –
And sore must be the storm –
That could abash the little Bird
That kept so many warm –

I’ve heard it in the chillest land –
And on the strangest Sea –
Yet – never – in Extremity,
It asked a crumb – of me.`,
    note: {
      en: "One extended metaphor carried for twelve lines; watch the feminine first line give way to masculine closes.",
      fr: "Une seule métaphore filée sur douze vers ; le premier vers féminin cède la place à des fins masculines.",
      cs: "Jediná rozvinutá metafora na dvanácti verších; ženské zakončení prvního verše ustoupí mužským.",
    },
  },
  {
    id: "pied-beauty",
    title: "Pied Beauty",
    author: "Gerard Manley Hopkins",
    poet: "hopkins",
    year: 1877,
    lang: "en",
    text: `Glory be to God for dappled things –
For skies of couple-colour as a brinded cow;
For rose-moles all in stipple upon trout that swim;
Fresh-firecoal chestnut-falls; finches’ wings;
Landscape plotted and pieced – fold, fallow, and plough;
And all trades, their gear and tackle and trim.

All things counter, original, spare, strange;
Whatever is fickle, freckled (who knows how?)
With swift, slow; sweet, sour; adazzle, dim;
He fathers-forth whose beauty is past change:
Praise him.`,
    note: {
      en: "A curtal sonnet in sprung rhythm: count the stresses, not the syllables. Alliteration does the work rhyme usually does.",
      fr: "Un sonnet écourté en « sprung rhythm » : comptez les accents, pas les syllabes. L'allitération fait le travail de la rime.",
      cs: "Zkrácený sonet v „sprung rhythm“: počítejte přízvuky, ne slabiky. Aliterace tu dělá práci, kterou jinde dělá rým.",
    },
  },
  {
    id: "the-raven",
    title: "The Raven",
    author: "Edgar Allan Poe",
    poet: "poe",
    year: 1845,
    lang: "en",
    excerpt: true,
    text: `Once upon a midnight dreary, while I pondered, weak and weary,
Over many a quaint and curious volume of forgotten lore—
While I nodded, nearly napping, suddenly there came a tapping,
As of some one gently rapping, rapping at my chamber door.
“’Tis some visitor,” I muttered, “tapping at my chamber door—
Only this and nothing more.”`,
    note: {
      en: "Trochaic octameter split by internal rhyme (dreary / weary, napping / tapping): a long line built as a machine for refrain.",
      fr: "Octamètre trochaïque coupé de rimes internes (dreary / weary) : un vers long construit comme une machine à refrain.",
      cs: "Trochejský oktametr rozťatý vnitřními rýmy (dreary / weary): dlouhý verš postavený jako stroj na refrén.",
    },
  },
  {
    id: "song-of-myself",
    title: "Song of Myself, 1",
    author: "Walt Whitman",
    poet: "whitman",
    year: 1855,
    lang: "en",
    excerpt: true,
    text: `I celebrate myself, and sing myself,
And what I assume you shall assume,
For every atom belonging to me as good belongs to you.

I loafe and invite my soul,
I lean and loafe at my ease observing a spear of summer grass.`,
    note: {
      en: "Free verse held together by anaphora and parallelism instead of metre — the line breathes rather than counts.",
      fr: "Vers libre tenu par l'anaphore et le parallélisme plutôt que par le mètre : le vers respire au lieu de compter.",
      cs: "Volný verš držený anaforou a paralelismem místo metra: verš dýchá, místo aby počítal.",
    },
  },
  {
    id: "daffodils",
    title: "I wandered lonely as a cloud",
    author: "William Wordsworth",
    poet: "wordsworth",
    year: 1815,
    lang: "en",
    excerpt: true,
    text: `I wandered lonely as a cloud
That floats on high o'er vales and hills,
When all at once I saw a crowd,
A host, of golden daffodils;
Beside the lake, beneath the trees,
Fluttering and dancing in the breeze.`,
    note: {
      en: "Iambic tetrameter, ABABCC; the sixth line opens with a trochee (“Flut-tering”) so the flowers move before the metre does.",
      fr: "Tétramètre iambique, ABABCC ; le sixième vers s'ouvre sur un trochée (« Flut-tering ») : les fleurs bougent avant le mètre.",
      cs: "Jambický tetrametr, ABABCC; šestý verš začíná trochejem („Flut-tering“), takže se narcisy pohnou dřív než metrum.",
    },
  },
  // ─── Français ───────────────────────────────────────────────────────────────
  {
    id: "albatros",
    title: "L'Albatros",
    author: "Charles Baudelaire",
    poet: "baudelaire",
    year: 1861,
    lang: "fr",
    text: `Souvent, pour s'amuser, les hommes d'équipage
Prennent des albatros, vastes oiseaux des mers,
Qui suivent, indolents compagnons de voyage,
Le navire glissant sur les gouffres amers.

À peine les ont-ils déposés sur les planches,
Que ces rois de l'azur, maladroits et honteux,
Laissent piteusement leurs grandes ailes blanches
Comme des avirons traîner à côté d'eux.

Ce voyageur ailé, comme il est gauche et veule !
Lui, naguère si beau, qu'il est comique et laid !
L'un agace son bec avec un brûle-gueule,
L'autre mime, en boitant, l'infirme qui volait !

Le Poète est semblable au prince des nuées
Qui hante la tempête et se rit de l'archer ;
Exilé sur le sol au milieu des huées,
Ses ailes de géant l'empêchent de marcher.`,
    note: {
      en: "Alexandrines in crossed rhyme with strict alternation of feminine and masculine endings; count the e muet in “hom-mes”.",
      fr: "Alexandrins en rimes croisées, alternance stricte féminines / masculines ; comptez l'e muet de « hom-mes ».",
      cs: "Alexandríny ve střídavém rýmu s přísným střídáním ženských a mužských zakončení; započítejte němé e v „hom-mes“.",
    },
  },
  {
    id: "correspondances",
    title: "Correspondances",
    author: "Charles Baudelaire",
    poet: "baudelaire",
    year: 1857,
    lang: "fr",
    text: `La Nature est un temple où de vivants piliers
Laissent parfois sortir de confuses paroles ;
L'homme y passe à travers des forêts de symboles
Qui l'observent avec des regards familiers.

Comme de longs échos qui de loin se confondent
Dans une ténébreuse et profonde unité,
Vaste comme la nuit et comme la clarté,
Les parfums, les couleurs et les sons se répondent.

Il est des parfums frais comme des chairs d'enfants,
Doux comme les hautbois, verts comme les prairies,
— Et d'autres, corrompus, riches et triomphants,

Ayant l'expansion des choses infinies,
Comme l'ambre, le musc, le benjoin et l'encens,
Qui chantent les transports de l'esprit et des sens.`,
    note: {
      en: "The founding text of Symbolist synaesthesia; note the diérèse in “ex-pan-si-on” that stretches the line toward the infinite it names.",
      fr: "Le texte fondateur de la synesthésie symboliste ; la diérèse « ex-pan-si-on » étire le vers vers l'infini qu'il nomme.",
      cs: "Zakládající text symbolistní synestezie; dierese „ex-pan-si-on“ natahuje verš k nekonečnu, které jmenuje.",
    },
  },
  {
    id: "chanson-d-automne",
    title: "Chanson d'automne",
    author: "Paul Verlaine",
    poet: "verlaine",
    year: 1866,
    lang: "fr",
    text: `Les sanglots longs
Des violons
De l'automne
Blessent mon cœur
D'une langueur
Monotone.

Tout suffocant
Et blême, quand
Sonne l'heure,
Je me souviens
Des jours anciens
Et je pleure ;

Et je m'en vais
Au vent mauvais
Qui m'emporte
Deçà, delà,
Pareil à la
Feuille morte.`,
    note: {
      en: "Four, four, three syllables — music before meaning. “vi-o-lons” takes a diérèse to make its four.",
      fr: "Quatre, quatre, trois syllabes : « De la musique avant toute chose ». « vi-o-lons » prend la diérèse pour faire ses quatre.",
      cs: "Čtyři, čtyři, tři slabiky: hudba dřív než význam. „vi-o-lons“ potřebuje dierezi, aby měl svá čtyři.",
    },
  },
  {
    id: "dormeur-du-val",
    title: "Le Dormeur du val",
    author: "Arthur Rimbaud",
    poet: "rimbaud",
    year: 1870,
    lang: "fr",
    text: `C'est un trou de verdure où chante une rivière
Accrochant follement aux herbes des haillons
D'argent ; où le soleil, de la montagne fière,
Luit : c'est un petit val qui mousse de rayons.

Un soldat jeune, bouche ouverte, tête nue,
Et la nuque baignant dans le frais cresson bleu,
Dort ; il est étendu dans l'herbe, sous la nue,
Pâle dans son lit vert où la lumière pleut.

Les pieds dans les glaïeuls, il dort. Souriant comme
Sourirait un enfant malade, il fait un somme :
Nature, berce-le chaudement : il a froid.

Les parfums ne font pas frissonner sa narine ;
Il dort dans le soleil, la main sur sa poitrine
Tranquille. Il a deux trous rouges au côté droit.`,
    note: {
      en: "A sonnet built on rejets — “D'argent”, “Luit”, “Dort”, “Tranquille” — words thrown over the line end until the last one reveals the wound.",
      fr: "Un sonnet bâti sur des rejets — « D'argent », « Luit », « Dort », « Tranquille » — jusqu'au dernier qui révèle la blessure.",
      cs: "Sonet postavený na přesazích — „D'argent“, „Luit“, „Dort“, „Tranquille“ — až poslední odhalí ránu.",
    },
  },
  {
    id: "demain-des-l-aube",
    title: "Demain, dès l'aube…",
    author: "Victor Hugo",
    poet: "hugo",
    year: 1856,
    lang: "fr",
    text: `Demain, dès l'aube, à l'heure où blanchit la campagne,
Je partirai. Vois-tu, je sais que tu m'attends.
J'irai par la forêt, j'irai par la montagne.
Je ne puis demeurer loin de toi plus longtemps.

Je marcherai les yeux fixés sur mes pensées,
Sans rien voir au dehors, sans entendre aucun bruit,
Seul, inconnu, le dos courbé, les mains croisées,
Triste, et le jour pour moi sera comme la nuit.

Je ne regarderai ni l'or du soir qui tombe,
Ni les voiles au loin descendant vers Harfleur,
Et quand j'arriverai, je mettrai sur ta tombe
Un bouquet de houx vert et de bruyère en fleur.`,
    note: {
      en: "The address to “tu” hides its addressee until “ta tombe”; note “de houx” — an h aspiré that refuses elision.",
      fr: "Le « tu » cache sa destinataire jusqu'à « ta tombe » ; notez « de houx » : un h aspiré qui refuse l'élision.",
      cs: "Oslovení „tu“ skrývá adresátku až do „ta tombe“; všimněte si „de houx“ — h aspiré, které nedovolí elizi.",
    },
  },
  {
    id: "el-desdichado",
    title: "El Desdichado",
    author: "Gérard de Nerval",
    poet: "nerval",
    year: 1854,
    lang: "fr",
    text: `Je suis le Ténébreux, – le Veuf, – l'Inconsolé,
Le Prince d'Aquitaine à la Tour abolie :
Ma seule Étoile est morte, – et mon luth constellé
Porte le Soleil noir de la Mélancolie.

Dans la nuit du Tombeau, Toi qui m'as consolé,
Rends-moi le Pausilippe et la mer d'Italie,
La fleur qui plaisait tant à mon cœur désolé,
Et la treille où le Pampre à la Rose s'allie.

Suis-je Amour ou Phébus ?… Lusignan ou Biron ?
Mon front est rouge encor du baiser de la Reine ;
J'ai rêvé dans la Grotte où nage la sirène…

Et j'ai deux fois vainqueur traversé l'Achéron :
Modulant tour à tour sur la lyre d'Orphée
Les soupirs de la Sainte et les cris de la Fée.`,
    note: {
      en: "Rimes riches (Inconsolé / constellé / consolé / désolé) bind a hermetic sonnet; the “Soleil noir” is an oxymoron that became a century's emblem.",
      fr: "Des rimes riches (Inconsolé / constellé / consolé / désolé) lient un sonnet hermétique ; le « Soleil noir » est devenu l'emblème d'un siècle.",
      cs: "Bohaté rýmy (Inconsolé / constellé / consolé / désolé) svazují hermetický sonet; „černé slunce“ se stalo znakem celého století.",
    },
  },
  {
    id: "mignonne",
    title: "Mignonne, allons voir si la rose",
    author: "Pierre de Ronsard",
    poet: "ronsard",
    year: 1545,
    lang: "fr",
    excerpt: true,
    text: `Mignonne, allons voir si la rose
Qui ce matin avait déclose
Sa robe de pourpre au soleil,
A point perdu cette vesprée
Les plis de sa robe pourprée,
Et son teint au vôtre pareil.`,
    note: {
      en: "Octosyllabic sizain, AABCCB: the carpe diem of the Pléiade, in modernised spelling.",
      fr: "Sizain d'octosyllabes, AABCCB : le carpe diem de la Pléiade (orthographe modernisée).",
      cs: "Šestiverší osmislabičných veršů, AABCCB: carpe diem Plejády (v modernizovaném pravopise).",
    },
  },
  // ─── Čeština ────────────────────────────────────────────────────────────────
  {
    id: "maj",
    title: "Máj",
    author: "Karel Hynek Mácha",
    poet: "macha",
    year: 1836,
    lang: "cs",
    excerpt: true,
    text: `Byl pozdní večer – první máj –
večerní máj – byl lásky čas.
Hrdliččin zval ku lásce hlas,
kde borový zaváněl háj.
O lásce šeptal tichý mech;
květoucí strom lhal lásky žel,
svou lásku slavík růži pěl,
růžinu jevil vonný vzdech.
Jezero hladké v křovích stinných
zvučelo temně tajný bol,
břeh je objímal kol a kol;
a slunce jasná světů jiných
bloudila blankytnou dráhou,
planoucí tam co lásky slzy.`,
    note: {
      en: "Czech iambs are a paradox: the language stresses first syllables, so the line must open on a monosyllable (“Byl”) to let the iamb walk.",
      fr: "L'iambe tchèque est un paradoxe : la langue accentue la première syllabe, il faut donc ouvrir sur un monosyllabe (« Byl »).",
      cs: "Český jamb je paradox: čeština přízvukuje první slabiku, a tak musí verš otevřít jednoslabičné slovo („Byl“), aby jamb mohl kráčet.",
    },
  },
  {
    id: "svatebni-kosile",
    title: "Svatební košile",
    author: "Karel Jaromír Erben",
    poet: "erben",
    year: 1853,
    lang: "cs",
    excerpt: true,
    text: `Již jedenáctá odbila,
a lampa ještě svítila,
a lampa ještě hořela,
co nad klekadlem visela.`,
    note: {
      en: "Ballad tetrameter in couplets; the repeated “a lampa ještě” is a refrain in miniature, the clock and the flame keeping vigil.",
      fr: "Tétramètre de ballade en distiques ; la reprise « a lampa ještě » est un refrain en miniature.",
      cs: "Baladický čtyřstopý verš ve sdružených rýmech; opakované „a lampa ještě“ je refrén v malém — hodiny a plamen bdí.",
    },
  },
  {
    id: "kde-domov-muj",
    title: "Kde domov můj",
    author: "Josef Kajetán Tyl",
    year: 1834,
    lang: "cs",
    text: `Kde domov můj, kde domov můj,
voda hučí po lučinách,
bory šumí po skalinách,
v sadě skví se jara květ,
zemský ráj to na pohled!
A to je ta krásná země,
země česká domov můj,
země česká domov můj!`,
    note: {
      en: "Trochaic, as Czech naturally is: the stress falls on the first syllable, so the trochee is the language's own heartbeat.",
      fr: "Trochaïque, comme le tchèque l'est naturellement : l'accent tombe sur la première syllabe.",
      cs: "Trochej, jak je češtině vlastní: přízvuk padá na první slabiku, takže trochej je tep samotného jazyka.",
    },
  },
  {
    id: "prsi-prsi",
    title: "Prší, prší",
    author: "lidová",
    year: 1850,
    lang: "cs",
    text: `Prší, prší, jen se leje,
kam koníčky pojedeme?
Pojedeme na luka,
až kukačka zakuká.`,
    note: {
      en: "A folk song: trochees, couplets, and an onomatopoeic rhyme (luka / zakuká) that children hear before they can read.",
      fr: "Chanson populaire : trochées, distiques et une rime onomatopéique (luka / zakuká).",
      cs: "Lidová říkadla: trocheje, sdružené rýmy a zvukomalebný rým (luka / zakuká), který děti slyší dřív, než umějí číst.",
    },
  },
];

export function poemById(id: string): Poem | undefined {
  return POEMS.find((p) => p.id === id);
}
