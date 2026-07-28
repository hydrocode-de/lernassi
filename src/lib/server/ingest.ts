// Ingestion: aus fotografierten Seiten Material aufbauen.
// Ein Vision-Aufruf liest alle Seiten einer Fotosession und gliedert sie in
// eigenständige Abschnitte — eine einzelne Seite kann schon zwei Themen tragen.
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

export async function leseAufschrieb(opts: {
	bilder: { daten: Uint8Array; mimeType: string }[];
	fach: string;
	gliederung: string;
}): Promise<IngestErgebnis> {
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

	const { object } = await generateObject({
		model: requesty(MODELL),
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
			'die nicht auf den Seiten stehen. Schreibe in der Sprache des Aufschriebs.'
		].join('\n'),
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: [
							`Fach: ${opts.fach}`,
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
