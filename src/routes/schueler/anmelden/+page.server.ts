import { auth } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role === 'student') throw redirect(303, '/schueler');
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const username = String(fd.get('pseudonym') ?? '').trim();
		const password = String(fd.get('password') ?? '');
		try {
			await auth.api.signInUsername({ body: { username, password }, headers: request.headers });
		} catch {
			return fail(400, { message: 'Anmeldung fehlgeschlagen. Pseudonym oder Passwort falsch.', pseudonym: username });
		}
		throw redirect(303, '/schueler');
	}
};
