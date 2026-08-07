// Nachlesen: der dritte Weg, eine Seite zu füllen. Erreichbar aus dem Editor, wenn das Kind
// noch nichts zu schreiben hat.
//
// Die Seite selbst tut wenig: sie prüft, ob nachgelesen werden darf, und zeigt am Ende
// dasselbe Formular wie der Editor. Die Arbeit läuft über `strom/+server.ts`, damit das Kind
// zusehen kann, wo lernassi nachliest — der Load würde nur eine leere Seite blockieren.
//
// Der Entwurf wird NICHT gespeichert. Gespeichert wird erst, was das Kind übernimmt: dieselbe
// Aktion wie beim selbst geschriebenen Text, nur mit `herkunft='recherche'` und den Artikeln
// als Quelle.

import { db } from '$lib/server/db';
import { notes, tocEntries } from '$lib/server/db/schema';
import { einsortieren, kapitelMitFach } from '$lib/server/gliederung';
import { themenReihenfolge } from '$lib/server/heft';
import { klasseFuerFach } from '$lib/server/klasse';
import { quellenSchreiben } from '$lib/server/quelle';
import { darfNachlesen, quellenAus } from '$lib/server/recherche';
import { eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const studentId = locals.user.id;

	const treffer = await kapitelMitFach(studentId, url.searchParams.get('kapitel') ?? '');
	if (!treffer) throw error(404, 'Nicht gefunden');
	const { kapitel, fach } = treffer;

	const klasse = await klasseFuerFach(studentId, fach.id);
	if (!darfNachlesen(klasse)) throw error(403, 'Nachlesen ist hier nicht freigegeben.');

	const themen = await themenReihenfolge(studentId, kapitel.id);
	const roheStelle = url.searchParams.get('nach');
	const stelle = roheStelle === 'anfang' || themen.some((t) => t.id === roheStelle) ? roheStelle : '';

	return {
		fach: { id: fach.id, title: fach.title },
		kapitel: { id: kapitel.id, title: kapitel.title },
		stelle,
		// Vorbelegt mit dem Kapitel: der Normalfall ist ein Sachbegriff, kein freier Satz.
		vorschlag: kapitel.title,
		quellen: quellenAus(klasse?.rechercheQuellen).map((q) => q.label)
	};
};

export const actions: Actions = {
	// Übernehmen: aus dem Entwurf wird eine Seite im Heft. Erst hier wird gespeichert.
	uebernehmen: async ({ locals, request }) => {
		if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
		const studentId = locals.user.id;
		const fd = await request.formData();

		const treffer = await kapitelMitFach(studentId, String(fd.get('kapitel') ?? ''));
		if (!treffer) return fail(400, { message: 'Das Kapitel kenne ich nicht.' });
		const klasse = await klasseFuerFach(studentId, treffer.fach.id);
		if (!darfNachlesen(klasse))
			return fail(403, { message: 'Nachlesen ist hier nicht freigegeben.' });

		const titel = String(fd.get('titel') ?? '').trim();
		const text = String(fd.get('text') ?? '').trim();
		const zusammenfassung = String(fd.get('zusammenfassung') ?? '').trim();
		const begriffe = String(fd.get('begriffe') ?? '').trim();
		if (!titel || !text) return fail(400, { message: 'Da fehlt noch etwas.' });

		// Die gelesenen Artikel kommen als JSON aus dem Formular zurück — sie stehen im Entwurf
		// auf dem Bildschirm, und was das Kind übernimmt, übernimmt sie mit.
		let quellen: { name: string; url?: string; lizenz?: string }[] = [];
		try {
			const rohe = JSON.parse(String(fd.get('quellen') ?? '[]'));
			if (Array.isArray(rohe)) quellen = rohe.filter((q) => q && typeof q.name === 'string');
		} catch {
			// Ohne lesbare Quellenliste lieber ohne Quelle speichern als gar nicht.
		}

		const [thema] = await db
			.insert(tocEntries)
			.values({ studentId, kind: 'topic', title: titel.slice(0, 120), parentId: treffer.kapitel.id })
			.returning({ id: tocEntries.id });

		const [note] = await db
			.insert(notes)
			.values({
				studentId,
				topicId: thema.id,
				herkunft: 'recherche',
				transcript: text,
				summary: zusammenfassung,
				keywords: begriffe
			})
			.returning({ id: notes.id });

		await quellenSchreiben(note.id, quellen);
		await einsortieren(studentId, treffer.kapitel.id, [thema.id], String(fd.get('nach') ?? ''));
		throw redirect(303, `/schueler/thema/${thema.id}`);
	}
};
