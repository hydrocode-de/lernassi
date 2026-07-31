import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { rufnamePruefen } from '$lib/rufname';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	return { pseudonym: locals.user.username };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
		const fd = await request.formData();
		const geprueft = rufnamePruefen(String(fd.get('rufname') ?? ''));
		if (geprueft.fehler) return fail(400, { message: geprueft.fehler });

		await db.update(user).set({ firstName: geprueft.wert }).where(eq(user.id, locals.user.id));
		throw redirect(303, '/schueler');
	}
};
