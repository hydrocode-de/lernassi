import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { errMsg } from '$lib/server/util';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role === 'teacher') throw redirect(303, '/lehrer');
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const name = String(fd.get('name') ?? '').trim();
		const email = String(fd.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(fd.get('password') ?? '');
		if (!name || !email || password.length < 6)
			return fail(400, {
				message: 'Bitte Name, E-Mail und Passwort (min. 6 Zeichen) angeben.',
				name,
				email
			});
		try {
			const res = await auth.api.signUpEmail({ body: { email, password, name }, headers: request.headers });
			await db.update(user).set({ role: 'teacher' }).where(eq(user.id, res.user.id));
		} catch (e) {
			return fail(400, { message: errMsg(e, 'Registrierung fehlgeschlagen.'), name, email });
		}
		throw redirect(303, '/lehrer');
	}
};
