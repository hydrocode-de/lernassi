import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { consents } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const eintrag = (
		await db.select().from(consents).where(eq(consents.studentId, locals.user.id))
	)[0];
	// In der Testumgebung dürfen Fotos behalten werden, damit Transkripte
	// gegen das Original geprüft werden können.
	return { behalten: eintrag?.keepOwnImages ?? false, aenderbar: dev };
};

export const actions: Actions = {
	umstellen: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
		if (!dev) return fail(403, { message: 'Diese Einstellung ist noch nicht freigegeben.' });
		const studentId = locals.user.id;
		const fd = await request.formData();
		const behalten = String(fd.get('behalten')) === 'true';

		const vorhanden = (
			await db.select().from(consents).where(eq(consents.studentId, studentId))
		)[0];
		if (vorhanden) {
			await db
				.update(consents)
				.set({ keepOwnImages: behalten, updatedAt: new Date() })
				.where(eq(consents.studentId, studentId));
		} else {
			await db.insert(consents).values({ studentId, keepOwnImages: behalten });
		}
		return { behalten };
	}
};
