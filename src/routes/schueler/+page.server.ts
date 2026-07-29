// Das Inhaltsverzeichnis bearbeiten: umbenennen, umsortieren, Kapitel anlegen, ein leeres
// Kapitel löschen, ein Thema woanders einordnen. Die Gliederung gehört dem Kind — wenn die
// Einordnung aus M2 daneben liegt, muss es sie selbst geradeziehen können.
//
// Gelesen wird das Verzeichnis im Layout (die Seitenleiste braucht es überall), hier stehen
// nur die Änderungen.

import { db } from '$lib/server/db';
import { verschiebeThema } from '$lib/server/gliederung';
import { notes, tocEntries } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

async function meinEintrag(studentId: string, id: string, kind: 'chapter' | 'topic' | 'subject') {
	const eintrag = (
		await db
			.select()
			.from(tocEntries)
			.where(and(eq(tocEntries.id, id), eq(tocEntries.studentId, studentId)))
	)[0];
	return eintrag && eintrag.kind === kind ? eintrag : null;
}

/** Geschwister in der Reihenfolge, in der sie angezeigt werden. */
async function geschwister(studentId: string, parentId: string) {
	return (
		await db
			.select()
			.from(tocEntries)
			.where(and(eq(tocEntries.studentId, studentId), eq(tocEntries.parentId, parentId)))
	).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de'));
}

function wer(locals: App.Locals): string {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	return locals.user.id;
}

export const actions: Actions = {
	umbenennen: async ({ locals, request }) => {
		const studentId = wer(locals);
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const titel = String(fd.get('titel') ?? '').trim();
		if (!titel) return fail(400, { message: 'Der Name darf nicht leer sein.' });
		if (titel.length > 120) return fail(400, { message: 'Das ist ein sehr langer Name.' });

		const eintrag = (
			await db
				.select()
				.from(tocEntries)
				.where(and(eq(tocEntries.id, id), eq(tocEntries.studentId, studentId)))
		)[0];
		if (!eintrag || eintrag.kind === 'subject')
			return fail(400, { message: 'Das kann ich nicht umbenennen.' });

		await db.update(tocEntries).set({ title: titel }).where(eq(tocEntries.id, id));
		return { ok: `Heißt jetzt „${titel}".` };
	},

	// Umsortieren mit zwei Knöpfen statt Ziehen: geht am Handy, mit der Tastatur und
	// verrutscht nicht versehentlich.
	sortieren: async ({ locals, request }) => {
		const studentId = wer(locals);
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const richtung = String(fd.get('richtung') ?? '');

		const eintrag = (
			await db
				.select()
				.from(tocEntries)
				.where(and(eq(tocEntries.id, id), eq(tocEntries.studentId, studentId)))
		)[0];
		if (!eintrag?.parentId) return fail(400, { message: 'Das kann ich nicht verschieben.' });

		const reihe = await geschwister(studentId, eintrag.parentId);
		const jetzt = reihe.findIndex((e) => e.id === id);
		const ziel = richtung === 'auf' ? jetzt - 1 : jetzt + 1;
		if (jetzt < 0 || ziel < 0 || ziel >= reihe.length) return { ok: null };

		[reihe[jetzt], reihe[ziel]] = [reihe[ziel], reihe[jetzt]];
		// Die ganze Reihe neu durchnummerieren — dann ist die Ordnung danach eindeutig,
		// auch wenn sie vorher überall 0 war.
		for (const [i, e] of reihe.entries())
			await db.update(tocEntries).set({ sortOrder: i + 1 }).where(eq(tocEntries.id, e.id));
		return { ok: null };
	},

	kapitelAnlegen: async ({ locals, request }) => {
		const studentId = wer(locals);
		const fd = await request.formData();
		const fachId = String(fd.get('fachId') ?? '');
		const titel = String(fd.get('titel') ?? '').trim();
		if (!titel) return fail(400, { message: 'Gib dem Kapitel einen Namen.' });
		if (!(await meinEintrag(studentId, fachId, 'subject')))
			return fail(400, { message: 'Dieses Fach kenne ich nicht.' });

		const schon = await geschwister(studentId, fachId);
		if (schon.some((k) => k.title.localeCompare(titel, 'de', { sensitivity: 'base' }) === 0))
			return fail(400, { message: `„${titel}" gibt es hier schon.` });

		await db.insert(tocEntries).values({
			studentId,
			kind: 'chapter',
			title: titel,
			parentId: fachId,
			sortOrder: schon.length + 1
		});
		return { ok: `Kapitel „${titel}" angelegt.` };
	},

	// Nur leere Kapitel: an einem Kapitel mit Themen hängen Aufschriebe.
	kapitelLoeschen: async ({ locals, request }) => {
		const studentId = wer(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const kapitel = await meinEintrag(studentId, id, 'chapter');
		if (!kapitel) return fail(400, { message: 'Dieses Kapitel kenne ich nicht.' });

		const drin = await geschwister(studentId, id);
		if (drin.length)
			return fail(400, {
				message: 'In diesem Kapitel liegen noch Themen. Ordne sie erst woanders ein.'
			});

		await db.delete(tocEntries).where(eq(tocEntries.id, id));
		return { ok: `Kapitel „${kapitel.title}" gelöscht.` };
	},

	// Ein Thema woanders einordnen — mit allen Aufschrieben, die daran hängen.
	themaVerschieben: async ({ locals, request }) => {
		const studentId = wer(locals);
		const fd = await request.formData();
		const ergebnis = await verschiebeThema(studentId, String(fd.get('themaId') ?? ''), {
			kapitelId: String(fd.get('kapitelId') ?? ''),
			neuesKapitel: String(fd.get('neuesKapitel') ?? '')
		});
		return 'fehler' in ergebnis ? fail(400, { message: ergebnis.fehler }) : ergebnis;
	},

	// Ein Thema, an dem kein Aufschrieb mehr hängt, ist ein Überrest — den darf das Kind wegräumen.
	themaLoeschen: async ({ locals, request }) => {
		const studentId = wer(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const thema = await meinEintrag(studentId, id, 'topic');
		if (!thema) return fail(400, { message: 'Dieses Thema kenne ich nicht.' });

		const daran = await db.select().from(notes).where(eq(notes.topicId, id));
		if (daran.length)
			return fail(400, {
				message: 'Zu diesem Thema hast du einen Aufschrieb. Den werfe ich nicht weg.'
			});

		await db.delete(tocEntries).where(eq(tocEntries.id, id));
		return { ok: `„${thema.title}" entfernt.` };
	}
};
