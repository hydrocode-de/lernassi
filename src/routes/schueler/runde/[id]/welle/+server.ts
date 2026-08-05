// Die nächsten Fragen holen, während man zusieht.
//
// Warum eine eigene Route und nicht der Seiten-Load: eine Welle braucht 10 bis 20 Sekunden. Wird
// sie im Load abgewartet, kann die Seite in dieser Zeit NICHTS anzeigen — kein Hinweis, kein
// Fortschritt, nur eine Seite, die lädt. Hier läuft die Erzeugung neben einer stehenden Seite,
// die vom ersten Moment an zeigt, was kommt.
//
// Format: eine JSON-Zeile je Ereignis (NDJSON), wie im Gespräch.
//   {"t":"lage","v":"schreiben"}  lernassi hat das Heft gesichtet und formuliert
//   {"t":"text","v":"…"}          Zuwachs am Text der ersten Frage
//   {"t":"fertig"}                Fragen stehen in der Datenbank, die Seite darf sie holen
//   {"t":"fehler","v":"…"}        klemmt

import { db } from '$lib/server/db';
import { rounds } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import { KeinSchluessel } from '$lib/server/lernen';
import {
	kapitelKontext,
	materialFuerRunde,
	naechsteFrage,
	welleStroemen
} from '$lib/server/runde';
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
	if (!runde || !runde.chapterId) throw error(404, 'Runde nicht gefunden');
	if (runde.status !== 'laufend') throw error(409, 'Diese Runde ist durch.');

	const kontext = await kapitelKontext(locals.user.id, runde.chapterId);
	if (!kontext) throw error(404, 'Kapitel nicht gefunden');

	const stand = await naechsteFrage(runde.id);
	if (!stand.welleFehlt) throw error(409, 'Es fehlen gerade keine Fragen.');

	const lauf = welleStroemen(
		runde.id,
		stand.welleFehlt,
		kontext,
		materialFuerRunde(kontext, true)
	);

	const strom = new ReadableStream({
		async start(controller) {
			try {
				let etwasGekommen = false;
				for await (const stueck of lauf.textStrom) {
					// Der erste Zuwachs heißt: das Sichten ist vorbei, jetzt wird formuliert.
					if (!etwasGekommen) {
						etwasGekommen = true;
						controller.enqueue(zeile({ t: 'lage', v: 'schreiben' }));
					}
					controller.enqueue(zeile({ t: 'text', v: stueck }));
				}
				// Erst wenn die Fragen geschrieben sind, darf die Seite sie holen.
				await lauf.fertig;
				controller.enqueue(zeile({ t: 'fertig' }));
			} catch (e) {
				console.error('[runde] Welle im Strom fehlgeschlagen:', e);
				controller.enqueue(
					zeile({
						t: 'fehler',
						v:
							e instanceof KeinSchluessel
								? 'Das Üben ist gerade nicht möglich.'
								: 'Da komme ich gerade nicht weiter.'
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
