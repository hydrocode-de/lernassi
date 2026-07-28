// Experiment: Kann das Modell einen Mehrseiten-Upload in mehrere Themen zerlegen —
// auch wenn eine einzelne Seite zwei Themen enthält?
// Aufruf: node --env-file=.env scripts/test-zerlegung.mjs testing/aufschriebe/*.jpg

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject } from 'ai';
import { z } from 'zod';

const dateien = process.argv.slice(2);
if (!dateien.length) {
	console.error('Keine Bilder angegeben.');
	process.exit(1);
}

const requesty = createOpenAICompatible({
	name: 'requesty',
	baseURL: process.env.REQUESTY_BASE_URL ?? 'https://router.eu.requesty.ai/v1',
	apiKey: process.env.REQUESTY_API_KEY,
	supportsStructuredOutputs: true
});

const Schema = z.object({
	abschnitte: z
		.array(
			z.object({
				kapitel: z.string(),
				thema: z.string(),
				zusammenfassung: z.string(),
				begriffe: z.array(z.string()).max(6),
				seiten: z.array(z.number()).describe('Nummern der Seiten, auf denen dieses Thema steht.'),
				transkript: z.string()
			})
		)
		.describe('Ein Eintrag pro eigenständigem Thema. Eine Seite kann mehrere Themen enthalten.')
});

const bilder = await Promise.all(
	dateien.map(async (p, i) => ({
		nummer: i + 1,
		name: basename(p),
		daten: new Uint8Array(await readFile(p))
	}))
);

console.log('Seiten:', bilder.map((b) => `${b.nummer}=${b.name}`).join(', '));
console.log('Modell:', process.env.REQUESTY_MODEL, '\n');

const start = Date.now();
const { object, usage } = await generateObject({
	model: requesty(process.env.REQUESTY_MODEL),
	schema: Schema,
	system:
		'Du liest abfotografierte Unterrichtsaufschriebe und gliederst sie. Ein Aufschrieb kann mehrere ' +
		'eigenständige Themen enthalten — auch auf einer einzigen Seite. Lege pro Thema einen eigenen ' +
		'Abschnitt an. Nutze die Gliederung des Kindes (z. B. eigene Nummerierung, Überschriften, ' +
		'Markierungen) als Hinweis. Erfinde nichts, was nicht auf den Seiten steht.',
	messages: [
		{
			role: 'user',
			content: [
				{
					type: 'text',
					text:
						`Fach: Geschichte\nBisherige Gliederung: (noch leer)\n\n` +
						`Es folgen ${bilder.length} Seiten, in dieser Reihenfolge: ` +
						bilder.map((b) => `Seite ${b.nummer}`).join(', ')
				},
				...bilder.map((b) => ({ type: 'file', data: b.daten, mediaType: 'image/jpeg' }))
			]
		}
	]
});

console.log(`Dauer: ${((Date.now() - start) / 1000).toFixed(1)}s · Tokens: ${usage.totalTokens}\n`);
console.log(`${object.abschnitte.length} Abschnitte erkannt:\n`);
for (const a of object.abschnitte) {
	console.log(`── ${a.kapitel}  ↳  ${a.thema}`);
	console.log(`   Seiten   : ${a.seiten.join(', ')}`);
	console.log(`   Begriffe : ${a.begriffe.join(', ')}`);
	console.log(`   Kurz     : ${a.zusammenfassung}`);
	console.log(`   Transkript: ${a.transkript.length} Zeichen\n`);
}
