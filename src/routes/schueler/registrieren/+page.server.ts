import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { classes, pseudonyms, students } from '$lib/server/db/schema';
import { errMsg } from '$lib/server/util';
import { and, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role === 'student') throw redirect(303, '/schueler');
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const fd = await request.formData();
		const code = String(fd.get('code') ?? '')
			.trim()
			.toUpperCase();
		const pseudonym = String(fd.get('pseudonym') ?? '').trim();
		const password = String(fd.get('password') ?? '');
		const back = { code, pseudonym };
		if (!code || !pseudonym) return fail(400, { message: 'Bitte Klassencode und Pseudonym angeben.', ...back });
		if (password.length < 6) return fail(400, { message: 'Passwort zu kurz (min. 6 Zeichen).', ...back });

		const cls = (await db.select().from(classes).where(eq(classes.joinCode, code)))[0];
		if (!cls) return fail(400, { message: 'Ungültiger Klassencode.', ...back });

		const ps = (
			await db
				.select()
				.from(pseudonyms)
				.where(and(eq(pseudonyms.classId, cls.id), eq(pseudonyms.value, pseudonym)))
		)[0];
		if (!ps) return fail(400, { message: 'Dieses Pseudonym gehört nicht zu dieser Klasse. Frag deine Lehrkraft.', ...back });
		if (ps.claimed) return fail(400, { message: 'Dieses Pseudonym ist schon vergeben.', ...back });

		// Synthetische E-Mail aus dem Pseudonym — keine echte PII, erfüllt nur Better Auths E-Mail-Pflicht.
		const email = `${pseudonym.toLowerCase()}@kids.lernassi.local`;
		let res;
		try {
			res = await auth.api.signUpEmail({
				body: { email, password, name: pseudonym, username: pseudonym },
				headers: request.headers
			});
		} catch (e) {
			return fail(400, { message: errMsg(e, 'Registrierung fehlgeschlagen.'), ...back });
		}
		await db.update(pseudonyms).set({ claimed: true, userId: res.user.id }).where(eq(pseudonyms.id, ps.id));
		await db.insert(students).values({ userId: res.user.id, classId: cls.id });
		throw redirect(303, '/schueler');
	}
};
