import { db } from '$lib/server/db';
import { consents, notes, tocEntries, uploadPages, uploads } from '$lib/server/db/schema';
import { KeinSchluessel, leseAufschrieb, tocAlsText } from '$lib/server/ingest';
import { darfSpeichern, legeSeiteAb } from '$lib/server/bilder';
import { and, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/schueler/anmelden');
	const faecher = await db
		.select({ id: tocEntries.id, title: tocEntries.title })
		.from(tocEntries)
		.where(and(eq(tocEntries.studentId, locals.user.id), eq(tocEntries.kind, 'subject')));
	return { faecher: faecher.sort((a, b) => a.title.localeCompare(b.title, 'de')) };
};

/** Legt einen Gliederungseintrag an, wenn es ihn unter diesem Elternteil noch nicht gibt. */
async function findeOderLege(
	studentId: string,
	kind: 'subject' | 'chapter' | 'topic',
	title: string,
	parentId: string | null
): Promise<string> {
	const vorhanden = (
		await db
			.select()
			.from(tocEntries)
			.where(and(eq(tocEntries.studentId, studentId), eq(tocEntries.kind, kind)))
	).find(
		(e) =>
			e.parentId === parentId && e.title.localeCompare(title, 'de', { sensitivity: 'base' }) === 0
	);
	if (vorhanden) return vorhanden.id;
	const [neu] = await db
		.insert(tocEntries)
		.values({ studentId, kind, title, parentId })
		.returning({ id: tocEntries.id });
	return neu.id;
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/schueler/anmelden');
		const studentId = locals.user.id;

		const fd = await request.formData();
		const fach = String(fd.get('fach') ?? '').trim();
		const dateien = fd.getAll('seiten').filter((f): f is File => f instanceof File && f.size > 0);

		if (!fach) return fail(400, { message: 'Wähle zuerst, um welches Fach es geht.' });
		if (!dateien.length) return fail(400, { message: 'Nimm mindestens eine Seite auf.' });

		const bilder = await Promise.all(
			dateien.map(async (d) => ({
				daten: new Uint8Array(await d.arrayBuffer()),
				mimeType: d.type || 'image/jpeg'
			}))
		);

		// Bisherige Gliederung dieses Fachs — damit eingeordnet statt erfunden wird.
		const alle = await db.select().from(tocEntries).where(eq(tocEntries.studentId, studentId));
		const fachEintrag = alle.find(
			(e) => e.kind === 'subject' && e.title.localeCompare(fach, 'de', { sensitivity: 'base' }) === 0
		);
		const gliederung = tocAlsText(
			alle
				.filter((e) => e.kind === 'chapter' && e.parentId === fachEintrag?.id)
				.map((k) => ({
					title: k.title,
					themen: alle.filter((t) => t.kind === 'topic' && t.parentId === k.id).map((t) => t.title)
				}))
		);

		let ergebnis;
		try {
			ergebnis = await leseAufschrieb({ bilder, fach, gliederung });
		} catch (e) {
			if (e instanceof KeinSchluessel)
				return fail(503, {
					message: 'Das Lesen ist gerade nicht möglich. Versuch es später nochmal.'
				});
			// Ursache bleibt im Server-Log, das Kind bekommt einen ruhigen Satz.
			console.error('[ingest] Lesen fehlgeschlagen:', e);
			const body = (e as { responseBody?: unknown }).responseBody;
			if (body) console.error('[ingest] Antwort:', String(body).slice(0, 800));
			return fail(502, { message: 'Ich konnte die Seiten nicht lesen. Versuch es nochmal.' });
		}

		if (!ergebnis.lesbar || ergebnis.abschnitte.length === 0) {
			return fail(422, {
				message:
					ergebnis.hinweis ||
					'Ich konnte die Seiten nicht gut lesen. Fotografiere sie noch einmal, mit mehr Licht.'
			});
		}

		// Fotosession anlegen, danach die gefundenen Themen daran hängen.
		const [upload] = await db
			.insert(uploads)
			.values({ studentId, subject: fach, pageCount: bilder.length })
			.returning({ id: uploads.id });

		const einwilligung = (
			await db.select().from(consents).where(eq(consents.studentId, studentId))
		)[0];
		const behalten = einwilligung?.keepOwnImages ?? false;

		for (const [i, bild] of bilder.entries()) {
			const ref = darfSpeichern(behalten)
				? await legeSeiteAb(upload.id, i + 1, bild.daten, bild.mimeType)
				: null;
			await db
				.insert(uploadPages)
				.values({ uploadId: upload.id, pageNumber: i + 1, imageRef: ref });
		}

		const fachId = await findeOderLege(studentId, 'subject', fach, null);
		for (const [i, abschnitt] of ergebnis.abschnitte.entries()) {
			const kapitelId = await findeOderLege(studentId, 'chapter', abschnitt.kapitel, fachId);
			const themaId = await findeOderLege(studentId, 'topic', abschnitt.thema, kapitelId);
			await db.insert(notes).values({
				studentId,
				uploadId: upload.id,
				topicId: themaId,
				transcript: abschnitt.transkript,
				summary: abschnitt.zusammenfassung,
				keywords: abschnitt.begriffe.join(', '),
				pageNumbers: abschnitt.seiten.join(','),
				sortOrder: i
			});
		}

		throw redirect(303, `/schueler/aufnahme/${upload.id}`);
	}
};
