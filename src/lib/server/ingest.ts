// Ingestion: Material aufbauen — aus fotografierten Seiten oder aus getipptem Text.
// Ein Vision-Aufruf liest alle Seiten einer Fotosession und gliedert sie in
// eigenständige Abschnitte — eine einzelne Seite kann schon zwei Themen tragen.
// Der zweite Weg (`leseGetipptes`, unten) macht dasselbe aus einem Text, den das Kind
// selbst geschrieben hat: gegliedert wird da nichts mehr, nur zusammengefasst.
//
// Läuft über Requesty EU (Modelle in EU-Regionen, Zero-Data-Retention).
// Das Bild erreicht das Modell ausschließlich hier.

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

const BASE_URL = env.REQUESTY_BASE_URL ?? 'https://router.eu.requesty.ai/v1';
const MODELL = env.REQUESTY_MODEL ?? 'anthropic/claude-sonnet-4-5';

export class KeinSchluessel extends Error {
	constructor() {
		super('REQUESTY_API_KEY fehlt');
	}
}

const Abschnitt = z.object({
	kapitel: z
		.string()
		.describe(
			'Die größere Unterrichtseinheit, z. B. "Französische Revolution" oder "Bruchrechnen". ' +
				'NICHT die Nummerierung oder Überschrift des Kindes.'
		),
	thema: z.string().describe('Kurzer Titel dieses einen Abschnitts, ohne führende Nummer.'),
	zusammenfassung: z.string().describe('Worum es geht — 2 bis 3 Sätze.'),
	begriffe: z.array(z.string()).max(6).describe('Bis zu 6 zentrale Begriffe dieses Abschnitts.'),
	seiten: z.array(z.number()).describe('Nummern der Seiten, auf denen dieser Abschnitt steht.'),
	transkript: z.string().describe('Der Text dieses Abschnitts, so vollständig wie lesbar.')
});

const Ergebnis = z.object({
	lesbar: z.boolean().describe('false, wenn die Seiten unlesbar sind oder kein Aufschrieb.'),
	// nullable statt optional: Azures strict-Schema verlangt jeden Schlüssel in "required".
	hinweis: z
		.string()
		.nullable()
		.describe('Nur wenn lesbar=false: was das Kind besser machen kann, kindgerecht. Sonst null.'),
	abschnitte: z
		.array(Abschnitt)
		.describe('Ein Eintrag pro eigenständigem Thema. Leer, wenn lesbar=false.')
});

export type IngestErgebnis = z.infer<typeof Ergebnis>;
export type IngestAbschnitt = z.infer<typeof Abschnitt>;

/** Bestehende Gliederung als Text, damit das Modell einordnen statt erfinden kann. */
export function tocAlsText(kapitel: { title: string; themen: string[] }[]): string {
	if (!kapitel.length) return '(noch leer)';
	return kapitel
		.map(
			(k) => `- ${k.title}${k.themen.length ? `\n${k.themen.map((t) => `  - ${t}`).join('\n')}` : ''}`
		)
		.join('\n');
}

/** Das Modell, über das alles Lesen läuft — Foto, Getipptes und die Recherche. */
export function modell() {
	const apiKey = env.REQUESTY_API_KEY;
	if (!apiKey) throw new KeinSchluessel();

	const requesty = createOpenAICompatible({
		name: 'requesty',
		baseURL: BASE_URL,
		apiKey,
		// Erzwingt json_schema statt json_object. Ohne das verlangt Azure das Wort
		// "json" im Prompt und lehnt strukturierte Ausgaben sonst ab.
		supportsStructuredOutputs: true
	});
	return requesty(MODELL);
}

export async function leseAufschrieb(opts: {
	bilder: { daten: Uint8Array; mimeType: string }[];
	fach: string;
	gliederung: string;
	/**
	 * Gesetzt, wenn das Kind die Seiten aus dem Verzeichnis heraus in ein bestimmtes Kapitel
	 * gelegt hat. Dann ist die Einordnung schon entschieden — das Modell teilt nur noch in
	 * Themen. Serverseitig wird `abschnitt.kapitel` in diesem Fall ohnehin nicht gelesen;
	 * im Prompt steht es trotzdem, damit das Modell nicht gegen seine eigene Ausgabe arbeitet.
	 */
	festesKapitel?: string;
}): Promise<IngestErgebnis> {
	const { object } = await generateObject({
		model: modell(),
		schema: Ergebnis,
		system: [
			'Du liest abfotografierte Unterrichtsaufschriebe von Schüler:innen und gliederst sie.',
			'Du bewertest nicht und stellst keine Fragen — du erfasst nur, was auf den Seiten steht.',
			'',
			'Gliederung in zwei Ebenen:',
			'- KAPITEL ist die größere Unterrichtseinheit (z. B. "Französische Revolution", "Bruchrechnen").',
			'  Eine eigene Nummerierung des Kindes ("4.", "5.") ist KEIN Kapitel, sondern eine Folge von Themen',
			'  innerhalb desselben Kapitels.',
			'- THEMA ist ein einzelner, in sich abgeschlossener Abschnitt.',
			'',
			'Wo ein Thema anfängt: Nur an einer echten eigenen Überschrift des Kindes — unterstrichen,',
			'farbig markiert oder eigener Nummerierungspunkt ("4.", "5."). Zwei solche Überschriften auf',
			'einer Seite ergeben zwei Themen; mehrere Seiten zu derselben Überschrift ergeben ein Thema.',
			'',
			'Wo ein Thema NICHT anfängt: an einzelnen Kästchen, Pfeilen, Stichpunkten, Jahreszahlen,',
			'Tabellenspalten oder Schritten INNERHALB eines Abschnitts. Ein Schaubild oder Ablaufdiagramm',
			'ist EIN Thema, auch wenn es aus vielen Kästchen besteht — die Kästchen sind seine Stationen.',
			'Richtwert: meist ein bis zwei Themen pro Seite, selten mehr.',
			'',
			'Das Transkript eines Themas enthält den vollständigen Text dieses Abschnitts, nicht nur die',
			'Überschrift — bei einem Schaubild alle Kästchen in ihrer Reihenfolge.',
			'',
			'Nutze vorhandene Kapitel aus der Gliederung, wenn eines passt. Erfinde keine Inhalte,',
			'die nicht auf den Seiten stehen. Schreibe in der Sprache des Aufschriebs.',
			...(opts.festesKapitel
				? [
						'',
						`Das Kapitel steht schon fest: "${opts.festesKapitel}". Das Kind hat die Seiten selbst`,
						'dort eingeordnet. Trage bei JEDEM Abschnitt genau dieses Kapitel ein und schlage kein',
						'anderes vor — deine Aufgabe ist nur noch, in Themen zu teilen.'
					]
				: [])
		].join('\n'),
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: [
							`Fach: ${opts.fach}`,
							...(opts.festesKapitel ? [`Kapitel (steht fest): ${opts.festesKapitel}`] : []),
							'',
							'Bisherige Kapitel und Themen in diesem Fach:',
							opts.gliederung,
							'',
							`Es folgen ${opts.bilder.length} Seite(n) aus dem Heft, in dieser Reihenfolge: ` +
								opts.bilder.map((_, i) => `Seite ${i + 1}`).join(', ')
						].join('\n')
					},
					...opts.bilder.map((b) => ({
						type: 'file' as const,
						data: b.daten,
						mediaType: b.mimeType
					}))
				]
			}
		]
	});

	return object;
}

// ─────────────────────────────────────────────────────────────
// Selbst getippt: das Kind schreibt den Text, die KI fasst zusammen
// ─────────────────────────────────────────────────────────────
//
// Der zweite Weg, wie eine Seite ins Heft kommt: kein Foto, sondern getippter Text. Gedacht
// für die Fälle, in denen kein Aufschrieb existiert, den man fotografieren könnte — etwas
// nachgeschlagen, im Unterricht nur zugehört, ein Heft vergessen.
//
// Datenschutz: das ist ein offenes Freitextfeld, und offener Freitext ist laut MISSION.md
// der teuerste Teil. Es ist hier aber ein sehr begrenztes offenes Feld — es geht in kein
// Gespräch ein, wird nicht bewertet und nicht an die Lehrkraft übermittelt. Es landet
// genau dort, wo sonst die Abschrift der Fotos steht: im Heft des Kindes.
//
// Was die KI hier tut, ist bewusst wenig: zusammenfassen, Begriffe ziehen, einen Titel
// vorschlagen. Sie ergänzt keinen Inhalt — sonst stünde im Heft des Kindes am Ende Material,
// das nie im Unterricht war, und die Fragen später würden darauf aufbauen.

const Getipptes = z.object({
	verstanden: z
		.boolean()
		.describe('false, wenn der Text zu kurz oder zu unklar ist, um daraus etwas zu machen.'),
	hinweis: z
		.string()
		.nullable()
		.describe('Nur wenn verstanden=false: was das Kind ergänzen kann, kindgerecht. Sonst null.'),
	thema: z
		.string()
		.describe('Titelvorschlag für diesen Abschnitt, kurz und ohne führende Nummer.'),
	zusammenfassung: z.string().describe('Worum es geht — 2 bis 3 Sätze.'),
	begriffe: z.array(z.string()).max(6).describe('Bis zu 6 zentrale Begriffe aus dem Text.')
});

export type GetipptesErgebnis = z.infer<typeof Getipptes>;

export async function leseGetipptes(opts: {
	text: string;
	fach: string;
	kapitel: string;
	gliederung: string;
}): Promise<GetipptesErgebnis> {
	const { object } = await generateObject({
		model: modell(),
		schema: Getipptes,
		system: [
			'Du liest einen Unterrichtsaufschrieb, den eine Schülerin oder ein Schüler selbst getippt hat.',
			'Du bewertest nicht, korrigierst nicht und stellst keine Fragen.',
			'',
			'Deine Aufgabe ist klein und genau umrissen:',
			'- einen kurzen Titel für diesen Abschnitt vorschlagen,',
			'- in 2 bis 3 Sätzen zusammenfassen, worum es geht,',
			'- bis zu 6 zentrale Begriffe aus dem Text ziehen.',
			'',
			'Nimm ausschließlich, was im Text steht. Ergänze KEIN Wissen von außen, auch nicht,',
			'wenn du das Thema besser kennst als der Text es wiedergibt — dieser Text ist der',
			'Unterricht dieses Kindes, und später wird daraus gefragt.',
			'',
			'Rechtschreibung und Grammatik sind kein Maßstab: ein hastig getippter Text ist normal.',
			'Setze verstanden=false nur, wenn wirklich kein Inhalt erkennbar ist (ein paar Wörter,',
			'Tastaturgeklimper) — nicht, weil der Text knapp oder unbeholfen ist.',
			'',
			'Das Kapitel steht fest; du ordnest nichts ein. Schreibe in der Sprache des Textes.'
		].join('\n'),
		messages: [
			{
				role: 'user',
				content: [
					`Fach: ${opts.fach}`,
					`Kapitel: ${opts.kapitel}`,
					'',
					'Bisherige Kapitel und Themen in diesem Fach:',
					opts.gliederung,
					'',
					'Der Text des Kindes:',
					opts.text
				].join('\n')
			}
		]
	});

	return object;
}
