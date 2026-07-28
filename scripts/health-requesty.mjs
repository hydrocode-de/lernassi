// Erreichbarkeitstest: Requesty EU + AI SDK. Prüft Key, baseURL, Modell-ID
// und ob strukturierte Ausgaben (generateObject) funktionieren.
// Aufruf: node --env-file=.env scripts/health-requesty.mjs

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

const baseURL = process.env.REQUESTY_BASE_URL ?? 'https://router.eu.requesty.ai/v1';
const modell = process.env.REQUESTY_MODEL;
const key = process.env.REQUESTY_API_KEY;

console.log('baseURL :', baseURL);
console.log('Modell  :', modell);
console.log('Key     :', key ? `gesetzt (${key.length} Zeichen)` : 'FEHLT');
if (!key || !modell) process.exit(1);

// 1) Rohes HTTP: existiert das Modell überhaupt?
try {
	const res = await fetch(`${baseURL}/models`, { headers: { Authorization: `Bearer ${key}` } });
	console.log(`\n[1] GET /models → ${res.status}`);
	if (res.ok) {
		const daten = await res.json();
		const ids = (daten.data ?? []).map((m) => m.id);
		console.log(`    ${ids.length} Modelle verfügbar`);
		console.log(`    "${modell}" dabei: ${ids.includes(modell) ? 'ja' : 'NEIN'}`);
		if (!ids.includes(modell)) {
			const nah = ids.filter((i) => i.includes('luna') || i.includes('gpt-5')).slice(0, 10);
			if (nah.length) console.log('    ähnlich:', nah.join(', '));
		}
	} else {
		console.log('    Antwort:', (await res.text()).slice(0, 300));
	}
} catch (e) {
	console.log('[1] fehlgeschlagen:', e.message);
}

const requesty = createOpenAICompatible({
	name: 'requesty',
	baseURL,
	apiKey: key,
	// json_schema statt json_object — sonst verlangt Azure das Wort "json" im Prompt.
	supportsStructuredOutputs: true
});

// 2) Einfacher Textaufruf
try {
	const { text, usage } = await generateText({
		model: requesty(modell),
		prompt: 'Antworte mit genau einem Wort: funktioniert'
	});
	console.log('\n[2] generateText →', JSON.stringify(text.trim()));
	console.log('    Tokens:', JSON.stringify(usage));
} catch (e) {
	console.log('\n[2] generateText FEHLER:', e.message);
	if (e.responseBody) console.log('    Body:', String(e.responseBody).slice(0, 400));
}

// 3) Strukturierte Ausgabe — das braucht die Ingestion
try {
	const { object } = await generateObject({
		model: requesty(modell),
		schema: z.object({ fach: z.string(), thema: z.string(), begriffe: z.array(z.string()).max(3) }),
		prompt: 'Ordne ein: "Satz des Pythagoras, a²+b²=c², rechtwinkliges Dreieck".'
	});
	console.log('\n[3] generateObject →', JSON.stringify(object));
} catch (e) {
	console.log('\n[3] generateObject FEHLER:', e.message);
	if (e.responseBody) console.log('    Body:', String(e.responseBody).slice(0, 400));
}
