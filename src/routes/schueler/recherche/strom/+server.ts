// Die Recherche, während man zusieht.
//
// Warum eine eigene Route und nicht die Aktion der Seite: das Nachlesen dauert 15 bis 30
// Sekunden, und in dieser Zeit soll das Kind sehen, wo lernassi gerade sucht und warum eine
// Quelle nicht gereicht hat. Über eine Formular-Aktion ginge das nicht — die antwortet einmal,
// am Ende.
//
// Format wie bei der Welle und im Gespräch: eine JSON-Zeile je Ereignis (NDJSON).
//   {"t":"schritt","v":"Ich suche im Klexikon …"}   ein Satz von lernassi, sofort anzeigen
//   {"t":"entwurf","v":{…}}                          Titel, Text, Zusammenfassung, Quellen
//   {"t":"leer","v":"…"}                             nichts gefunden, mit Vorschlag
//   {"t":"fehler","v":"…"}                           klemmt

import { klasseFuerFach } from '$lib/server/klasse';
import { kapitelMitFach } from '$lib/server/gliederung';
import { KeinSchluessel } from '$lib/server/ingest';
import { darfNachlesen, quellenAus, recherchiere } from '$lib/server/recherche';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const THEMA_MAX = 120;
const zeile = (o: unknown) => new TextEncoder().encode(JSON.stringify(o) + '\n');

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const studentId = locals.user.id;

	const { kapitel: kapitelId, thema } = (await request.json()) as {
		kapitel?: string;
		thema?: string;
	};
	const gesucht = (thema ?? '').trim().slice(0, THEMA_MAX);
	if (!gesucht) throw error(400, 'Ohne Thema kann ich nichts nachlesen.');

	const treffer = await kapitelMitFach(studentId, kapitelId ?? '');
	if (!treffer) throw error(404, 'Nicht gefunden');
	const klasse = await klasseFuerFach(studentId, treffer.fach.id);
	if (!darfNachlesen(klasse)) throw error(403, 'Nachlesen ist hier nicht freigegeben.');

	const quellen = quellenAus(klasse?.rechercheQuellen);
	if (!quellen.length) throw error(403, 'Für dieses Fach ist keine Quelle freigegeben.');

	const strom = new ReadableStream({
		async start(steuerung) {
			const schick = (o: unknown) => {
				try {
					steuerung.enqueue(zeile(o));
				} catch {
					// Der Browser ist weg — dann läuft der Rest ins Leere, das ist in Ordnung.
				}
			};

			try {
				const ergebnis = await recherchiere({
					thema: gesucht,
					fach: treffer.fach.title,
					kapitel: treffer.kapitel.title,
					stufe: klasse?.stufe ?? '',
					quellen,
					melde: (s) => schick({ t: 'schritt', v: s.text })
				});

				if (!ergebnis.ok) schick({ t: 'leer', v: ergebnis.hinweis });
				else
					schick({
						t: 'entwurf',
						v: {
							...ergebnis.entwurf,
							quellen: ergebnis.gelesen.map((g) => ({
								name: `${g.label}: „${g.titel}"`,
								url: g.url,
								lizenz: g.lizenz
							}))
						}
					});
			} catch (e) {
				if (e instanceof KeinSchluessel)
					schick({ t: 'fehler', v: 'Nachlesen geht gerade nicht. Versuch es später nochmal.' });
				else {
					console.error('[recherche] fehlgeschlagen:', e);
					schick({ t: 'fehler', v: 'Da ist etwas schiefgegangen. Versuch es nochmal.' });
				}
			} finally {
				steuerung.close();
			}
		}
	});

	return new Response(strom, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};
