import { db } from '$lib/server/db';
import { classes } from '$lib/server/db/schema';
import { makeJoinCode } from '$lib/server/roster';
import { eq, desc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'teacher') throw redirect(303, '/lehrer/anmelden');
	const list = await db
		.select()
		.from(classes)
		.where(eq(classes.teacherId, locals.user.id))
		.orderBy(desc(classes.createdAt));
	return { classes: list };
};

export const actions: Actions = {
	createClass: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'teacher') throw redirect(303, '/lehrer/anmelden');
		const fd = await request.formData();
		const name = String(fd.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'Bitte einen Klassennamen angeben.' });
		let code = makeJoinCode();
		for (let i = 0; i < 6; i++) {
			const ex = await db.select().from(classes).where(eq(classes.joinCode, code));
			if (ex.length === 0) break;
			code = makeJoinCode();
		}
		await db.insert(classes).values({ teacherId: locals.user.id, name, joinCode: code });
		return { ok: 'Klasse angelegt.' };
	}
};
