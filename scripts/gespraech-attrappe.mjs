// Attrappe für den Requesty-Endpunkt. Antwortet OpenAI-kompatibel, streamt echt in Stücken,
// und liefert je nach System-Prompt die Form, die der jeweilige Agent erwartet.
// Nur zum Durchfahren des Ablaufs — sagt nichts über die Qualität echter Modellantworten.

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);

function zugFuer(prompt) {
	const kindZuege = (prompt.match(/^Kind: /gm) ?? []).length;
	const drehbuch = [
		{
			text: 'Du hast dir die Rentenmark vorgenommen. Fangen wir leicht an: Was sollte sie vor allem bewirken?',
			zug: 'frage',
			bezug: 'heft',
			art: 'single',
			auswahl: ['Die Inflation stoppen', 'Den Krieg finanzieren', 'Die Arbeitslosigkeit senken'],
			partner: [],
			richtig: ['Die Inflation stoppen'],
			zaehlt: true,
			punkte: 2
		},
		{
			text: 'Genau. Und jetzt du: warum hat das überhaupt funktioniert, obwohl kein Gold dahinterstand?',
			zug: 'reden',
			bezug: 'heft',
			art: null,
			auswahl: [],
			partner: [],
			richtig: [],
			zaehlt: false,
			punkte: 1
		},
		{
			text: 'Das trifft es. Jetzt gehen wir kurz über dein Heft hinaus: Würde dasselbe heute auch noch funktionieren?',
			zug: 'frage',
			bezug: 'darueber-hinaus',
			art: 'yesno',
			auswahl: [],
			partner: [],
			richtig: ['Nein'],
			zaehlt: true,
			punkte: 1
		},
		{
			text: 'Zum Schluss: was gehörte alles zur Stabilisierung dazu?',
			zug: 'frage',
			bezug: 'heft',
			art: 'multi',
			auswahl: ['Neue Währung', 'Weniger Staatsausgaben', 'Mehr Geld drucken'],
			partner: [],
			richtig: ['Neue Währung', 'Weniger Staatsausgaben'],
			zaehlt: true,
			punkte: 3
		}
	];
	if (kindZuege < drehbuch.length) return drehbuch[kindZuege];
	return {
		text: 'Das war gutes Nachdenken. Gleich kommen noch ein paar Fragen am Stück.',
		zug: 'schluss',
		bezug: 'heft',
		art: null,
		auswahl: [],
		partner: [],
		richtig: [],
		zaehlt: false,
		punkte: 1
	};
}

const PRUEFUNG = {
	fragen: [
		{
			thema: 'Rentenmark',
			art: 'single',
			punkte: 2,
			frage: 'Womit war die Rentenmark gedeckt?',
			auswahl: ['Mit Grundbesitz und Industrieanlagen', 'Mit Gold', 'Mit Devisen'],
			partner: [],
			richtig: ['Mit Grundbesitz und Industrieanlagen'],
			hinweis: null
		},
		{
			thema: 'Rentenmark',
			art: 'yesno',
			punkte: 1,
			frage: 'Wurde die Rentenmark unbegrenzt ausgegeben?',
			auswahl: [],
			partner: [],
			richtig: ['Nein'],
			hinweis: null
		},
		{
			thema: 'Rentenmark',
			art: 'order',
			punkte: 3,
			frage: 'Bring die Schritte in die richtige Reihenfolge.',
			auswahl: ['Hyperinflation', 'Einführung der Rentenmark', 'Stabilisierung'],
			partner: [],
			richtig: [],
			hinweis: null
		}
	],
	luecke: null
};

function antwortFuer(koerper) {
	const system = (koerper.messages ?? []).find((m) => m.role === 'system')?.content ?? '';
	const prompt = (koerper.messages ?? []).find((m) => m.role === 'user')?.content ?? '';
	if (system.includes('Du führst mit einem Kind ein Gespräch')) return zugFuer(prompt);
	if (system.includes('Abschlussprüfung nach einem Gespräch')) return PRUEFUNG;
	// Beurteilungs-Agent läuft nach dem Abschluss nach.
	if (system.includes('Arbeitsgedächtnis')) return { text: 'Attrappen-Beurteilung.' };
	return { fragen: [], luecke: null };
}

createServer((req, res) => {
	if (!req.url.includes('/chat/completions')) {
		res.writeHead(404).end();
		return;
	}
	let roh = '';
	req.on('data', (d) => (roh += d));
	req.on('end', async () => {
		const koerper = JSON.parse(roh || '{}');
		const inhalt = JSON.stringify(antwortFuer(koerper));
		console.log(`[stub] ${koerper.stream ? 'stream' : 'einmal'} → ${inhalt.slice(0, 70)}…`);

		if (!koerper.stream) {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(
				JSON.stringify({
					id: 'stub',
					object: 'chat.completion',
					model: koerper.model,
					choices: [{ index: 0, message: { role: 'assistant', content: inhalt }, finish_reason: 'stop' }],
					usage: { prompt_tokens: 1200, completion_tokens: 180, total_tokens: 1380 }
				})
			);
			return;
		}

		res.writeHead(200, {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		});
		// In Stücken, mit Pause — sonst prüft der Durchlauf das Streamen gar nicht.
		for (let i = 0; i < inhalt.length; i += 12) {
			res.write(
				`data: ${JSON.stringify({
					id: 'stub',
					object: 'chat.completion.chunk',
					choices: [{ index: 0, delta: { content: inhalt.slice(i, i + 12) } }]
				})}\n\n`
			);
			await new Promise((r) => setTimeout(r, 8));
		}
		res.write(
			`data: ${JSON.stringify({
				id: 'stub',
				object: 'chat.completion.chunk',
				choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
				usage: { prompt_tokens: 1200, completion_tokens: 180, total_tokens: 1380 }
			})}\n\n`
		);
		res.write('data: [DONE]\n\n');
		res.end();
	});
}).listen(PORT, () => console.log(`[stub] hört auf ${PORT}`));
