import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { classes, pseudonyms, students, user } from '$lib/server/db/schema';
import { errMsg } from '$lib/server/util';
import { and, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const ANSICHTEN = ['schueler-anmelden', 'schueler-start', 'lehrer-anmelden', 'lehrer-konto'] as const;
type Ansicht = (typeof ANSICHTEN)[number];

function istAnsicht(wert: string | null): wert is Ansicht {
	return ANSICHTEN.includes(wert as Ansicht);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user?.role === 'student') throw redirect(303, '/schueler');
	if (locals.user?.role === 'teacher') throw redirect(303, '/lehrer');

	const gewuenscht = url.searchParams.get('ansicht');
	return { ansicht: istAnsicht(gewuenscht) ? gewuenscht : ('schueler-anmelden' satisfies Ansicht) };
};

export const actions: Actions = {
	'schueler-anmelden': async ({ request }) => {
		const fd = await request.formData();
		const ansicht: Ansicht = 'schueler-anmelden';
		const username = String(fd.get('pseudonym') ?? '').trim();
		const password = String(fd.get('password') ?? '');
		try {
			await auth.api.signInUsername({ body: { username, password }, headers: request.headers });
		} catch {
			return fail(400, {
				ansicht,
				message: 'Anmeldung fehlgeschlagen. Pseudonym oder Passwort falsch.',
				pseudonym: username
			});
		}
		throw redirect(303, '/schueler');
	},

	'schueler-start': async ({ request }) => {
		const fd = await request.formData();
		const ansicht: Ansicht = 'schueler-start';
		// Der Klassencode kommt als sechs einzelne Kästchen zurück.
		const code = fd
			.getAll('code')
			.map((z) => String(z).trim())
			.join('')
			.toUpperCase();
		const pseudonym = String(fd.get('pseudonym') ?? '').trim();
		const password = String(fd.get('password') ?? '');
		const back = { ansicht, code, pseudonym };

		if (!code || !pseudonym)
			return fail(400, { ...back, message: 'Bitte Klassencode und Pseudonym angeben.' });
		if (password.length < 6)
			return fail(400, { ...back, message: 'Passwort zu kurz (min. 6 Zeichen).' });

		const cls = (await db.select().from(classes).where(eq(classes.joinCode, code)))[0];
		if (!cls) return fail(400, { ...back, message: 'Ungültiger Klassencode.' });

		const ps = (
			await db
				.select()
				.from(pseudonyms)
				.where(and(eq(pseudonyms.classId, cls.id), eq(pseudonyms.value, pseudonym)))
		)[0];
		if (!ps)
			return fail(400, {
				...back,
				message: 'Dieses Pseudonym gehört nicht zu dieser Klasse. Frag deine Lehrkraft.'
			});
		if (ps.claimed) return fail(400, { ...back, message: 'Dieses Pseudonym ist schon vergeben.' });

		// Synthetische E-Mail aus dem Pseudonym — keine echte PII, erfüllt nur Better Auths E-Mail-Pflicht.
		const email = `${pseudonym.toLowerCase()}@kids.lernassi.local`;
		let res;
		try {
			res = await auth.api.signUpEmail({
				body: { email, password, name: pseudonym, username: pseudonym },
				headers: request.headers
			});
		} catch (e) {
			return fail(400, { ...back, message: errMsg(e, 'Registrierung fehlgeschlagen.') });
		}
		await db.update(pseudonyms).set({ claimed: true, userId: res.user.id }).where(eq(pseudonyms.id, ps.id));
		await db.insert(students).values({ userId: res.user.id, classId: cls.id });
		// Der Rufname kommt als eigener Schritt danach — freiwillig, darum nicht im Formular.
		throw redirect(303, '/schueler/name');
	},

	'lehrer-anmelden': async ({ request }) => {
		const fd = await request.formData();
		const ansicht: Ansicht = 'lehrer-anmelden';
		const email = String(fd.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(fd.get('password') ?? '');
		try {
			await auth.api.signInEmail({ body: { email, password }, headers: request.headers });
		} catch {
			return fail(400, {
				ansicht,
				message: 'Anmeldung fehlgeschlagen. E-Mail oder Passwort falsch.',
				email
			});
		}
		throw redirect(303, '/lehrer');
	},

	'lehrer-konto': async ({ request }) => {
		const fd = await request.formData();
		const ansicht: Ansicht = 'lehrer-konto';
		const name = String(fd.get('name') ?? '').trim();
		const email = String(fd.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(fd.get('password') ?? '');
		const back = { ansicht, name, email };

		if (!name || !email || password.length < 6)
			return fail(400, {
				...back,
				message: 'Bitte Name, E-Mail und Passwort (min. 6 Zeichen) angeben.'
			});
		try {
			const res = await auth.api.signUpEmail({
				body: { email, password, name },
				headers: request.headers
			});
			await db.update(user).set({ role: 'teacher' }).where(eq(user.id, res.user.id));
		} catch (e) {
			return fail(400, { ...back, message: errMsg(e, 'Registrierung fehlgeschlagen.') });
		}
		throw redirect(303, '/lehrer');
	}
};
