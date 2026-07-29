import { db } from '$lib/server/db';
import { classes, students, user } from '$lib/server/db/schema';
import { heftLesen } from '$lib/server/heft';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const studentId = locals.user.id;

	const zugehoerigkeit = (
		await db
			.select({ klasse: classes.name, lehrkraft: user.name })
			.from(students)
			.innerJoin(classes, eq(classes.id, students.classId))
			.innerJoin(user, eq(user.id, classes.teacherId))
			.where(eq(students.userId, studentId))
	)[0];

	return {
		pseudonym: locals.user.username,
		klasse: zugehoerigkeit?.klasse ?? null,
		lehrkraft: zugehoerigkeit?.lehrkraft ?? null,
		// Die Fächer trägt die Seitenleiste auf jeder Seite, darum hier statt in der Route.
		faecher: await heftLesen(studentId)
	};
};
