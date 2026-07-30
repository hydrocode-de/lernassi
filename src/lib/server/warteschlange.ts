// Die Warteschlange der Lernkarten: EINE Reihe pro Kind über alle Fächer.
//
// Warum global und nicht pro Fach: „kommt fast sofort wieder" muss heißen *als zweites
// Geübtes*, nicht *als zweites Geschichte-Geübtes*. Sonst kann das Kind der wackelnden Karte
// durch Fachwechsel ausweichen — und genau die soll wiederkommen. Angezeigt wird weiter nach
// Fach gruppiert, sortiert nach dieser einen Reihe.
//
// `dueAt` sortiert NICHT. Es ist Termin: es klemmt das Einsortieren und löst den Vorschlag
// zum Umsortieren aus. Beides Rechnen, kein Urteilen — deshalb kein Agent.

import { db } from '$lib/server/db';
import { planItems } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import type { Folge } from '$lib/kategorie';

/** Ab wann ein Termin „nah" ist und ein Vorschlag zum Umsortieren sinnvoll wird. */
export const NAHER_TERMIN_TAGE = 3;
/** Wie weit vorne eine Karte mit nahem Termin stehen sollte, damit nichts vorgeschlagen wird. */
export const VORNE_BIS = 3;

type Karte = typeof planItems.$inferSelect;

/** Die offenen Karten in ihrer Reihenfolge. Abgehakte und weggelegte sind aus der Reihe. */
export async function offeneKarten(studentId: string): Promise<Karte[]> {
	return db
		.select()
		.from(planItems)
		.where(and(eq(planItems.studentId, studentId), eq(planItems.status, 'offen')))
		.orderBy(asc(planItems.position), asc(planItems.createdAt));
}

/** Die nächste Karte, die das Kind üben würde. */
export async function naechsteKarte(studentId: string): Promise<Karte | null> {
	return (await offeneKarten(studentId))[0] ?? null;
}

/** Schreibt eine Reihenfolge als Positionen weg — lückenlos, damit „Mitte" berechenbar bleibt. */
async function reiheSchreiben(karten: Karte[]): Promise<void> {
	for (const [i, k] of karten.entries()) {
		if (k.position === i) continue;
		await db.update(planItems).set({ position: i }).where(eq(planItems.id, k.id));
	}
}

/**
 * Wohin eine Karte gehört, wenn eine Übung in dieser Folge endet — als Index in der Reihe
 * OHNE die Karte selbst.
 *
 * - `hinten`: ans Ende
 * - `mitte`: in die Mitte
 * - `zweite-stelle`: an Index 1, also nach der nächsten Karte. Nicht an Index 0: sonst käme
 *   sofort dieselbe Karte noch einmal, und das Kind tritt auf der Stelle.
 */
function zielIndex(folge: Exclude<Folge, 'abhaken'>, laenge: number): number {
	if (folge === 'hinten') return laenge;
	// Nie auf Platz 1: sonst kommt dieselbe Karte sofort noch einmal und das Kind tritt auf
	// der Stelle. Nur ein Termin darf sie davor holen.
	if (folge === 'mitte') return Math.min(laenge, Math.max(1, Math.floor(laenge / 2)));
	return Math.min(1, laenge);
}

/**
 * Klemmt eine Zielposition so, dass Termine gewahrt bleiben: eine Karte rutscht nie hinter
 * eine mit späterem oder ohne Termin, wenn ihr eigener Termin früher ist. „Hinten" heißt
 * damit „so weit hinten, wie der Termin es erlaubt".
 */
function terminGeklemmt(karte: Karte, andere: Karte[], ziel: number): number {
	if (!karte.dueAt) return ziel;
	const meins = karte.dueAt.getTime();
	// Die erste Stelle, an der eine Karte steht, die später oder unbefristet dran ist.
	const grenze = andere.findIndex((k) => !k.dueAt || k.dueAt.getTime() > meins);
	if (grenze === -1) return ziel;
	return Math.min(ziel, grenze);
}

/** Setzt eine Karte an ihren Platz und schreibt die Reihe neu. */
export async function einsortieren(karte: Karte, folge: Exclude<Folge, 'abhaken'>): Promise<void> {
	const reihe = (await offeneKarten(karte.studentId)).filter((k) => k.id !== karte.id);
	const ziel = terminGeklemmt(karte, reihe, zielIndex(folge, reihe.length));
	reihe.splice(ziel, 0, karte);
	await reiheSchreiben(reihe);
}

/** Neue Karten kommen ans Ende — in der Reihenfolge, in der der Plan-Agent sie vorschlug. */
export async function naechstePosition(studentId: string): Promise<number> {
	const reihe = await offeneKarten(studentId);
	return reihe.length ? (reihe[reihe.length - 1].position ?? 0) + 1 : 0;
}

/**
 * Gibt Positionen an Karten, die noch keine haben — nach der Sortierung, die der Lernplan
 * vorher benutzt hat (Termin, dann jüngste zuerst). Damit ändert sich für vorhandene Karten
 * sichtbar nichts.
 */
export async function reiheNachziehen(studentId: string): Promise<void> {
	const reihe = await offeneKarten(studentId);
	const alleAufNull = reihe.every((k) => k.position === 0);
	if (!alleAufNull || reihe.length < 2) return;
	const sortiert = [...reihe].sort(
		(a, b) =>
			(a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
				(b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
			b.createdAt.getTime() - a.createdAt.getTime()
	);
	await reiheSchreiben(sortiert);
}

export type Umsortiervorschlag = {
	/** Die Karten, die nach vorne sollen — in der Reihenfolge, in der sie dann stehen. */
	karten: { id: string; auftrag: string; dueAt: number }[];
	/** Der nächste Termin, um den es geht. */
	dueAt: number;
};

/**
 * Steht eine Karte mit nahem Termin zu weit hinten? Dann gibt es etwas vorzuschlagen.
 * Reines Rechnen: dieselbe Lage ergibt jedes Mal denselben Vorschlag.
 */
export async function umsortierenVorschlagen(
	studentId: string,
	jetzt = new Date()
): Promise<Umsortiervorschlag | null> {
	const reihe = await offeneKarten(studentId);
	const grenze = jetzt.getTime() + NAHER_TERMIN_TAGE * 24 * 60 * 60 * 1000;

	const dringend = reihe.filter((k) => k.dueAt && k.dueAt.getTime() <= grenze);
	if (!dringend.length) return null;
	// Nur vorschlagen, wenn wirklich etwas zu weit hinten steht.
	const zuWeitHinten = dringend.filter((k) => reihe.indexOf(k) >= VORNE_BIS);
	if (!zuWeitHinten.length) return null;

	return {
		karten: zuWeitHinten.map((k) => ({
			id: k.id,
			auftrag: k.auftrag,
			dueAt: k.dueAt!.getTime()
		})),
		dueAt: Math.min(...dringend.map((k) => k.dueAt!.getTime()))
	};
}

/** Holt die Karten mit nahem Termin nach vorne, in ihrer Datumsreihenfolge. */
export async function nachVorneHolen(studentId: string, ids: string[]): Promise<void> {
	const reihe = await offeneKarten(studentId);
	const vor = reihe
		.filter((k) => ids.includes(k.id))
		.sort(
			(a, b) =>
				(a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
				(b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
		);
	if (!vor.length) return;
	await reiheSchreiben([...vor, ...reihe.filter((k) => !ids.includes(k.id))]);
}
