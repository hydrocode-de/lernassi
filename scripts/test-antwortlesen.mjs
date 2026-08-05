// Prüft, dass eine Modellantwort, die nicht ganz aufs Schema passt, richtig gelesen wird —
// gegen die echten Fehlerbilder, die der Bedrock-Weg im Betrieb geliefert hat.
// Aufruf: node scripts/test-antwortlesen.mjs   (kein Netz, kein Schlüssel nötig)

import { ausRohtext } from '../src/lib/server/antwortlesen.ts';
import { z } from 'zod';

// Schema wie in lernen.ts (dort nicht exportiert, weil das Modul an $env hängt).
const FrageSchema = z.object({
	thema: z.string(),
	art: z.enum(['single', 'multi', 'yesno', 'order', 'match', 'text']),
	punkte: z.number().int().min(1).max(3),
	frage: z.string(),
	auswahl: z.array(z.string()),
	partner: z.array(z.string()),
	richtig: z.array(z.string()),
	hinweis: z.string().nullable()
});
const WelleSchema = z.object({
	fragen: z.array(FrageSchema),
	luecke: z.string().nullable()
});

const f = (extra) => ({
	art: 'single',
	auswahl: ['a', 'b'],
	frage: 'Warum?',
	hinweis: null,
	partner: [],
	punkte: 1,
	richtig: ['a'],
	thema: 'Die Revolution',
	...extra
});
const weg = (obj, schluessel) => {
	const { [schluessel]: _, ...rest } = obj;
	return rest;
};

const faelle = [
	[
		'A: luecke fehlt ganz (das erste Fehlerbild)',
		JSON.stringify({ fragen: [f({})] }),
		(o) => o.luecke === null && o.fragen.length === 1
	],
	[
		'B: partner fehlt — Pflicht-Array (was meinen ersten Fix umgeworfen hat)',
		JSON.stringify({ fragen: [weg(f({}), 'partner')] }),
		(o) => Array.isArray(o.fragen[0].partner) && o.fragen[0].partner.length === 0
	],
	[
		'C: beides fehlt, in mehreren Fragen',
		JSON.stringify({ fragen: [weg(f({}), 'partner'), weg(f({ art: 'order' }), 'partner')] }),
		(o) => o.fragen.length === 2 && o.luecke === null
	],
	[
		'D: alles in einen Fremdschlüssel gewickelt ("parameter name")',
		JSON.stringify({ 'parameter name': { fragen: [f({})], luecke: null } }),
		(o) => o.fragen.length === 1
	],
	[
		'E: Fremdschlüssel UND fehlende Felder zusammen',
		JSON.stringify({ 'parameter name': { fragen: [weg(f({}), 'partner')] } }),
		(o) => o.fragen[0].partner.length === 0 && o.luecke === null
	],
	[
		'F: Fragetext fehlt — darf NICHT gerettet werden, nichts erfinden',
		JSON.stringify({ fragen: [weg(f({}), 'frage')], luecke: null }),
		(o) => o === null
	],
	[
		'G: fragen ist gar keine Liste — nicht zu retten',
		JSON.stringify({ fragen: 'drei Stück', luecke: null }),
		(o) => o === null
	],
	['H: kein JSON — nicht zu retten', 'Entschuldigung, das kann ich nicht.', (o) => o === null],
	['I: leerer Rohtext', undefined, (o) => o === null]
];

let schlecht = 0;
for (const [name, roh, pruefen] of faelle) {
	let ergebnis;
	try {
		ergebnis = ausRohtext(WelleSchema, roh);
	} catch (e) {
		console.log(`FEHLER  ${name} — wirft: ${e.message}`);
		schlecht++;
		continue;
	}
	const ok = pruefen(ergebnis);
	if (!ok) schlecht++;
	console.log(`${ok ? 'ok    ' : 'FALSCH'}  ${name}`);
}
console.log(schlecht ? `\n${schlecht} Fälle falsch.` : '\nAlle Fälle wie erwartet.');
process.exit(schlecht ? 1 : 0);
