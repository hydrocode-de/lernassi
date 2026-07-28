import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { classes, learningGoals, pseudonyms, students, user, account } from '$lib/server/db/schema';
import { makePseudonym } from '$lib/server/roster';
import { and, eq, desc } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function ownedClass(locals: App.Locals, id: string) {
	if (!locals.user || locals.user.role !== 'teacher') throw redirect(303, '/lehrer/anmelden');
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

export const load: PageServerLoad = async ({ params, locals }) => {
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
	return { cls, goals, pseudonyms: ps };
};

export const actions: Actions = {
	createGoal: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const title = String(fd.get('title') ?? '').trim();
		if (!title) return fail(400, { message: 'Bitte einen Titel für das Lernziel angeben.' });
		await db.insert(learningGoals).values({
			classId: cls.id,
			title,
			description: str(fd.get('description')),
			contextPrompt: str(fd.get('contextPrompt')),
			subject: str(fd.get('subject'))
		});
		return { ok: 'Lernziel angelegt.' };
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
