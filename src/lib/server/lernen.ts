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
import { generateObject } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

const BASE_URL = env.REQUESTY_BASE_URL ?? 'https://router.eu.requesty.ai/v1';
const STANDARD = env.REQUESTY_MODEL ?? 'anthropic/claude-sonnet-4-5';

/** Eine Modell-Variable pro Agent, alle mit demselben Default. Beim Pilotlauf lässt sich
 *  die klemmende Stelle einzeln tauschen, ohne Code anzufassen. */
const MODELLE = {
	pruef: () => env.REQUESTY_MODEL_PRUEF ?? STANDARD,
	spiegel: () => env.REQUESTY_MODEL_SPIEGEL ?? STANDARD,
	plan: () => env.REQUESTY_MODEL_PLAN ?? STANDARD,
	beurteilung: () => env.REQUESTY_MODEL_BEURTEILUNG ?? STANDARD
};

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
};

async function frage<T>(opts: {
	agent: keyof typeof MODELLE;
	schema: z.ZodType<T>;
	system: string[];
	eingabe: string[];
	mitschrieb?: Mitschrieb[];
}): Promise<T> {
	const apiKey = env.REQUESTY_API_KEY;
	if (!apiKey) throw new KeinSchluessel();

	const requesty = createOpenAICompatible({
		name: 'requesty',
		baseURL: BASE_URL,
		apiKey,
		// Erzwingt json_schema statt json_object — siehe ingest.ts.
		supportsStructuredOutputs: true
	});

	const modell = MODELLE[opts.agent]();
	const system = opts.system.join('\n');
	const eingabe = opts.eingabe.join('\n');

	const { object } = await generateObject({
		model: requesty(modell),
		schema: opts.schema,
		system,
		prompt: eingabe
	});

	opts.mitschrieb?.push({
		agent: opts.agent,
		modell,
		wann: Date.now(),
		system,
		eingabe,
		antwort: object
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

export const FRAGE_ARTEN = ['single', 'multi', 'yesno', 'order', 'match'] as const;
export type FrageArt = (typeof FRAGE_ARTEN)[number];

const FrageSchema = z.object({
	thema: z
		.string()
		.describe('Titel des Themas, aus dem diese Frage stammt — exakt wie in der Material-Liste.'),
	art: z
		.enum(FRAGE_ARTEN)
		.describe(
			'single = eine richtige Antwort; multi = mehrere richtige; yesno = Ja/Nein; ' +
				'order = Reihenfolge legen; match = Paare zuordnen.'
		),
	frage: z.string().describe('Die Frage an das Kind, ein bis zwei Sätze.'),
	auswahl: z
		.array(z.string())
		.describe(
			'single/multi: alle Antwortmöglichkeiten (3 bis 4, genau eine bzw. mehrere richtig). ' +
				'yesno: leer lassen. order: die Elemente in der RICHTIGEN Reihenfolge — gemischt wird ' +
				'später. match: die linken Begriffe.'
		),
	partner: z
		.array(z.string())
		.describe('Nur bei match: partner[i] gehört zu auswahl[i]. Sonst leeres Array.'),
	richtig: z
		.array(z.string())
		.describe(
			'single: die eine richtige Möglichkeit, wortgleich aus auswahl. multi: alle richtigen. ' +
				'yesno: ["Ja"] oder ["Nein"]. order und match: leeres Array.'
		),
	hinweis: z
		.string()
		.nullable()
		.describe(
			'Optionaler Hinweis für einen zweiten Versuch — zeigt zum eigenen Heft, verrät die ' +
				'Antwort nicht. null, wenn ein Hinweis nichts brächte (bei Ja/Nein meistens).'
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
	'Es gibt kein Textfeld: alle Antworten werden angetippt. Nutze die Arten gemischt, aber',
	'nur wo sie passen — eine Reihenfolge nur, wenn im Heft wirklich eine Abfolge steht,',
	'Paare nur bei echten Zuordnungen. Falsche Möglichkeiten müssen plausibel sein und aus',
	'demselben Zusammenhang kommen, nicht albern.',
	'',
	KIND_TON
];

export async function erzeugeFragen(opts: {
	fach: string;
	kapitel: string;
	material: string;
	lernziel: string | null;
	beurteilung: string | null;
	welle: 1 | 2;
	anzahl: number;
	bisher?: { frage: string; thema: string; ergebnis: string }[];
	mitschrieb?: Mitschrieb[];
}): Promise<z.infer<typeof WelleSchema>> {
	const wellenAuftrag =
		opts.welle === 1
			? [
					`Stelle ${opts.anzahl} Fragen für den Anfang. Verteile sie über die Themen des Kapitels`,
					'und fange nicht mit der schwersten an.'
				]
			: [
					`Stelle ${opts.anzahl} weitere Fragen. Nimm gezielt das auf, was gerade gewackelt hat.`,
					'',
					'Aber: keine Frage darf denselben Sachverhalt noch einmal abfragen — eine umformulierte',
					'Wiederholung ist keine neue Frage. Nimm einen anderen Zugang zu derselben Stelle:',
					'nach dem Warum fragen, mit etwas anderem verknüpfen, in eine Reihenfolge bringen,',
					'eine Folge abschätzen. Wo alles saß, geh eine Stufe höher: verbinden, einordnen,',
					'begründen statt abfragen.'
				];

	return frage({
		agent: 'pruef',
		schema: WelleSchema,
		system: PRUEF_SYSTEM,
		mitschrieb: opts.mitschrieb,
		eingabe: [
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
		]
	});
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
