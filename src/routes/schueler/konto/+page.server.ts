import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { classes, consents, students, user } from '$lib/server/db/schema';
import { rufnamePruefen } from '$lib/rufname';
import { and, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const eintrag = (
		await db.select().from(consents).where(eq(consents.studentId, locals.user.id))
	)[0];
	// In der Testumgebung dürfen Fotos behalten werden, damit Transkripte
	// gegen das Original geprüft werden können.
	return {
		zurueck: { href: '/schueler', text: 'Mein Heft' },
		behalten: eintrag?.keepOwnImages ?? false,
		aenderbar: dev
	};
};

export const actions: Actions = {
	rufname: async ({ locals, request }) => {
		if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
		const fd = await request.formData();
		const geprueft = rufnamePruefen(String(fd.get('rufname') ?? ''));
		if (geprueft.fehler) return fail(400, { message: geprueft.fehler });
		await db.update(user).set({ firstName: geprueft.wert }).where(eq(user.id, locals.user.id));
		return { ok: geprueft.wert ? `Du heißt hier jetzt ${geprueft.wert}.` : 'Name entfernt.' };
	},

	// Ein weiteres Fach: nur der Klassencode. Pseudonym und Konto bleiben, wie sie sind.
	beitreten: async ({ locals, request }) => {
		if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
		const fd = await request.formData();
		const code = String(fd.get('code') ?? '').trim().toUpperCase();
		if (!code) return fail(400, { message: 'Bitte den Klassencode eingeben.' });

		const cls = (await db.select().from(classes).where(eq(classes.joinCode, code)))[0];
		if (!cls) return fail(400, { message: 'Diesen Klassencode gibt es nicht.' });

		const schon = (
			await db
				.select()
				.from(students)
				.where(and(eq(students.userId, locals.user.id), eq(students.classId, cls.id)))
		)[0];
		if (schon) return fail(400, { message: `${cls.subject} hast du schon.` });

		await db.insert(students).values({ userId: locals.user.id, classId: cls.id });
		return { ok: `${cls.subject} ist dazugekommen.` };
	},

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
