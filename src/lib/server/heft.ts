import { db } from '$lib/server/db';
import { notes, questions, responses, roundTopics, rounds, tocEntries } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export type Thema = {
	id: string;
	title: string;
	zuletzt: number | null;
	/** Wie viele Aufschriebe daran hängen — ohne einen ist das Thema ein Überrest. */
	aufschriebe: number;
	/**
	 * Stand aus der jüngsten Runde, die dieses Thema gefragt hat — rohe Punkte, nicht das Wort.
	 * Das Wort entsteht erst bei der Anzeige aus der Skala der Klasse. Ein Thema, das nie
	 * gefragt wurde, bekommt gar keinen Stand — nicht einen grauen.
	 */
	stand: { erreicht: number; moeglich: number } | null;
};
export type Kapitel = {
	id: string;
	title: string;
	themen: Thema[];
	// Stand am Kapitel, aus harten Daten abgeleitet — fein speichern, grob anzeigen.
	zuletztEingeordnet: number | null;
	sassen: number | null;
	gefragt: number | null;
	neuesMaterial: boolean;
};
export type Fach = { id: string; title: string; kapitel: Kapitel[]; anzahlThemen: number };

// Das Inhaltsverzeichnis eines Kindes. Die Seitenleiste braucht es auf jeder Seite,
// darum liegt es im Layout und nicht in einer einzelnen Route.
export async function heftLesen(studentId: string): Promise<Fach[]> {
	const alle = await db.select().from(tocEntries).where(eq(tocEntries.studentId, studentId));
	const meine = await db.select().from(notes).where(eq(notes.studentId, studentId));

	// jüngster Aufschrieb pro Thema, und wie viele es sind
	const zuletztJeThema = new Map<string, number>();
	const anzahlJeThema = new Map<string, number>();
	for (const n of meine) {
		if (!n.topicId) continue;
		const t = (n.updatedAt ?? n.createdAt).getTime();
		if (t > (zuletztJeThema.get(n.topicId) ?? 0)) zuletztJeThema.set(n.topicId, t);
		anzahlJeThema.set(n.topicId, (anzahlJeThema.get(n.topicId) ?? 0) + 1);
	}

	const stand = await kapitelStand(studentId);
	const themenStand = await themaStand(studentId);

	const kinder = (parentId: string) =>
		alle
			.filter((e) => e.parentId === parentId)
			.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de'));

	return alle
		.filter((e) => e.kind === 'subject')
		.sort((a, b) => a.title.localeCompare(b.title, 'de'))
		.map((f) => {
			const kapitel = kinder(f.id).map((k) => {
				// Hat das Kind selbst sortiert, gilt seine Reihenfolge (sortOrder ab 1).
				// Sonst stehen die neuesten Aufschriebe oben — das Verzeichnis wächst nach vorn.
				const themen = kinder(k.id)
					.map((t) => ({
						id: t.id,
						title: t.title,
						sortOrder: t.sortOrder,
						zuletzt: zuletztJeThema.get(t.id) ?? null,
						aufschriebe: anzahlJeThema.get(t.id) ?? 0,
						stand: themenStand.get(t.id) ?? null
					}))
					.sort(
						(a, b) =>
							(a.sortOrder || Number.MAX_SAFE_INTEGER) - (b.sortOrder || Number.MAX_SAFE_INTEGER) ||
							(b.zuletzt ?? 0) - (a.zuletzt ?? 0)
					)
					.map(({ sortOrder: _, ...t }) => t);
				const eingeordnet = k.lastAssessedAt?.getTime() ?? null;
				return {
					id: k.id,
					title: k.title,
					themen,
					zuletztEingeordnet: eingeordnet,
					sassen: stand.get(k.id)?.sassen ?? null,
					gefragt: stand.get(k.id)?.gefragt ?? null,
					neuesMaterial: themen.some((t) => t.zuletzt && (!eingeordnet || t.zuletzt > eingeordnet))
				};
			});
			return {
				id: f.id,
				title: f.title,
				kapitel,
				anzahlThemen: kapitel.reduce((s, k) => s + k.themen.length, 0)
			};
		});
}

/**
 * Die Themen eines Kapitels in genau der Reihenfolge, in der sie im Verzeichnis stehen —
 * dieselbe Regel wie in `heftLesen`, nur für ein Kapitel und ohne den ganzen Rest.
 *
 * Gebraucht wird das beim Einsortieren einer neuen Seite: „hinter dieses Thema" heißt hinter
 * das Thema, das das Kind an dieser Stelle SIEHT. Solange ein Kapitel nie umsortiert wurde,
 * ist das die zeitliche Ordnung (neueste oben) und nicht die alphabetische.
 */
export async function themenReihenfolge(
	studentId: string,
	kapitelId: string
): Promise<{ id: string; title: string }[]> {
	const themen = await db
		.select()
		.from(tocEntries)
		.where(and(eq(tocEntries.studentId, studentId), eq(tocEntries.parentId, kapitelId)));
	const meine = await db.select().from(notes).where(eq(notes.studentId, studentId));

	const zuletzt = new Map<string, number>();
	for (const n of meine) {
		if (!n.topicId) continue;
		const t = (n.updatedAt ?? n.createdAt).getTime();
		if (t > (zuletzt.get(n.topicId) ?? 0)) zuletzt.set(n.topicId, t);
	}

	return themen
		.sort(
			(a, b) =>
				(a.sortOrder || Number.MAX_SAFE_INTEGER) - (b.sortOrder || Number.MAX_SAFE_INTEGER) ||
				(zuletzt.get(b.id) ?? 0) - (zuletzt.get(a.id) ?? 0)
		)
		.map((t) => ({ id: t.id, title: t.title }));
}

/**
 * Der Stand je Thema: die jüngste Runde gewinnt. Gelesen aus `roundTopics`, das Einordnung und
 * Übung gleich abrechnen — deshalb hat ein Thema schon vor der ersten Übung einen Stand.
 */
async function themaStand(
	studentId: string
): Promise<Map<string, { erreicht: number; moeglich: number }>> {
	const meine = (await db.select().from(rounds).where(eq(rounds.studentId, studentId))).filter(
		(r) => r.status === 'abgeschlossen'
	);
	if (!meine.length) return new Map();

	const zeilen = await db
		.select()
		.from(roundTopics)
		.where(
			inArray(
				roundTopics.roundId,
				meine.map((r) => r.id)
			)
		);

	const wann = new Map(meine.map((r) => [r.id, (r.finishedAt ?? r.startedAt).getTime()]));
	const jueng = new Map<string, { erreicht: number; moeglich: number; wann: number }>();
	for (const z of zeilen) {
		const zeit = wann.get(z.roundId) ?? 0;
		const da = jueng.get(z.topicId);
		if (!da || zeit > da.wann)
			jueng.set(z.topicId, { erreicht: z.erreicht, moeglich: z.moeglich, wann: zeit });
	}
	return new Map([...jueng].map(([id, s]) => [id, { erreicht: s.erreicht, moeglich: s.moeglich }]));
}

/** „3 von 5 saßen" — aus der jüngsten abgeschlossenen Runde je Kapitel. */
async function kapitelStand(
	studentId: string
): Promise<Map<string, { sassen: number; gefragt: number }>> {
	const abgeschlossen = (
		await db.select().from(rounds).where(eq(rounds.studentId, studentId))
		// Übungen hängen an einer Karte, nicht an einem Kapitel — für den Kapitel-Stand
		// zählen nur die Einordnungen.
	).filter((r) => r.status === 'abgeschlossen' && r.chapterId);
	if (!abgeschlossen.length) return new Map();

	// Pro Kapitel zählt die jüngste Runde.
	const jueng = new Map<string, (typeof abgeschlossen)[number]>();
	for (const r of abgeschlossen) {
		const kapitelId = r.chapterId!;
		const da = jueng.get(kapitelId);
		if (!da || (r.finishedAt?.getTime() ?? 0) > (da.finishedAt?.getTime() ?? 0))
			jueng.set(kapitelId, r);
	}

	const rundenIds = [...jueng.values()].map((r) => r.id);
	const fragen = (
		await db.select().from(questions).where(inArray(questions.roundId, rundenIds))
	).filter((f) => f.kind !== 'control');
	if (!fragen.length) return new Map();

	const antworten = await db
		.select()
		.from(responses)
		.where(
			inArray(
				responses.questionId,
				fragen.map((f) => f.id)
			)
		);

	const ergebnis = new Map<string, { sassen: number; gefragt: number }>();
	for (const [kapitelId, runde] of jueng) {
		const meine = fragen.filter((f) => f.roundId === runde.id);
		let sassen = 0;
		let gefragt = 0;
		for (const f of meine) {
			const letzte = antworten
				.filter((r) => r.questionId === f.id)
				.sort((a, b) => b.attempt - a.attempt)[0];
			if (!letzte) continue;
			gefragt++;
			if (letzte.outcome === 'richtig') sassen++;
		}
		if (gefragt) ergebnis.set(kapitelId, { sassen, gefragt });
	}
	return ergebnis;
}
