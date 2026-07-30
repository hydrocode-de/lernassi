import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { classes, learningGoals, pseudonyms, students, user, account } from '$lib/server/db/schema';
import { makePseudonym } from '$lib/server/roster';
import { ZIEL_WARNSCHWELLE } from '$lib/lernziel';
import { KATEGORIEN, skalaLesen, skalaSchreiben } from '$lib/kategorie';
import { kindBild, themenblick } from '$lib/server/fortschritt';
import { SICHERHEIT } from '$lib/server/runde';
import { RUECKSCHAU } from '$lib/server/uebung';
import { and, eq, desc } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function ownedClass(locals: App.Locals, id: string) {
	if (!locals.user || locals.user.role !== 'teacher') throw redirect(303, '/anmelden?ansicht=lehrer-anmelden');
	const cls = (
		await db
			.select()
			.from(classes)
			.where(and(eq(classes.id, id), eq(classes.teacherId, locals.user.id)))
	)[0];
	if (!cls) throw error(404, 'Klasse nicht gefunden');
	return cls;
}

function str(v: FormDataEntryValue | null): string | null {
	const s = String(v ?? '').trim();
	return s.length ? s : null;
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const cls = await ownedClass(locals, params.id);
	const goals = await db
		.select()
		.from(learningGoals)
		.where(eq(learningGoals.classId, cls.id))
		.orderBy(desc(learningGoals.createdAt));
	const ps = await db
		.select()
		.from(pseudonyms)
		.where(eq(pseudonyms.classId, cls.id))
		.orderBy(desc(pseudonyms.createdAt));

	// Themenblick zuerst; ein Kind nur, wenn die Lehrkraft eines angetippt hat.
	const skala = skalaLesen(cls.masteryScale);
	const { themen, kinder } = await themenblick(cls.id, skala);
	const gewaehltesKind = url.searchParams.get('kind');

	return {
		cls,
		goals,
		pseudonyms: ps,
		warnschwelle: ZIEL_WARNSCHWELLE,
		skala,
		kategorien: KATEGORIEN,
		themen,
		kinder,
		kind: gewaehltesKind ? await kindBild(cls.id, gewaehltesKind, skala) : null,
		sicherheiten: SICHERHEIT,
		rueckschauen: RUECKSCHAU
	};
};

export const actions: Actions = {
	// Ein aktuelles Lernziel pro Fach, fortgeschrieben statt ergänzt.
	speichereZiel: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const subject = str(fd.get('subject'));
		const text = String(fd.get('text') ?? '').trim();
		if (!subject) return fail(400, { message: 'Bitte das Fach angeben.' });
		if (!text) return fail(400, { message: 'Bitte das Lernziel eintragen.' });

		const vorhanden = (
			await db.select().from(learningGoals).where(eq(learningGoals.classId, cls.id))
		).find((z) => z.subject?.localeCompare(subject, 'de', { sensitivity: 'base' }) === 0);

		if (vorhanden) {
			await db
				.update(learningGoals)
				.set({ title: subject, subject, description: text, updatedAt: new Date() })
				.where(eq(learningGoals.id, vorhanden.id));
		} else {
			await db.insert(learningGoals).values({
				classId: cls.id,
				title: subject,
				subject,
				description: text,
				updatedAt: new Date()
			});
		}

		return {
			ok: `Lernziel für ${subject} gespeichert.`,
			// Warnen, nicht blockieren: zu viel Kontext verwässert die Fragenauswahl.
			warnung:
				text.length > ZIEL_WARNSCHWELLE
					? `Das Lernziel ist mit ${text.length} Zeichen sehr lang. Je knapper die Kompetenzen ` +
						'formuliert sind, desto gezielter wählt lernassi die Fragen aus.'
					: null
		};
	},

	// Die Grenzen der Skala. Sie wirken RÜCKWIRKEND auf alle Kinder der Klasse — es wird nichts
	// nachgerechnet, weil nur rohe Punkte gespeichert sind und das Wort immer neu entsteht.
	speichereSkala: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const zahlen = ['eins', 'zwei', 'drei'].map((f) => Number(fd.get(f)));
		if (zahlen.some((z) => !Number.isFinite(z) || z < 1 || z > 100))
			return fail(400, { message: 'Bitte drei Grenzen zwischen 1 und 100 angeben.' });
		if (!(zahlen[0] > zahlen[1] && zahlen[1] > zahlen[2]))
			return fail(400, {
				message: 'Die Grenzen müssen fallen: „sitzt" höher als „fast sicher", das höher als „wackelt".'
			});

		await db
			.update(classes)
			.set({
				masteryScale: skalaSchreiben([{ ab: zahlen[0] }, { ab: zahlen[1] }, { ab: zahlen[2] }])
			})
			.where(eq(classes.id, cls.id));
		return {
			ok: `Grenzen gespeichert: sitzt ab ${zahlen[0]} %, fast sicher ab ${zahlen[1]} %, wackelt ab ${zahlen[2]} %.`
		};
	},

	generatePseudonyms: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const count = Math.min(40, Math.max(1, parseInt(String(fd.get('count') ?? '0'), 10) || 0));
		if (!count) return fail(400, { message: 'Bitte eine Anzahl zwischen 1 und 40 angeben.' });
		let created = 0;
		for (let i = 0; i < count; i++) {
			for (let tries = 0; tries < 8; tries++) {
				const value = makePseudonym();
				const dupPs = await db.select().from(pseudonyms).where(eq(pseudonyms.value, value));
				const dupUser = await db.select().from(user).where(eq(user.username, value));
				if (dupPs.length === 0 && dupUser.length === 0) {
					await db.insert(pseudonyms).values({ classId: cls.id, value });
					created++;
					break;
				}
			}
		}
		return { ok: `${created} Pseudonyme erzeugt.` };
	},

	resetPassword: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const userId = String(fd.get('userId') ?? '');
		const newPassword = String(fd.get('newPassword') ?? '');
		if (newPassword.length < 6) return fail(400, { message: 'Neues Passwort zu kurz (min. 6 Zeichen).' });
		const st = (
			await db
				.select()
				.from(students)
				.where(and(eq(students.userId, userId), eq(students.classId, cls.id)))
		)[0];
		if (!st) return fail(400, { message: 'Schüler:in gehört nicht zu dieser Klasse.' });
		const ctx = await auth.$context;
		const hash = await ctx.password.hash(newPassword);
		await db
			.update(account)
			.set({ password: hash })
			.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
		return { ok: 'Passwort zurückgesetzt.' };
	}
};
