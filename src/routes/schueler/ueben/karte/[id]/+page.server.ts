// Eine bestimmte Karte üben — der „Üben"-Knopf an einer Zeile im Lernplan. Das Kind darf
// vorarbeiten: die Reihe ist der Vorschlag, nicht das Gefängnis.

import { error, redirect } from '@sveltejs/kit';
import { meineKarte, uebungStarten } from '$lib/server/uebung';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const karte = await meineKarte(locals.user.id, params.id);
	if (!karte) throw error(404, 'Diesen Punkt gibt es nicht.');
	if (karte.status !== 'offen') throw redirect(303, '/schueler/plan');
	throw redirect(303, `/schueler/ueben/${await uebungStarten(locals.user.id, karte)}`);
};
