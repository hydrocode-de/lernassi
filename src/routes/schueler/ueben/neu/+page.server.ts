// „Üben" ohne Fachwahl: nimmt die nächste Karte der Warteschlange. Ist die Reihe leer, ist das
// ein Erfolg und keine Fehlermeldung — dann führt der Weg dorthin, wo neue Karten entstehen.

import { redirect } from '@sveltejs/kit';
import { naechsteUebung } from '$lib/server/uebung';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const roundId = await naechsteUebung(locals.user.id);
	if (!roundId) throw redirect(303, '/schueler/plan?leer=1');
	throw redirect(303, `/schueler/ueben/${roundId}`);
};
