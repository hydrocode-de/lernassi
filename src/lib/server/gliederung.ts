// Ein Thema woanders einordnen. Steht hier, weil es an zwei Stellen gebraucht wird:
// beim Bearbeiten des Verzeichnisses und auf der Seite eines einzelnen Eintrags.

import { db } from '$lib/server/db';
import { tocEntries } from '$lib/server/db/schema';
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
