import { db } from '$lib/server/db';
import { notes, tocEntries, uploadPages, uploads } from '$lib/server/db/schema';
import { entferneAufnahmeBilder } from '$lib/server/bilder';
import { and, eq, inArray } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** Themen und Kapitel, an denen nach dem Verwerfen nichts mehr hängt, verschwinden mit. */
async function raeumeGliederungAuf(studentId: string) {
	const alle = await db.select().from(tocEntries).where(eq(tocEntries.studentId, studentId));
	const meine = await db.select().from(notes).where(eq(notes.studentId, studentId));
	const benutzt = new Set(meine.map((n) => n.topicId).filter(Boolean) as string[]);

	const leereThemen = alle.filter((e) => e.kind === 'topic' && !benutzt.has(e.id));
	if (leereThemen.length)
		await db.delete(tocEntries).where(
			inArray(
				tocEntries.id,
				leereThemen.map((e) => e.id)
			)
		);

	const uebrig = alle.filter((e) => !leereThemen.some((l) => l.id === e.id));
	const leereKapitel = uebrig.filter(
		(e) => e.kind === 'chapter' && !uebrig.some((k) => k.parentId === e.id)
	);
	if (leereKapitel.length)
		await db.delete(tocEntries).where(
			inArray(
				tocEntries.id,
				leereKapitel.map((e) => e.id)
			)
		);

	const nochUebrig = uebrig.filter((e) => !leereKapitel.some((l) => l.id === e.id));
	const leereFaecher = nochUebrig.filter(
		(e) => e.kind === 'subject' && !nochUebrig.some((k) => k.parentId === e.id)
	);
	if (leereFaecher.length)
		await db.delete(tocEntries).where(
			inArray(
				tocEntries.id,
				leereFaecher.map((e) => e.id)
			)
		);
}

async function meineAufnahme(locals: App.Locals, id: string) {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const upload = (
		await db
			.select()
			.from(uploads)
			.where(and(eq(uploads.id, id), eq(uploads.studentId, locals.user.id)))
	)[0];
	if (!upload) throw error(404, 'Nicht gefunden');
	return upload;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const upload = await meineAufnahme(locals, params.id);
	const studentId = locals.user!.id;

	const alle = await db.select().from(tocEntries).where(eq(tocEntries.studentId, studentId));
	const meine = (await db.select().from(notes).where(eq(notes.uploadId, upload.id))).sort(
		(a, b) => a.sortOrder - b.sortOrder
	);

	const fachEintrag = alle.find(
		(e) =>
			e.kind === 'subject' &&
			e.title.localeCompare(upload.subject, 'de', { sensitivity: 'base' }) === 0
	);
	const kapitelAuswahl = alle
		.filter((e) => e.kind === 'chapter' && e.parentId === fachEintrag?.id)
		.sort((a, b) => a.title.localeCompare(b.title, 'de'))
		.map((k) => ({ id: k.id, title: k.title }));

	const themen = meine.map((n) => {
		const thema = alle.find((e) => e.id === n.topicId);
		const kapitel = alle.find((e) => e.id === thema?.parentId);
		return {
			id: n.id,
			thema: thema?.title ?? '',
			kapitel: kapitel?.title ?? '',
			zusammenfassung: n.summary ?? '',
			begriffe: n.keywords ? n.keywords.split(',').map((s) => s.trim()) : [],
			seiten: n.pageNumbers ? n.pageNumbers.split(',').map((s) => Number(s.trim())) : []
		};
	});

	const seiten = (
		await db.select().from(uploadPages).where(eq(uploadPages.uploadId, upload.id))
	)
		.sort((a, b) => a.pageNumber - b.pageNumber)
		.map((s) => ({ id: s.id, nummer: s.pageNumber, hatBild: Boolean(s.imageRef) }));

	return {
		fach: upload.subject,
		seitenGesamt: upload.pageCount,
		themen,
		kapitelAuswahl,
		seiten
	};
};

export const actions: Actions = {
	verschieben: async ({ params, locals, request }) => {
		await meineAufnahme(locals, params.id);
		const studentId = locals.user!.id;
		const fd = await request.formData();
		const noteId = String(fd.get('noteId') ?? '');
		const kapitelId = String(fd.get('kapitelId') ?? '');

		const note = (
			await db
				.select()
				.from(notes)
				.where(and(eq(notes.id, noteId), eq(notes.studentId, studentId)))
		)[0];
		if (!note?.topicId) return fail(400, { message: 'Nicht möglich.' });

		const ziel = (
			await db
				.select()
				.from(tocEntries)
				.where(and(eq(tocEntries.id, kapitelId), eq(tocEntries.studentId, studentId)))
		)[0];
		if (!ziel || ziel.kind !== 'chapter') return fail(400, { message: 'Kapitel nicht gefunden.' });

		await db.update(tocEntries).set({ parentId: ziel.id }).where(eq(tocEntries.id, note.topicId));
		await raeumeGliederungAuf(studentId);
		return { ok: true };
	},

	neuesKapitel: async ({ params, locals, request }) => {
		const upload = await meineAufnahme(locals, params.id);
		const studentId = locals.user!.id;
		const fd = await request.formData();
		const noteId = String(fd.get('noteId') ?? '');
		const titel = String(fd.get('titel') ?? '').trim();
		if (!titel) return fail(400, { message: 'Gib dem Kapitel einen Namen.' });

		const note = (
			await db
				.select()
				.from(notes)
				.where(and(eq(notes.id, noteId), eq(notes.studentId, studentId)))
		)[0];
		if (!note?.topicId) return fail(400, { message: 'Nicht möglich.' });

		const alle = await db.select().from(tocEntries).where(eq(tocEntries.studentId, studentId));
		const fachEintrag = alle.find(
			(e) =>
				e.kind === 'subject' &&
				e.title.localeCompare(upload.subject, 'de', { sensitivity: 'base' }) === 0
		);
		if (!fachEintrag) return fail(400, { message: 'Fach nicht gefunden.' });

		const vorhanden = alle.find(
			(e) =>
				e.kind === 'chapter' &&
				e.parentId === fachEintrag.id &&
				e.title.localeCompare(titel, 'de', { sensitivity: 'base' }) === 0
		);
		const kapitelId =
			vorhanden?.id ??
			(
				await db
					.insert(tocEntries)
					.values({ studentId, kind: 'chapter', title: titel, parentId: fachEintrag.id })
					.returning({ id: tocEntries.id })
			)[0].id;

		await db.update(tocEntries).set({ parentId: kapitelId }).where(eq(tocEntries.id, note.topicId));
		await raeumeGliederungAuf(studentId);
		return { ok: true };
	},

	verwerfen: async ({ params, locals }) => {
		const upload = await meineAufnahme(locals, params.id);
		const studentId = locals.user!.id;
		// Die Aufnahme löschen nimmt über die Fremdschlüssel Seiten und Aufschriebe mit.
		await db.delete(uploads).where(eq(uploads.id, upload.id));
		await entferneAufnahmeBilder(upload.id);
		await raeumeGliederungAuf(studentId);
		throw redirect(303, '/schueler');
	}
};
