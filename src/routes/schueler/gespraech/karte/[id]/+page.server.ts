// Eine bestimmte Karte im Gespräch üben — der zweite Knopf an einer Zeile im Lernplan.
//
// Solange der Modus erprobt wird, hängt er an einer Umgebungsvariablen: ohne `GESPRAECH=1`
// gibt es den Knopf nicht und diese Route führt zurück zur klassischen Übung. Beide Wege
// stehen nebeneinander, sonst ließe sich nicht vergleichen, ob das Gespräch wirklich trägt.

import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import { gespraechAn, gespraechStarten } from '$lib/server/gespraech';
import { meineKarte, uebungStarten } from '$lib/server/uebung';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const karte = await meineKarte(locals.user.id, params.id);
	if (!karte) throw error(404, 'Diesen Punkt gibt es nicht.');
	if (karte.status !== 'offen') throw redirect(303, '/schueler/plan');

	if (!gespraechAn(env)) {
		throw redirect(303, `/schueler/ueben/${await uebungStarten(locals.user.id, karte)}`);
	}
	throw redirect(303, `/schueler/gespraech/${await gespraechStarten(locals.user.id, karte)}`);
};
