import { db } from '$lib/server/db';
import { classes, students, user } from '$lib/server/db/schema';
import { heftLesen } from '$lib/server/heft';
import { skalaLesen } from '$lib/kategorie';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const studentId = locals.user.id;

	// Ein Kind sitzt in mehreren Klassen, je eine pro Fach. Es sieht davon nur die Fächer und
	// wer sie unterrichtet — dass die Klasse „Geschichte 9b" heißt, ist Sache der Lehrkraft.
	const zugehoerigkeiten = await db
		.select({
			fach: classes.subject,
			lehrkraft: user.firstName,
			lehrkraftName: user.name,
			skala: classes.masteryScale
		})
		.from(students)
		.innerJoin(classes, eq(classes.id, students.classId))
		.innerJoin(user, eq(user.id, classes.teacherId))
		.where(eq(students.userId, studentId));

	const rufname = (
		await db.select({ wert: user.firstName }).from(user).where(eq(user.id, studentId))
	)[0]?.wert;

	return {
		pseudonym: locals.user.username,
		rufname: rufname ?? null,
		// Unter welchem Namen das Kind hier steht: sein Vorname, sonst das Pseudonym.
		anzeigename: rufname?.trim() || locals.user.username || 'ich',
		kurse: zugehoerigkeiten.map((z) => ({
			fach: z.fach,
			lehrkraft: z.lehrkraftName ?? z.lehrkraft ?? null
		})),
		// Die Grenzen der Klasse: aus ihnen entsteht bei der Anzeige das Wort am Thema.
		// Mehrere Klassen können verschiedene Grenzen haben — bis die Anzeige das je Fach
		// trennt, gilt die erste.
		skala: skalaLesen(zugehoerigkeiten[0]?.skala ?? null),
		// Die Fächer trägt die Seitenleiste auf jeder Seite, darum hier statt in der Route.
		faecher: await heftLesen(studentId)
	};
};
