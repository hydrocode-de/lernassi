import { db } from '$lib/server/db';
import { classes, learningGoals, students } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/schueler/anmelden');
	const st = (await db.select().from(students).where(eq(students.userId, locals.user.id)))[0];
	if (!st) throw redirect(303, '/schueler/anmelden');
	const cls = (await db.select().from(classes).where(eq(classes.id, st.classId)))[0];
	const goals = await db
		.select()
		.from(learningGoals)
		.where(eq(learningGoals.classId, st.classId))
		.orderBy(desc(learningGoals.createdAt));
	return { className: cls?.name ?? '', pseudonym: locals.user.username ?? '', goals };
};
