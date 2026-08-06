// Ein Thema woanders einordnen. Steht hier, weil es an zwei Stellen gebraucht wird:
// beim Bearbeiten des Verzeichnisses und auf der Seite eines einzelnen Eintrags.
//
// Dazu das Gegenstück fürs Hinzufügen: `einsortieren` legt neue Themen an eine bestimmte
// Stelle im Kapitel — beide Wege, eine Seite anzulegen (Foto und selbst getippt), gehen
// darüber.

import { db } from '$lib/server/db';
import { tocEntries } from '$lib/server/db/schema';
import { themenReihenfolge } from '$lib/server/heft';
import { and, eq } from 'drizzle-orm';

export type Umzug = { ok: string } | { fehler: string };

async function meines(studentId: string, id: string) {
	return (
		await db
			.select()
			.from(tocEntries)
			.where(and(eq(tocEntries.id, id), eq(tocEntries.studentId, studentId)))
	)[0];
}

async function kinder(studentId: string, parentId: string) {
	return db
		.select()
		.from(tocEntries)
		.where(and(eq(tocEntries.studentId, studentId), eq(tocEntries.parentId, parentId)));
}

export async function verschiebeThema(
	studentId: string,
	themaId: string,
	ziel: { kapitelId?: string; neuesKapitel?: string }
): Promise<Umzug> {
	const thema = await meines(studentId, themaId);
	if (!thema || thema.kind !== 'topic' || !thema.parentId)
		return { fehler: 'Dieses Thema kenne ich nicht.' };

	const altesKapitel = await meines(studentId, thema.parentId);
	if (!altesKapitel?.parentId) return { fehler: 'Das ging nicht.' };

	let zielId = ziel.kapitelId ?? '';
	const neu = ziel.neuesKapitel?.trim();
	if (neu) {
		// Das neue Kapitel gehört in dasselbe Fach wie das alte.
		const geschwister = await kinder(studentId, altesKapitel.parentId);
		const vorhanden = geschwister.find(
			(k) => k.title.localeCompare(neu, 'de', { sensitivity: 'base' }) === 0
		);
		if (vorhanden) zielId = vorhanden.id;
		else {
			const [angelegt] = await db
				.insert(tocEntries)
				.values({
					studentId,
					kind: 'chapter',
					title: neu,
					parentId: altesKapitel.parentId,
					sortOrder: geschwister.length + 1
				})
				.returning({ id: tocEntries.id });
			zielId = angelegt.id;
		}
	}

	const zielKapitel = await meines(studentId, zielId);
	if (!zielKapitel || zielKapitel.kind !== 'chapter') return { fehler: 'Wohin denn?' };
	if (zielKapitel.id === thema.parentId) return { ok: 'Da liegt es schon.' };

	const drin = await kinder(studentId, zielKapitel.id);
	await db
		.update(tocEntries)
		.set({ parentId: zielKapitel.id, sortOrder: drin.length + 1 })
		.where(eq(tocEntries.id, thema.id));

	// Im Zielkapitel liegt jetzt Material, das dort nie eingeordnet wurde — also gilt es
	// wieder als frisch. Sonst behauptet der Stand etwas, das nicht geprüft wurde.
	await db
		.update(tocEntries)
		.set({ lastAssessedAt: null })
		.where(eq(tocEntries.id, zielKapitel.id));

	return { ok: `„${thema.title}" liegt jetzt in „${zielKapitel.title}".` };
}

/**
 * Wohin eine neue Seite im Kapitel gehört. `'anfang'` nach oben, eine Themen-ID dahinter,
 * alles andere (auch leer) ans Ende — das Verzeichnis wächst sonst nach unten weiter, wie
 * ein Heft.
 */
export type Stelle = string | null | undefined;

/**
 * Neu angelegte Themen an ihre Stelle im Kapitel setzen. Numeriert dabei das ganze Kapitel
 * neu durch: vorher stand dort oft überall 0, und mit einer festen Position im Verzeichnis
 * muss die Reihenfolge danach eindeutig sein — sonst rutscht die eingefügte Seite beim
 * nächsten Aufschrieb wieder nach oben.
 */
export async function einsortieren(
	studentId: string,
	kapitelId: string,
	neueIds: string[],
	stelle: Stelle
): Promise<void> {
	const reihe = (await themenReihenfolge(studentId, kapitelId)).map((t) => t.id);
	const alt = reihe.filter((id) => !neueIds.includes(id));
	const neu = neueIds.filter((id) => reihe.includes(id));
	if (!neu.length) return;

	const nach = stelle === 'anfang' ? -1 : alt.findIndex((id) => id === stelle);
	// Unbekannte Stelle heißt „ans Ende" — auch dann, wenn das Bezugsthema zwischenzeitlich
	// verschoben oder gelöscht wurde.
	const ordnung =
		nach === -1 && stelle !== 'anfang'
			? [...alt, ...neu]
			: [...alt.slice(0, nach + 1), ...neu, ...alt.slice(nach + 1)];

	for (const [i, id] of ordnung.entries())
		await db
			.update(tocEntries)
			.set({ sortOrder: i + 1 })
			.where(eq(tocEntries.id, id));
}

/**
 * Ein Kapitel, das diesem Kind gehört, mit seinem Fach. Beide Wege zum Anlegen einer Seite
 * brauchen genau das: Kapitel prüfen, Fach dazu holen, sonst nichts.
 */
export async function kapitelMitFach(studentId: string, kapitelId: string) {
	const kapitel = await meines(studentId, kapitelId);
	if (!kapitel || kapitel.kind !== 'chapter' || !kapitel.parentId) return null;
	const fach = await meines(studentId, kapitel.parentId);
	if (!fach || fach.kind !== 'subject') return null;
	return { kapitel, fach };
}
