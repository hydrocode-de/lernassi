import { db } from '$lib/server/db';
import { notes, tocEntries, uploads } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function meineAufnahme(locals: App.Locals, id: string) {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/schueler/anmelden');
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

	return {
		fach: upload.subject,
		seitenGesamt: upload.pageCount,
		themen,
		kapitelAuswahl
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
		return { ok: true };
	}
};
