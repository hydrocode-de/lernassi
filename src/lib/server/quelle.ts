// Woher ein Aufschrieb kommt. Ein Aufschrieb ohne Quelle ist eine Behauptung — deshalb hat
// jeder eine, egal auf welchem Weg er ins Heft kam:
//
//   foto       die Heftseiten, aus denen gelesen wurde
//   selbst     was das Kind angibt („aus dem Unterricht", „abgeschrieben", „selbst überlegt")
//   recherche  der Artikel, mit Adresse und Lizenz
//
// Beim Anzeigen steht sie unter dem Text, nicht darin: sie gehört zum Aufschrieb, ist aber
// nicht Teil dessen, was das Kind gelernt hat.

import { db } from '$lib/server/db';
import { noteSources } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export type Quelle = { name: string; url?: string | null; lizenz?: string | null };

/** Was das Kind beim Selberschreiben antippen kann. Freie Eingabe bleibt daneben möglich. */
export const QUELLEN_VORSCHLAEGE = [
	'Aus dem Unterricht',
	'Abgeschrieben',
	'Selbst überlegt',
	'Aus einem Buch'
] as const;

/** Setzt die Quellen eines Aufschriebs neu — beim Bearbeiten ersetzt das die alten. */
export async function quellenSchreiben(noteId: string, quellen: Quelle[]): Promise<void> {
	await db.delete(noteSources).where(eq(noteSources.noteId, noteId));
	const sauber = quellen
		.map((q) => ({ ...q, name: q.name.trim().slice(0, 300) }))
		.filter((q) => q.name.length > 0);
	if (!sauber.length) return;

	await db.insert(noteSources).values(
		sauber.map((q, i) => ({
			noteId,
			name: q.name,
			url: q.url?.trim() || null,
			lizenz: q.lizenz?.trim() || null,
			sortOrder: i
		}))
	);
}

/** Die Quellen mehrerer Aufschriebe auf einmal — für Seiten, die eine Liste zeigen. */
export async function quellenLesen(noteIds: string[]): Promise<Map<string, Quelle[]>> {
	if (!noteIds.length) return new Map();
	const zeilen = (
		await db.select().from(noteSources).where(inArray(noteSources.noteId, noteIds))
	).sort((a, b) => a.sortOrder - b.sortOrder);

	const nach = new Map<string, Quelle[]>();
	for (const z of zeilen) {
		const liste = nach.get(z.noteId) ?? [];
		liste.push({ name: z.name, url: z.url, lizenz: z.lizenz });
		nach.set(z.noteId, liste);
	}
	return nach;
}

/** Die Quelle eines fotografierten Aufschriebs: die Seiten, aus denen gelesen wurde. */
export function fotoQuelle(seiten: number[], wann: Date): Quelle {
	const datum = wann.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
	const liste = seiten.length
		? `, Seite ${seiten.join(', ')}`
		: '';
	return { name: `Deine Heftseiten vom ${datum}${liste}` };
}
