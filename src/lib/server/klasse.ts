// Welche Klasse zu einem Fach im Heft gehört — und umgekehrt, welche Fächer ein Kind hat.
//
// Ein Fach im Heft IST eine Klasse. Das war immer die Absicht, stand aber nirgends im
// Datenmodell: das Kind tippte den Fachnamen beim Fotografieren selbst, und Lernziel wie
// Skala wurden über einen Namensvergleich gesucht. Wer „Gesch." schrieb, arbeitete ohne
// Lernziel weiter, ohne dass es jemand merkte.
//
// Seit `tocEntries.classId` ist die Verbindung eine ID. Alles, was an der Klasse hängt —
// Lernziel, Lernstands-Skala, Klassenstufe, Freigaben der Lehrkraft — wird von hier geholt.

import { db } from '$lib/server/db';
import { classes, students, tocEntries } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export type MeineKlasse = {
	id: string;
	fach: string;
	name: string;
	stufe: string;
	skala: string | null;
	/** Freigaben der Lehrkraft für dieses Fach. */
	recherche: boolean;
	rechercheQuellen: string | null;
};

/** Die Klassen eines Kindes — je eine pro Fach. Das ist die Auswahl, wenn es etwas ablegt. */
export async function meineKlassen(studentId: string): Promise<MeineKlasse[]> {
	const zeilen = await db
		.select({
			id: classes.id,
			fach: classes.subject,
			name: classes.name,
			stufe: classes.grade,
			skala: classes.masteryScale,
			recherche: classes.recherche,
			rechercheQuellen: classes.rechercheQuellen
		})
		.from(students)
		.innerJoin(classes, eq(classes.id, students.classId))
		.where(eq(students.userId, studentId));

	return zeilen
		.filter((z) => z.fach.trim().length > 0)
		.sort((a, b) => a.fach.localeCompare(b.fach, 'de'));
}

/** Eine bestimmte Klasse dieses Kindes — oder null, wenn es nicht darin sitzt. */
export async function meineKlasse(studentId: string, classId: string): Promise<MeineKlasse | null> {
	return (await meineKlassen(studentId)).find((k) => k.id === classId) ?? null;
}

/**
 * Die Klasse hinter einem Fach-Eintrag des Hefts. `null` bei Altdaten, die beim Umzug keiner
 * Klasse zugeordnet werden konnten — die laufen weiter ohne Lernziel und mit der Standardskala.
 */
export async function klasseFuerFach(
	studentId: string,
	fachId: string
): Promise<MeineKlasse | null> {
	const fach = (
		await db
			.select({ classId: tocEntries.classId })
			.from(tocEntries)
			.where(and(eq(tocEntries.id, fachId), eq(tocEntries.studentId, studentId)))
	)[0];
	if (!fach?.classId) return null;
	return meineKlasse(studentId, fach.classId);
}

/**
 * Der Fach-Zweig dieser Klasse im Heft des Kindes — angelegt, wenn er noch nicht da ist.
 * Gesucht wird über die Klassen-ID, nicht über den Titel: benennt die Lehrkraft ihr Fach um,
 * bleiben die Aufschriebe daran hängen.
 *
 * Ein Altbestand-Fach mit passendem Namen und ohne Klasse wird übernommen statt verdoppelt —
 * sonst stünde nach dem Umzug „Geschichte" zweimal im Verzeichnis.
 */
export async function fachEintrag(studentId: string, klasse: MeineKlasse): Promise<string> {
	const meine = await db
		.select()
		.from(tocEntries)
		.where(and(eq(tocEntries.studentId, studentId), eq(tocEntries.kind, 'subject')));

	const verbunden = meine.find((f) => f.classId === klasse.id);
	if (verbunden) return verbunden.id;

	const namensgleich = meine.find(
		(f) => !f.classId && f.title.localeCompare(klasse.fach, 'de', { sensitivity: 'base' }) === 0
	);
	if (namensgleich) {
		await db
			.update(tocEntries)
			.set({ classId: klasse.id })
			.where(eq(tocEntries.id, namensgleich.id));
		return namensgleich.id;
	}

	const [neu] = await db
		.insert(tocEntries)
		.values({ studentId, kind: 'subject', title: klasse.fach, classId: klasse.id })
		.returning({ id: tocEntries.id });
	return neu.id;
}
