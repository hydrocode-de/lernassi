// Vorspann vor der Einordnung: Was habe ich zu diesem Kapitel, was fehlt — und die
// Nachfrage, ob noch eine Heftseite dazugehört. Erst deren „nein" startet die Runde.
// Damit ist diese Seite auch der Puffer gegen Fehlklicks im Inhaltsverzeichnis.

import {
	darfFortsetzen,
	kapitelKontext,
	materialFuerRunde,
	offeneRunde,
	starteRunde
} from '$lib/server/runde';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const kontext = await kapitelKontext(locals.user.id, params.id);
	if (!kontext) throw error(404, 'Kapitel nicht gefunden');

	const offen = await offeneRunde(locals.user.id, params.id);
	const neue = kontext.themen.filter((t) => t.neu);
	const themenTitel = [...new Set(kontext.themen.map((t) => t.titel))];

	return {
		zurueck: { href: `/schueler?fach=${kontext.fachId}`, text: kontext.fach },
		kapitelId: kontext.kapitelId,
		kapitel: kontext.kapitel,
		fach: kontext.fach,
		fachId: kontext.fachId,
		themen: themenTitel,
		ohneAufschrieb: kontext.ohneAufschrieb,
		aufschriebe: kontext.themen.length,
		zuletzt: kontext.zuletztEingeordnet?.getTime() ?? null,
		// Nur das Neue einordnen, wenn es Neues gibt.
		neueThemen: [...new Set(neue.map((t) => t.titel))],
		nurNeues: neue.length > 0,
		schonEingeordnet: Boolean(kontext.zuletztEingeordnet),
		nimmtSichVor: [...new Set(materialFuerRunde(kontext, true).map((t) => t.titel))],
		fortsetzen: offen && darfFortsetzen(offen, kontext) ? offen.id : null
	};
};

export const actions: Actions = {
	// Die Nachfrage ist mit „nein" beantwortet — jetzt beginnt die Runde.
	start: async ({ params, locals }) => {
		if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
		const kontext = await kapitelKontext(locals.user.id, params.id);
		if (!kontext) throw error(404, 'Kapitel nicht gefunden');
		if (!kontext.themen.length) throw error(400, 'Zu diesem Kapitel liegt noch kein Aufschrieb.');
		const runde = await starteRunde(locals.user.id, kontext);
		throw redirect(303, `/schueler/runde/${runde.id}`);
	}
};
