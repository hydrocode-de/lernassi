import { auth } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role === 'teacher') throw redirect(303, '/lehrer');
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const email = String(fd.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(fd.get('password') ?? '');
		try {
			await auth.api.signInEmail({ body: { email, password }, headers: request.headers });
		} catch {
			return fail(400, { message: 'Anmeldung fehlgeschlagen. E-Mail oder Passwort falsch.', email });
		}
		throw redirect(303, '/lehrer');
	}
};
