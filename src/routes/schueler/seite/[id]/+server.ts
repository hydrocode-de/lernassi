import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { consents, uploadPages, uploads } from '$lib/server/db/schema';
import { holeSeite } from '$lib/server/bilder';
import { and, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Liefert eine abgelegte Heftseite aus — nur dem Kind, dem sie gehört, und nur solange
// es seine Fotos behalten möchte. Die Lehrkraft bekommt hierüber nichts.
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw error(403, 'Kein Zugriff');
	const studentId = locals.user.id;

	const treffer = (
		await db
			.select({ imageRef: uploadPages.imageRef })
			.from(uploadPages)
			.innerJoin(uploads, eq(uploads.id, uploadPages.uploadId))
			.where(and(eq(uploadPages.id, params.id), eq(uploads.studentId, studentId)))
	)[0];
	if (!treffer?.imageRef) throw error(404, 'Nicht gefunden');

	const einwilligung = (
		await db.select().from(consents).where(eq(consents.studentId, studentId))
	)[0];
	if (!(einwilligung?.keepOwnImages ?? false) && !dev) throw error(404, 'Nicht gefunden');

	const bild = await holeSeite(treffer.imageRef);
	if (!bild) throw error(404, 'Nicht gefunden');

	return new Response(new Uint8Array(bild.daten), {
		headers: {
			'content-type': bild.typ,
			// Privat und kurzlebig — Heftseiten gehören nicht in fremde Zwischenspeicher.
			'cache-control': 'private, max-age=300'
		}
	});
};
