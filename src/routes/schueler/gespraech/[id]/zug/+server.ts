// Der nächste Zug von lernassi, gestreamt.
//
// Warum eine eigene Route und keine Form-Action: Form-Actions antworten in einem Stück. Das
// Kind soll den Satz aber wachsen sehen — im Gespräch wartet es bei JEDEM Zug, nicht wie in
// der klassischen Runde nur einmal. Ohne Streaming wäre das die teuerste Stelle der ganzen
// Richtung.
//
// Format: eine JSON-Zeile je Ereignis (NDJSON).
//   {"t":"text","v":"…"}   Zuwachs am Satz
//   {"t":"fertig"}         Zug steht in der Datenbank, die Seite darf neu laden
//   {"t":"fehler","v":"…"} klemmt

import { db } from '$lib/server/db';
import { rounds } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import { KeinSchluessel } from '$lib/server/lernen';
import {
	fuerDenAgenten,
	gespraechsstand,
	karteVon,
	lernassiZug
} from '$lib/server/gespraech';
import { lernzielFuer } from '$lib/server/runde';
import { uebungsKontext } from '$lib/server/uebung';
import type { RequestHandler } from './$types';

const zeile = (o: unknown) => new TextEncoder().encode(JSON.stringify(o) + '\n');

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');

	const runde = (
		await db
			.select()
			.from(rounds)
			.where(and(eq(rounds.id, params.id), eq(rounds.studentId, locals.user.id)))
	)[0];
	if (!runde || runde.modus !== 'gespraech') throw error(404, 'Gespräch nicht gefunden');
	if (runde.status !== 'laufend') throw error(409, 'Dieses Gespräch ist durch.');

	const karte = await karteVon(runde);
	if (!karte) throw error(404, 'Zu diesem Gespräch fehlt der Punkt.');

	const kontext = await uebungsKontext(karte);
	if (!kontext.kapitel) throw error(409, 'Zu diesem Punkt gibt es kein Material.');

	const stand = await gespraechsstand(runde.id, karte);
	// Wer nicht dran ist, bekommt keinen Zug: ein doppelter Aufruf (zwei Tabs, Doppelklick)
	// würde sonst zwei Züge schreiben und das Gespräch entzweien.
	if (stand.dran !== 'lernassi' || stand.durch) throw error(409, 'lernassi ist gerade nicht dran.');

	const lernziel = await lernzielFuer(runde.studentId, kontext.kapitel.fach);
	const verlauf = await fuerDenAgenten(runde.id);

	const strom = new ReadableStream({
		async start(controller) {
			try {
				const lauf = lernassiZug(runde.id, karte, kontext.kapitel!, lernziel, stand, verlauf);
				for await (const stueck of lauf.textStrom) {
					controller.enqueue(zeile({ t: 'text', v: stueck }));
				}
				// Erst wenn der Zug geschrieben ist, darf die Seite neu laden — sonst sähe sie
				// den Zug noch nicht und würde ihn ein zweites Mal anfordern.
				await lauf.fertig;
				controller.enqueue(zeile({ t: 'fertig' }));
			} catch (e) {
				console.error('[gespraech] Zug fehlgeschlagen:', e);
				controller.enqueue(
					zeile({
						t: 'fehler',
						v:
							e instanceof KeinSchluessel
								? 'Das Gespräch ist gerade nicht möglich.'
								: 'Da ist mir etwas dazwischengekommen. Versuch es nochmal.'
					})
				);
			} finally {
				controller.close();
			}
		}
	});

	return new Response(strom, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-store',
			// Sonst puffert ein Reverse-Proxy den Strom und das Streamen war umsonst.
			'x-accel-buffering': 'no'
		}
	});
};
