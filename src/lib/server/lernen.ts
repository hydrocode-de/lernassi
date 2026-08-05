// Die Agenten der Lern-Session (M3). Vier kleine Schritte in fester Sequenz statt
// eines großen Prompts: einzeln testbar, jeder sieht nur, was er braucht.
//
//   1. Prüf-Agent      → erzeugt die Fragen (zwei Wellen)
//   2. Spiegel-Agent   → gleicht Beobachtung gegen Selbstbild ab
//   3. Plan-Agent      → baut mit dem Kind die Vorschläge
//   4. Beurteilungs-Agent → stiller, nachlaufender Schritt ohne Kind-Kontakt
//
// Läuft über Requesty EU, wie die Ingestion. Bilder sehen diese Agenten nie —
// Aufnehmen und Lernen bleiben getrennt.

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject, streamObject, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { ausRohtext } from './antwortlesen';
import { env } from '$env/dynamic/private';

const BASE_URL = env.REQUESTY_BASE_URL ?? 'https://router.eu.requesty.ai/v1';
const STANDARD = env.REQUESTY_MODEL ?? 'anthropic/claude-sonnet-4-5';

/**
 * Zeitlimit für EINEN Modellaufruf, samt der Wiederholungen, die das SDK selbst macht.
 *
 * Ohne das kann ein Aufruf minutenlang hängen — bei einem falsch gesetzten Modellnamen etwa
 * wartet das SDK mit wachsenden Pausen immer weiter. Das Kind sieht dann bis in alle Ewigkeit
 * „ich bin noch dran". Lieber ein ehrliches Ende, das man nochmal anstoßen kann.
 */
export const ZEITLIMIT_MS = 45_000;

function zeitlimit(): AbortSignal {
	return AbortSignal.timeout(ZEITLIMIT_MS);
}

/** Eine Modell-Variable pro Agent, alle mit demselben Default. Beim Pilotlauf lässt sich
 *  die klemmende Stelle einzeln tauschen, ohne Code anzufassen. */
const MODELLE = {
	pruef: () => env.REQUESTY_MODEL_PRUEF ?? STANDARD,
	spiegel: () => env.REQUESTY_MODEL_SPIEGEL ?? STANDARD,
	plan: () => env.REQUESTY_MODEL_PLAN ?? STANDARD,
	beurteilung: () => env.REQUESTY_MODEL_BEURTEILUNG ?? STANDARD,
	bewerter: () => env.REQUESTY_MODEL_BEWERTER ?? STANDARD,
	gespraech: () => env.REQUESTY_MODEL_GESPRAECH ?? STANDARD
};

function modell(agent: keyof typeof MODELLE) {
	const apiKey = env.REQUESTY_API_KEY;
	if (!apiKey) throw new KeinSchluessel();
	const requesty = createOpenAICompatible({
		name: 'requesty',
		baseURL: BASE_URL,
		apiKey,
		// Erzwingt json_schema statt json_object — siehe ingest.ts.
		supportsStructuredOutputs: true
	});
	return requesty(MODELLE[agent]());
}

export class KeinSchluessel extends Error {
	constructor() {
		super('REQUESTY_API_KEY fehlt');
	}
}

/** Roh-Mitschrieb eines Aufrufs. Bleibt im Arbeitsspeicher und geht nach Rundenende
 *  auf das Gerät des Kindes — nie in die zentrale Datenbank. */
export type Mitschrieb = {
	agent: keyof typeof MODELLE;
	modell: string;
	wann: number;
	system: string;
	eingabe: string;
	antwort: unknown;
	/** Token-Verbrauch dieses Aufrufs. Im Gespräch fallen je Runde ein Vielfaches an Aufrufen
	 *  an wie in der klassischen Welle — ohne Zahlen im Mitschrieb wäre der Vergleich der
	 *  beiden Modi eine Meinungsfrage. */
	tokens?: { rein: number; raus: number } | null;
};

/** Eine Antwort, die am Schema gescheitert ist, aus dem Rohtext retten — oder den Fehler
 *  weiterwerfen. Warum das nötig ist, steht in antwortlesen.ts. */
function gerettet<T>(schema: z.ZodType<T>, agent: keyof typeof MODELLE, fehler: unknown): T {
	const wert = NoObjectGeneratedError.isInstance(fehler) ? ausRohtext(schema, fehler.text) : null;
	if (wert === null) throw fehler;
	console.warn(
		`[${agent}] Antwort von ${MODELLE[agent]()} passte nicht aufs Schema, aus dem Rohtext gerettet.`
	);
	return wert;
}

async function frage<T>(opts: {
	agent: keyof typeof MODELLE;
	schema: z.ZodType<T>;
	system: string[];
	eingabe: string[];
	mitschrieb?: Mitschrieb[];
}): Promise<T> {
	const system = opts.system.join('\n');
	const eingabe = opts.eingabe.join('\n');

	let object: T;
	let usage: { inputTokens?: number; outputTokens?: number } | null = null;
	try {
		const ergebnis = await generateObject({
			model: modell(opts.agent),
			schema: opts.schema,
			system,
			prompt: eingabe,
			abortSignal: zeitlimit()
		});
		object = ergebnis.object;
		usage = ergebnis.usage ?? null;
	} catch (fehler) {
		object = gerettet(opts.schema, opts.agent, fehler);
		usage = NoObjectGeneratedError.isInstance(fehler) ? (fehler.usage ?? null) : null;
	}

	opts.mitschrieb?.push({
		agent: opts.agent,
		modell: MODELLE[opts.agent](),
		wann: Date.now(),
		system,
		eingabe,
		antwort: object,
		tokens: { rein: usage?.inputTokens ?? 0, raus: usage?.outputTokens ?? 0 }
	});
	return object;
}

// ─────────────────────────────────────────────────────────────
// Gemeinsames Material-Bild
// ─────────────────────────────────────────────────────────────

export type MaterialThema = {
	themaId: string;
	titel: string;
	zusammenfassung: string | null;
	begriffe: string | null;
	transkript: string | null;
	wann: Date;
	neu: boolean;
};

/** Material als Text. `mitTranskript` nur für den Prüf-Agenten: er muss Fragen aus dem
 *  echten Wortlaut bauen. Spiegel, Plan und Beurteilung reicht die Zusammenfassung. */
export function materialAlsText(themen: MaterialThema[], mitTranskript: boolean): string {
	if (!themen.length) return '(kein Material)';
	return themen
		.map((t) =>
			[
				`## Thema: ${t.titel}${t.neu ? ' (NEU seit der letzten Runde)' : ''}`,
				t.zusammenfassung ? `Zusammenfassung: ${t.zusammenfassung}` : null,
				t.begriffe ? `Begriffe: ${t.begriffe}` : null,
				mitTranskript && t.transkript ? `Aufschrieb im Wortlaut:\n${t.transkript}` : null
			]
				.filter(Boolean)
				.join('\n')
		)
		.join('\n\n');
}

const LERNZIEL_HINWEIS = [
	'Das Lernziel der Lehrkraft ist Kontext, kein Fragenkatalog. Es entscheidet, WELCHE der',
	'möglichen Fragen gestellt werden und wie tief sie gehen — nie, dass etwas gefragt wird,',
	'das im Heft des Kindes nicht steht.'
].join('\n');

const KIND_TON = [
	'Du sprichst ein Kind der Sekundarstufe an: kurze Sätze, du-Form, keine Anglizismen,',
	'kein Lob auf Vorrat, keine Emojis. Nichts über Technik, Modelle, Prompts oder diese',
	'Anwendung selbst — das Kind sieht nur Inhalt.'
].join('\n');

// ─────────────────────────────────────────────────────────────
// 1. Prüf-Agent
// ─────────────────────────────────────────────────────────────

export const FRAGE_ARTEN = ['single', 'multi', 'yesno', 'order', 'match', 'text'] as const;
export type FrageArt = (typeof FRAGE_ARTEN)[number];

/** Was eine Frage dieser Art an Zeit kostet, in Sekunden — Lesen, Antworten und Rückmeldung
 *  zusammen. Daraus fällt die Fragenzahl: Budget = Umfang der Karte in Minuten × 60.
 *  10 Minuten überwiegend Single/Multi ergeben so rund 8 Fragen, 15 Minuten mit Freitext drei. */
export const SEKUNDEN_JE_ART: Record<FrageArt, number> = {
	yesno: 40,
	single: 60,
	multi: 80,
	order: 100,
	match: 110,
	text: 250
};

const FrageSchema = z.object({
	thema: z
		.string()
		.describe('Titel des Themas, aus dem diese Frage stammt — exakt wie in der Material-Liste.'),
	art: z
		.enum(FRAGE_ARTEN)
		.describe(
			'single = eine richtige Antwort; multi = mehrere richtige; yesno = Ja/Nein; ' +
				'order = Reihenfolge legen; match = Paare zuordnen; text = das Kind schreibt selbst.'
		),
	punkte: z
		.number()
		.int()
		.min(1)
		.max(3)
		.describe(
			'Wie schwer die Frage ist: 1 = auf Anhieb zu wissen, 2 = braucht Nachdenken, ' +
				'3 = verlangt Verknüpfen oder eigenes Formulieren. Die Zahl ist zugleich das ' +
				'Kontingent: 2 erlaubt ein Nachfassen, 3 erlaubt zwei. Vergib 3 sparsam.'
		),
	frage: z.string().describe('Die Frage an das Kind, ein bis zwei Sätze.'),
	auswahl: z
		.array(z.string())
		.describe(
			'single/multi: alle Antwortmöglichkeiten (3 bis 4, genau eine bzw. mehrere richtig). ' +
				'yesno und text: leer lassen. order: die Elemente in der RICHTIGEN Reihenfolge — gemischt wird ' +
				'später. match: die linken Begriffe.'
		),
	partner: z
		.array(z.string())
		.describe('Nur bei match: partner[i] gehört zu auswahl[i]. Sonst leeres Array.'),
	richtig: z
		.array(z.string())
		.describe(
			'single: die eine richtige Möglichkeit, wortgleich aus auswahl. multi: alle richtigen. ' +
				'yesno: ["Ja"] oder ["Nein"]. order und match: leeres Array. text: die Begriffe, ' +
				'die in einer richtigen Antwort vorkommen müssen.'
		),
	hinweis: z
		.string()
		.nullable()
		.describe(
			'Hinweis fürs Nachfassen — zeigt zum eigenen Heft, verrät die ' +
				'Antwort nicht. Bei punkte 2 oder 3 nötig, sonst wäre das Nachfassen Raten. ' +
					'null bei punkte 1 — dort gibt es kein Nachfassen.'
		)
});

const WelleSchema = z.object({
	fragen: z.array(FrageSchema),
	luecke: z
		.string()
		.nullable()
		.describe(
			'Was das Lernziel erwartet, im Material dieses Kindes aber nicht vorkommt. ' +
				'Nur für die interne Beurteilung, nie für das Kind. null, wenn nichts fehlt.'
		)
});

export type RohFrage = z.infer<typeof FrageSchema>;

const PRUEF_SYSTEM = [
	'Du stellst einem Kind Fragen zu SEINEM EIGENEN Unterrichtsaufschrieb, damit es merkt,',
	'was schon sitzt und was noch wackelt. Du unterrichtest nicht und bewertest nicht.',
	'',
	'Eiserne Regel: Jede Frage muss aus dem mitgelieferten Material beantwortbar sein.',
	'Frage nie nach Wissen, das dort nicht steht — sonst stimmt „schau nochmal in dein Heft" nicht.',
	'',
	LERNZIEL_HINWEIS,
	'',
	'Fast alles wird angetippt: bevorzuge Arten, die schnell zu beantworten sind — single,',
	'multi, yesno, order, match. Freitext (text) kostet ein Kind ein Mehrfaches an Zeit;',
	'nimm ihn nur, wo Antippen die Sache wirklich verfehlt, etwa wenn das Kind einen',
	'Zusammenhang selbst formulieren soll. Nutze die Arten gemischt, aber nur wo sie passen —',
	'eine Reihenfolge nur, wenn im Heft wirklich eine Abfolge steht, Paare nur bei echten',
	'Zuordnungen. Falsche Möglichkeiten müssen plausibel sein und aus demselben Zusammenhang',
	'kommen, nicht albern.',
	'',
	KIND_TON
];

export type WellenAuftrag = {
	fach: string;
	kapitel: string;
	material: string;
	lernziel: string | null;
	beurteilung: string | null;
	welle: 1 | 2;
	anzahl: number;
	bisher?: { frage: string; thema: string; ergebnis: string }[];
	mitschrieb?: Mitschrieb[];
};

function wellenEingabe(opts: WellenAuftrag): string[] {
	const wellenAuftrag =
		opts.welle === 1
			? [
					`Stelle ${opts.anzahl} Fragen für den Anfang. Verteile sie über die Themen des Kapitels`,
					'und fange nicht mit der schwersten an.',
					'',
					'In dieser Runde wird nur angetippt: kein Freitext (art "text").'
				]
			: [
					`Stelle ${opts.anzahl} weitere Fragen. Nimm gezielt das auf, was gerade gewackelt hat.`,
					'',
					'Aber: keine Frage darf denselben Sachverhalt noch einmal abfragen — eine umformulierte',
					'Wiederholung ist keine neue Frage. Nimm einen anderen Zugang zu derselben Stelle:',
					'nach dem Warum fragen, mit etwas anderem verknüpfen, in eine Reihenfolge bringen,',
					'eine Folge abschätzen. Wo alles saß, geh eine Stufe höher: verbinden, einordnen,',
					'begründen statt abfragen.',
					'',
					'In dieser Runde wird nur angetippt: kein Freitext (art "text").'
				];

	return [
		`Fach: ${opts.fach}`,
		`Kapitel: ${opts.kapitel}`,
		'',
		'Lernziel der Lehrkraft für diese Klasse:',
		opts.lernziel ?? '(keines hinterlegt — richte dich allein am Material aus)',
		'',
		'Was du über dieses Kind in diesem Kapitel schon weißt:',
		opts.beurteilung ?? '(noch nichts)',
		'',
		'Material des Kindes:',
		opts.material,
		'',
		...(opts.bisher?.length
			? [
					'Diese Fragen liefen gerade schon:',
					...opts.bisher.map((b) => `- [${b.ergebnis}] (${b.thema}) ${b.frage}`),
					''
				]
			: []),
		...wellenAuftrag
	];
}

export async function erzeugeFragen(opts: WellenAuftrag): Promise<z.infer<typeof WelleSchema>> {
	return frage({
		agent: 'pruef',
		schema: WelleSchema,
		system: PRUEF_SYSTEM,
		mitschrieb: opts.mitschrieb,
		eingabe: wellenEingabe(opts)
	});
}

/**
 * Dieselbe Welle, aber gestreamt: gibt den Text der ERSTEN Frage Wort für Wort heraus, während
 * die übrigen noch entstehen.
 *
 * Der Grund ist nicht Technik, sondern das Warten. Eine Welle braucht 10 bis 20 Sekunden; wird
 * sie am Stück abgewartet, sitzt das Kind vor einer Seite, die nichts tut. Kommt der erste
 * Fragetext schon nach zwei Sekunden an, liest es mit, während der Rest noch läuft.
 *
 * Der Aufrufer MUSS `textStrom` auslaufen lassen, sonst wird `fertig` nie erfüllt.
 */
export function erzeugeFragenStroemend(opts: WellenAuftrag): {
	textStrom: AsyncIterable<string>;
	fertig: Promise<z.infer<typeof WelleSchema>>;
} {
	const system = PRUEF_SYSTEM.join('\n');
	const eingabe = wellenEingabe(opts).join('\n');

	const lauf = streamObject({
		model: modell('pruef'),
		schema: WelleSchema,
		system,
		prompt: eingabe,
		abortSignal: zeitlimit()
	});

	async function* textStrom() {
		let bisher = '';
		for await (const teil of lauf.partialObjectStream) {
			const t = teil.fragen?.[0]?.frage;
			if (typeof t === 'string' && t.length > bisher.length) {
				yield t.slice(bisher.length);
				bisher = t;
			}
		}
	}

	const fertig = (async () => {
		const antwort = await lauf.object.catch((fehler: unknown) =>
			gerettet(WelleSchema, 'pruef', fehler)
		);
		const usage = await lauf.usage.catch(() => null);
		opts.mitschrieb?.push({
			agent: 'pruef',
			modell: MODELLE.pruef(),
			wann: Date.now(),
			system,
			eingabe,
			antwort,
			tokens: usage ? { rein: usage.inputTokens ?? 0, raus: usage.outputTokens ?? 0 } : null
		});
		return antwort;
	})();

	return { textStrom: textStrom(), fertig };
}

/**
 * Fragen für eine Übung: EINE Welle für GENAU EINE Karte, gegen ein Zeitbudget statt gegen
 * eine Fragenzahl. Zwei Wellen braucht es hier nicht — das gezielte Nachfassen macht in der
 * Übung die Frage selbst über ihr Punkte-Kontingent.
 */
export async function erzeugeUebungsfragen(opts: {
	fach: string;
	kapitel: string;
	auftrag: string;
	minuten: number;
	material: string;
	lernziel: string | null;
	beurteilung: string | null;
	mitschrieb?: Mitschrieb[];
}): Promise<z.infer<typeof WelleSchema>> {
	const budget = Math.max(120, Math.round(opts.minuten * 60));

	return frage({
		agent: 'pruef',
		schema: WelleSchema,
		system: PRUEF_SYSTEM,
		mitschrieb: opts.mitschrieb,
		eingabe: [
			`Fach: ${opts.fach}`,
			`Kapitel: ${opts.kapitel}`,
			'',
			'Das Kind hat sich diesen einen Punkt vorgenommen:',
			opts.auftrag,
			'',
			'Lernziel der Lehrkraft für diese Klasse:',
			opts.lernziel ?? '(keines hinterlegt — richte dich allein am Material aus)',
			'',
			'Was du über dieses Kind in diesem Kapitel schon weißt:',
			opts.beurteilung ?? '(noch nichts)',
			'',
			'Material des Kindes:',
			opts.material,
			'',
			`Du hast höchstens ${budget} Sekunden. Rechne mit diesen Kosten je Frage:`,
			...FRAGE_ARTEN.map((a) => `- ${a}: ${SEKUNDEN_JE_ART[a]} Sekunden`),
			'',
			'Das Budget ist eine Obergrenze, kein Soll. Stelle LIEBER WENIGER, DAFÜR VERSCHIEDENE',
			'Fragen als viele ähnliche — ein halb genutztes Budget ist besser als eine Frage zu viel.',
			'',
			'HÖCHSTENS EINE Freitextfrage, und nur wenn Antippen die Sache wirklich verfehlt.',
			'Freitext ist die seltenste Form, nicht die bequemste.',
			'',
			'Prüfe jede Frage vor der Ausgabe gegen sich selbst: Steht unter auswahl mindestens eine',
			'Möglichkeit, die die Frage WIRKLICH beantwortet? Fragst du nach einem Argument FÜR etwas,',
			'dürfen nicht alle Möglichkeiten dagegen sprechen. Passt es nicht zusammen, lass die Frage weg.',
			'',
			'Eiserne Regel: KEINE ZWEI FRAGEN AUF DENSELBEN SACHVERHALT. Eine umformulierte',
			'Wiederholung, eine Aufzählung einmal einzeln und einmal als Mehrfachauswahl, dieselbe',
			'Sache einmal als Frage und einmal als Ja/Nein — alles verboten. Jede Frage muss einen',
			'anderen Zugang nehmen: nach dem Warum fragen, mit etwas anderem verknüpfen, in eine',
			'Reihenfolge bringen, eine Folge abschätzen, ein Gegenbeispiel prüfen.',
			'',
			'Alle Fragen gehen auf diesen einen Punkt — nicht auf das ganze Kapitel. Fange nicht mit',
			'der schwersten an.'
		]
	});
}

// ─────────────────────────────────────────────────────────────
// 1b. Bewerter-Agent — nur für Freitext-Antworten
// ─────────────────────────────────────────────────────────────

const BewertungSchema = z.object({
	getroffen: z
		.boolean()
		.describe(
			'true, wenn die Antwort den Kern der erwarteten Antwort trifft. Rechtschreibung, ' +
				'Ausdruck und Reihenfolge sind egal — es geht um die Sache.'
		),
	fehlt: z
		.array(z.string())
		.describe('Die erwarteten Begriffe, die in der Antwort NICHT vorkamen. Leer, wenn alles da war.'),
	satz: z
		.string()
		.describe('Ein Satz Rückmeldung an das Kind. Sagt, was saß, und bei Bedarf, was fehlte.')
});

const BEWERTER_SYSTEM = [
	'Du prüfst eine getippte Antwort eines Kindes gegen das, was in seinem eigenen Heft steht.',
	'Du entscheidest nur: trifft die Antwort den Kern, ja oder nein. Wie viel sie wert ist,',
	'rechnet nicht du.',
	'',
	'Sei großzügig bei Form und streng bei der Sache. Ein Kind, das es in eigenen Worten',
	'richtig sagt, hat es richtig gesagt — auch ohne die Fachbegriffe aus dem Heft. Ein Kind,',
	'das die Fachbegriffe aufzählt, ohne den Zusammenhang zu treffen, hat es nicht.',
	'',
	KIND_TON
];

/** Bewertet eine Freitext-Antwort. Die Punkte rechnet der Server aus dem Versuch —
 *  dieser Agent sagt nur, ob es getroffen war. */
export async function bewerteFreitext(opts: {
	frage: string;
	erwartet: string[];
	antwort: string;
	material: string;
	/** Hat das Kind danach noch einen Versuch? Dann darf nichts verraten werden. */
	darfNochmal: boolean;
	mitschrieb?: Mitschrieb[];
}): Promise<z.infer<typeof BewertungSchema>> {
	return frage({
		agent: 'bewerter',
		schema: BewertungSchema,
		system: [
			...BEWERTER_SYSTEM,
			'',
			opts.darfNochmal
				? 'Das Kind darf es gleich nochmal versuchen. Nenne deshalb NICHTS, was fehlt — keine ' +
					'Begriffe, keine Aufzählung, keine Umschreibung davon. Sag nur, dass noch etwas fehlt, ' +
					'und in welche Richtung es im eigenen Heft schauen kann. Verrate die Antwort nicht.'
				: 'Das war der letzte Versuch. Jetzt darfst du sagen, was gefehlt hat.'
		],
		mitschrieb: opts.mitschrieb,
		eingabe: [
			'Frage:',
			opts.frage,
			'',
			'Das sollte vorkommen:',
			opts.erwartet.length ? opts.erwartet.map((e) => `- ${e}`).join('\n') : '(nichts vorgegeben)',
			'',
			'Auszug aus dem Heft des Kindes:',
			opts.material,
			'',
			'Antwort des Kindes:',
			opts.antwort
		]
	});
}

// ─────────────────────────────────────────────────────────────
// 1c. Gesprächs-Agent — ein Zug, nicht eine Welle (M5)
// ─────────────────────────────────────────────────────────────
//
// Der Unterschied zum Prüf-Agenten ist nicht die Fragenart, sondern der Zuschnitt: der
// Prüf-Agent schreibt drei Fragen auf einmal und sieht die Antworten nie. Dieser hier wird
// einmal pro Kind-Zug gerufen, sieht den ganzen bisherigen Verlauf samt Antworten und
// entscheidet daraus, was als Nächstes passiert.
//
// Die Schleife liegt im Server (gespraech.ts), nicht im SDK: ein Kind überlegt Minuten und
// lädt zwischendurch die Seite neu — ein Tool-Loop könnte darauf nicht warten.

/** Ein Zug, wie er im Verlauf steht — Eingabe für den nächsten Aufruf. */
export type Verlaufszug = {
	wer: 'lernassi' | 'kind';
	text: string;
	/** Bei einer gezählten Frage: wie die Antwort ausging. Sonst null. */
	ergebnis?: string | null;
};

const ZugSchema = z.object({
	// Steht bewusst als erstes Feld: beim Streamen kommen die Felder in dieser Reihenfolge,
	// und das Kind soll den Satz wachsen sehen, nicht auf die Auswahl warten.
	text: z
		.string()
		.describe(
			'Was du dem Kind jetzt sagst. Bei einer Frage IST das die Frage — kein Vorspann, ' +
				'keine zweite Fassung. Ein bis drei Sätze.'
		),
	zug: z
		.enum(['reden', 'frage', 'schluss'])
		.describe(
			'reden = nur sagen, das Kind antwortet frei. frage = das Kind tippt an. ' +
				'schluss = abrunden; NUR wenn dir gesagt wird, dass dies der letzte Zug ist.'
		),
	bezug: z
		.enum(['heft', 'darueber-hinaus'])
		.describe(
			'heft = die Sache steht im Material des Kindes, du darfst dorthin verweisen. ' +
				'darueber-hinaus = du gehst bewusst weiter; dann NICHT aufs Heft verweisen.'
		),
	art: z
		.enum(['single', 'multi', 'yesno', 'order', 'match'])
		.nullable()
		.describe('Nur bei zug "frage". Sonst null. Freitext gibt es hier nicht — das Gespräch IST der Freitext.'),
	auswahl: z
		.array(z.string())
		.describe(
			'single/multi: alle Möglichkeiten (3 bis 4). yesno: leer. order: die Elemente in der ' +
				'RICHTIGEN Reihenfolge — gemischt wird später. match: die linken Begriffe. Sonst leer.'
		),
	partner: z.array(z.string()).describe('Nur bei match: partner[i] gehört zu auswahl[i]. Sonst leer.'),
	richtig: z
		.array(z.string())
		.describe(
			'single: die eine richtige Möglichkeit, wortgleich aus auswahl. multi: alle richtigen. ' +
				'yesno: ["Ja"] oder ["Nein"]. order und match: leer. Sonst leer.'
		),
	zaehlt: z
		.boolean()
		.describe(
			'true, wenn diese Frage wirklich etwas über den Lernstand aussagt und in die Punkte ' +
				'eingehen soll. false bei Fragen, die nur das Gespräch steuern. Bei zug "reden" ' +
					'und "schluss" immer false.'
		),
	punkte: z
		.number()
		.int()
		.min(1)
		.max(3)
		.describe(
			'Wie schwer die Frage ist: 1 = auf Anhieb zu wissen, 2 = braucht Nachdenken, ' +
				'3 = verlangt Verknüpfen. Vergib 3 sparsam. Ohne gezählte Frage: 1.'
		)
});

export type Zug = z.infer<typeof ZugSchema>;

const GESPRAECH_SYSTEM = [
	'Du führst mit einem Kind ein Gespräch über einen Punkt, den es sich selbst vorgenommen hat.',
	'Zwei Dinge zugleich: du findest heraus, wie es um seinen Lernstand steht, und du vertiefst ihn.',
	'Du hältst keinen Vortrag — du fragst, hörst zu und hakst nach.',
	'',
	'DEIN WICHTIGSTER ZUG: geh auf das ein, was das Kind zuletzt gesagt oder angetippt hat.',
	'Ein Zug, der die letzte Antwort nicht aufgreift, ist verschenkt. Genau das ist der',
	'Unterschied zu einer Liste vorgefertigter Fragen.',
	'',
	'Das Heft ist dein Ausgangspunkt, nicht dein Zaun. Du darfst verknüpfen, gegenüberstellen,',
	'nach dem Warum fragen, eine Folge abschätzen lassen, ein Gegenbeispiel prüfen — auch wenn',
	'das im Aufschrieb so nicht steht. Aber setze `bezug` ehrlich: bei "heft" darfst du auf das',
	'eigene Heft verweisen, bei "darueber-hinaus" sagst du dem Kind, dass ihr über seinen',
	'Aufschrieb hinausgeht, und verweist NICHT darauf. Erfinde nichts, was weder im Material',
	'steht noch gesichertes Schulwissen ist.',
	'',
	'Angetippte Fragen sind dein normales Gesprächsmittel, nicht die Ausnahme: sie gehen schnell,',
	'sind eindeutig und halten das Gespräch in Bewegung. Der Großteil deiner Züge sollte eine',
	'sein. Reines Reden nimmst du für das, was eine Auswahl nicht kann — eine Beobachtung',
	'spiegeln, offen nachfragen, einen Zwischenstand ziehen. Sparsam.',
	'',
	'`zaehlt` entscheidet, ob ein Zug in den Lernstand eingeht. Eine Frage, die wirklich etwas',
	'zeigt, zählt. Eine Frage, die nur das Gespräch steuert („Womit fangen wir an?"), zählt nicht.',
	'Sei darin ehrlich — eine Steuerfrage als zählende auszugeben verfälscht den Stand.',
	'Auf eine gezählte Frage gibt es GENAU EINEN Versuch: dein nächster Zug IST das Nachfassen.',
	'',
	'Keine zwei Fragen auf denselben Sachverhalt. Was saß, wird nicht wiederholt — dort gehst du',
	'eine Stufe höher: verbinden, einordnen, begründen.',
	'',
	'Du bekommst bei jedem Zug gesagt, wie viele Punkte deine zählenden Fragen bisher ergeben',
	'und wie viele die Session ergeben soll. Das ist deine Zeiteinteilung: liegst du weit',
	'darunter und hast nur noch wenige Züge, stell jetzt zählende Fragen statt zu reden.',
	'Liegst du gut, hast du Luft für einen offenen Zug oder eine schwerere Frage.',
	'',
	'DAS KIND ERFÄHRT VON ALLEDEM NICHTS. Sprich nie über Punkte, Ziele, Prüfung, Bewertung',
	'oder darüber, wie weit ihr seid. Es soll ein Gespräch sein, keine Prüfung — es gibt auch',
	'keinen Abschnitt, ab dem es „jetzt zählt". Kündige nichts dergleichen an.',
	'',
	'Wenn das Kind etwas schreibt, das nicht zum Lernen gehört — über sich, über andere, über',
	'zu Hause — geh nicht darauf ein und frag nicht nach. Ein freundlicher Satz, dann zurück zum',
	'Stoff. Du bist kein Gesprächspartner für alles.',
	'',
	KIND_TON
];

/**
 * Der nächste Zug — gestreamt. Gibt den Textzuwachs Stück für Stück heraus und daneben die
 * Zusage auf den fertigen, geprüften Zug.
 *
 * Der Aufrufer MUSS `textStrom` auslaufen lassen, sonst wird `fertig` nie erfüllt.
 */
export function naechsterZug(opts: {
	fach: string;
	kapitel: string;
	auftrag: string;
	material: string;
	lernziel: string | null;
	beurteilung: string | null;
	verlauf: Verlaufszug[];
	restzuege: number;
	/** Punkte, die die zählenden Fragen bisher ergeben, und was die Session ergeben soll. */
	punkte: number;
	ziel: number;
	/** Dies ist der letzte Zug: abrunden, keine Frage mehr. */
	abschluss: boolean;
	mitschrieb?: Mitschrieb[];
}): { textStrom: AsyncIterable<string>; fertig: Promise<Zug> } {
	const system = GESPRAECH_SYSTEM.join('\n');
	const eingabe = [
		`Fach: ${opts.fach}`,
		`Kapitel: ${opts.kapitel}`,
		'',
		'Das Kind hat sich diesen Punkt vorgenommen:',
		opts.auftrag,
		'',
		'Lernziel der Lehrkraft für diese Klasse:',
		opts.lernziel ?? '(keines hinterlegt — richte dich allein am Material aus)',
		'',
		'Was du über dieses Kind in diesem Kapitel schon weißt:',
		opts.beurteilung ?? '(noch nichts)',
		'',
		'Material des Kindes:',
		opts.material,
		'',
		'Das Gespräch bisher:',
		...(opts.verlauf.length
			? opts.verlauf.map(
					(z) =>
						`${z.wer === 'kind' ? 'Kind' : 'Du'}: ${z.text}` +
						(z.ergebnis ? `  [${z.ergebnis}]` : '')
				)
			: ['(noch nichts — das ist dein erster Zug)']),
		'',
		`Deine zählenden Fragen ergeben bisher ${opts.punkte} Punkte, die Session soll auf etwa ${opts.ziel} kommen.`,
		`Danach hast du noch etwa ${opts.restzuege} Züge.`,
		'',
		opts.abschluss
			? 'Das ist dein LETZTER Zug. Setze zug "schluss" und runde das Gespräch in einem Satz ' +
				'ab: keine Frage mehr, kein Ergebnis, keine Zahl, kein „das war die Prüfung". ' +
				'Ein Satz, der das Gespräch schließt, mehr nicht.'
			: 'Mach weiter.'
	].join('\n');

	const lauf = streamObject({
		model: modell('gespraech'),
		schema: ZugSchema,
		system,
		prompt: eingabe,
		abortSignal: zeitlimit()
	});

	async function* textStrom() {
		let bisher = '';
		for await (const teil of lauf.partialObjectStream) {
			const t = teil.text;
			if (typeof t === 'string' && t.length > bisher.length) {
				yield t.slice(bisher.length);
				bisher = t;
			}
		}
	}

	const fertig = (async () => {
		// Gleiche Nachsicht wie in `frage`: der Zug ist schon geschrieben und gestreamt, an
		// einem fehlenden Null-Schlüssel darf er nicht mehr scheitern.
		const antwort = await lauf.object.catch((fehler: unknown) =>
			gerettet(ZugSchema, 'gespraech', fehler)
		);
		const usage = await lauf.usage.catch(() => null);
		opts.mitschrieb?.push({
			agent: 'gespraech',
			modell: MODELLE.gespraech(),
			wann: Date.now(),
			system,
			eingabe,
			antwort,
			tokens: usage ? { rein: usage.inputTokens ?? 0, raus: usage.outputTokens ?? 0 } : null
		});
		return antwort;
	})();

	return { textStrom: textStrom(), fertig };
}

// ─────────────────────────────────────────────────────────────
// 2. Spiegel-Agent
// ─────────────────────────────────────────────────────────────

const SpiegelSchema = z.object({
	satz: z
		.string()
		.describe(
			'Ein bis zwei Sätze an das Kind. Beginne damit, was es vorher über sich gesagt hat, ' +
				'und stelle daneben, was die Fragen gezeigt haben. Sage es genau einmal.'
		),
	sitzt: z.array(z.string()).describe('Kurze Etiketten dessen, was sitzt. Höchstens vier.'),
	wackelt: z.array(z.string()).describe('Kurze Etiketten dessen, was noch wackelt. Höchstens vier.'),
	kandidaten: z
		.array(z.string())
		.describe(
			'Zwei bis fünf Dinge, die das Kind als Erstes festmachen könnte — anklickbare Etiketten.'
		)
});

export async function spiegle(opts: {
	kapitel: string;
	selbsteinschaetzung: string;
	ergebnisse: { thema: string; frage: string; ergebnis: string }[];
	material: string;
	beurteilung: string | null;
	mitschrieb?: Mitschrieb[];
}) {
	return frage({
		agent: 'spiegel',
		schema: SpiegelSchema,
		mitschrieb: opts.mitschrieb,
		system: [
			'Du hältst einem Kind einen Spiegel hin: was sitzt schon, was wackelt noch.',
			'Du vergleichst dabei sein eigenes Gefühl von vorher mit dem, was die Fragen gezeigt haben.',
			'',
			'Sei genau und freundlich, nicht tröstend und nicht streng. Fünf Fragen sind eine kleine',
			'Stichprobe — sprich entsprechend („sieht aus als", nicht „du kannst nicht"). Etiketten sind',
			'Inhalte aus dem Heft, keine Noten und keine Prozentzahlen.',
			'',
			KIND_TON
		],
		eingabe: [
			`Kapitel: ${opts.kapitel}`,
			`Das Kind hat vorher gesagt: „${opts.selbsteinschaetzung}"`,
			'',
			'So liefen die Fragen:',
			...opts.ergebnisse.map((e) => `- [${e.ergebnis}] (${e.thema}) ${e.frage}`),
			'',
			'Material des Kindes:',
			opts.material,
			'',
			'Was du über dieses Kind in diesem Kapitel schon weißt:',
			opts.beurteilung ?? '(noch nichts)'
		]
	});
}

// ─────────────────────────────────────────────────────────────
// 3. Plan-Agent
// ─────────────────────────────────────────────────────────────

const PlanSchema = z.object({
	satz: z
		.string()
		.describe(
			'Ein bis zwei Sätze an das Kind, die zum Plan hinführen. Keine Dauerangaben — die ' +
				'stehen an den Punkten selbst.'
		),
	allesSitzt: z
		.boolean()
		.describe('true, wenn es nichts nachzuarbeiten gibt und die Vorschläge freiwillige Kür sind.'),
	vorschlaege: z
		.array(
			z.object({
				auftrag: z
					.string()
					.describe(
						'Was das Kind tun wird, in Worten und in der du-Form — z. B. „die Rentenmark in ' +
							'eigenen Worten erklären". Keine fertige Frage, keine Aufgabenstellung mit Lösung.'
					),
				minuten: z.number().describe('Grobe Dauerschätzung in Minuten, 3 bis 15.'),
				thema: z.string().describe('Titel des Themas aus dem Material, zu dem der Punkt gehört.')
			})
		)
		.describe(
			'Mindestens zwei, höchstens fünf Vorschläge — das Kind nimmt, was es will, und dafür ' +
				'braucht es etwas zu wählen. Nur wenn es wirklich nur eine sinnvolle Sache gibt, ist einer genug.'
		)
});

export async function planVorschlaege(opts: {
	kapitel: string;
	fach: string;
	spiegel: { sitzt: string[]; wackelt: string[] };
	fokus: string[];
	lernziel: string | null;
	material: string;
	beurteilung: string | null;
	schonImPlan: { auftrag: string; status: string }[];
	mitschrieb?: Mitschrieb[];
}) {
	return frage({
		agent: 'plan',
		schema: PlanSchema,
		mitschrieb: opts.mitschrieb,
		system: [
			'Du baust mit dem Kind seinen eigenen Lernplan. Das Kind entscheidet, du schlägst vor.',
			'',
			'Ein Punkt ist ein Auftrag in Worten plus eine Dauerschätzung — nie eine vorgefertigte',
			'Frage: welche Frageform daraus wird, entscheidet später die Übungssession.',
			'Ein Punkt ist so groß, dass er in einer Sitzung zu schaffen ist — sprich darüber aber',
			'nicht mit dem Kind, die Dauer steht an jedem Punkt.',
			'',
			'Was schon im Plan steht oder dort verworfen wurde, schlägst du nicht wieder vor.',
			'Gibt es nichts nachzuarbeiten, sag das klar und biete Freiwilliges eine Stufe höher an.',
			'',
			LERNZIEL_HINWEIS,
			'',
			KIND_TON
		],
		eingabe: [
			`Fach: ${opts.fach}`,
			`Kapitel: ${opts.kapitel}`,
			'',
			`Sitzt schon: ${opts.spiegel.sitzt.join(', ') || '(nichts)'}`,
			`Wackelt noch: ${opts.spiegel.wackelt.join(', ') || '(nichts)'}`,
			`Das Kind will zuerst festmachen: ${opts.fokus.join(', ') || '(nichts ausgewählt)'}`,
			'',
			'Lernziel der Lehrkraft für diese Klasse:',
			opts.lernziel ?? '(keines hinterlegt)',
			'',
			'Schon im Lernplan dieses Fachs:',
			...(opts.schonImPlan.length
				? opts.schonImPlan.map((p) => `- [${p.status}] ${p.auftrag}`)
				: ['(noch nichts)']),
			'',
			'Material des Kindes:',
			opts.material,
			'',
			'Was du über dieses Kind in diesem Kapitel schon weißt:',
			opts.beurteilung ?? '(noch nichts)'
		]
	});
}

// ─────────────────────────────────────────────────────────────
// 4. Beurteilungs-Agent (still, nachlaufend, ohne Kind-Kontakt)
// ─────────────────────────────────────────────────────────────

const BeurteilungSchema = z.object({
	text: z.string().describe('Die fortgeschriebene Beurteilung, 4 bis 10 Sätze Freitext.')
});

export async function schreibeBeurteilung(opts: {
	kapitel: string;
	bisher: string | null;
	selbsteinschaetzung: string | null;
	spiegelReaktion: string | null;
	ergebnisse: { thema: string; frage: string; ergebnis: string }[];
	planpunkte: string[];
	luecke: string | null;
	material: string;
	mitschrieb?: Mitschrieb[];
}) {
	return frage({
		agent: 'beurteilung',
		schema: BeurteilungSchema,
		mitschrieb: opts.mitschrieb,
		system: [
			'Du schreibst das Arbeitsgedächtnis für dieses eine Kapitel fort — für dich selbst',
			'beim nächsten Mal. Kein Zeugnis: weder das Kind noch die Lehrkraft liest das.',
			'',
			'Nimm die bisherige Beurteilung als Ausgangspunkt und schreibe sie weiter, statt sie',
			'zu wiederholen. Halte fest, was tragfähig aussieht, was wackelt, welche Fehlvorstellung',
			'sich zeigt, wie Selbstbild und Ergebnis zueinander stehen und was sich das Kind',
			'vorgenommen hat. Notiere auch, wenn das Material hinter der Erwartung zurückbleibt.',
			'',
			'Nüchtern, konkret, keine Etiketten wie „schwacher Schüler". Fünf Fragen sind eine',
			'kleine Stichprobe — schreibe entsprechend vorsichtig.'
		],
		eingabe: [
			`Kapitel: ${opts.kapitel}`,
			'',
			'Bisherige Beurteilung:',
			opts.bisher ?? '(noch keine)',
			'',
			`Selbsteinschätzung vorher: ${opts.selbsteinschaetzung ?? '(keine)'}`,
			`Reaktion auf den Spiegel: ${opts.spiegelReaktion ?? '(keine)'}`,
			'',
			'Diese Runde:',
			...opts.ergebnisse.map((e) => `- [${e.ergebnis}] (${e.thema}) ${e.frage}`),
			'',
			'Hat sich vorgenommen:',
			...(opts.planpunkte.length ? opts.planpunkte.map((p) => `- ${p}`) : ['(nichts)']),
			'',
			`Lücke zum Lernziel: ${opts.luecke ?? '(keine erkannt)'}`,
			'',
			'Material des Kindes:',
			opts.material
		]
	});
}
