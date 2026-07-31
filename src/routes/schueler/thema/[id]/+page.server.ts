// Ein einzelner Eintrag: Zusammenfassung, Abschrift der Seiten und – wenn das Kind seine
// Fotos behält – die Heftseiten selbst. Von hier aus kann es das Thema woanders einordnen
// oder das ganze Kapitel durchgehen.

import { db } from '$lib/server/db';
import { consents, notes, tocEntries, uploadPages } from '$lib/server/db/schema';
import { verschiebeThema } from '$lib/server/gliederung';
import { and, eq, inArray } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const studentId = locals.user.id;

	const thema = (
		await db
			.select()
			.from(tocEntries)
			.where(and(eq(tocEntries.id, params.id), eq(tocEntries.studentId, studentId)))
	)[0];
	if (!thema || thema.kind !== 'topic' || !thema.parentId) throw error(404, 'Nicht gefunden');

	const kapitel = (await db.select().from(tocEntries).where(eq(tocEntries.id, thema.parentId)))[0];
	const fach = kapitel?.parentId
		? (await db.select().from(tocEntries).where(eq(tocEntries.id, kapitel.parentId)))[0]
		: null;
	if (!kapitel || !fach) throw error(404, 'Nicht gefunden');

	const meine = (await db.select().from(notes).where(eq(notes.topicId, thema.id))).sort(
		(a, b) => a.createdAt.getTime() - b.createdAt.getTime()
	);

	const uploadIds = [...new Set(meine.map((n) => n.uploadId).filter((x): x is string => !!x))];
	const seiten = uploadIds.length
		? await db.select().from(uploadPages).where(inArray(uploadPages.uploadId, uploadIds))
		: [];

	const einwilligung = (
		await db.select().from(consents).where(eq(consents.studentId, studentId))
	)[0];

	const aufschriebe = meine.map((n) => {
		const nummern = n.pageNumbers
			? n.pageNumbers
					.split(',')
					.map((s) => Number(s.trim()))
					.filter((x) => Number.isFinite(x))
			: [];
		return {
			id: n.id,
			wann: n.createdAt.getTime(),
			geaendert: n.updatedAt?.getTime() ?? null,
			zusammenfassung: n.summary ?? '',
			begriffe: n.keywords ? n.keywords.split(',').map((s) => s.trim()).filter(Boolean) : [],
			// Die Abschrift steht im Transkript — pro Seite gibt es keine eigene Spalte,
			// darum kommt sie als ein Block mit den Seitennummern davor.
			abschrift: n.transcript ?? '',
			seiten: nummern.map((nummer) => {
				const seite = seiten.find(
					(s) => s.uploadId === n.uploadId && s.pageNumber === nummer
				);
				return { nummer, id: seite?.id ?? null, hatBild: Boolean(seite?.imageRef) };
			})
		};
	});

	// Geschwisterkapitel als Ziel fürs Umsortieren.
	const kapitelAuswahl = (
		await db
			.select()
			.from(tocEntries)
			.where(and(eq(tocEntries.studentId, studentId), eq(tocEntries.parentId, fach.id)))
	)
		.filter((k) => k.id !== kapitel.id)
		.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de'))
		.map((k) => ({ id: k.id, title: k.title }));

	return {
		zurueck: { href: `/schueler?fach=${fach.id}`, text: fach.title },
		thema: { id: thema.id, title: thema.title },
		kapitel: { id: kapitel.id, title: kapitel.title },
		fach: { id: fach.id, title: fach.title },
		aufschriebe,
		seitenGesamt: aufschriebe.reduce((s, a) => s + a.seiten.length, 0),
		fotosBehalten: einwilligung?.keepOwnImages ?? false,
		kapitelAuswahl
	};
};

export const actions: Actions = {
	verschieben: async ({ locals, params, request }) => {
		if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
		const fd = await request.formData();
		const ergebnis = await verschiebeThema(locals.user.id, params.id, {
			kapitelId: String(fd.get('kapitelId') ?? ''),
			neuesKapitel: String(fd.get('neuesKapitel') ?? '')
		});
		return 'fehler' in ergebnis ? fail(400, { message: ergebnis.fehler }) : ergebnis;
	}
};
