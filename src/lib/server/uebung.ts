// Ablauf einer Übung: EINE Karte abarbeiten. Die Einordnung füllt den Plan, die Übung räumt
// ihn ab — deshalb läuft hier kein Plan-Agent, sonst käme das Kind nie ans Ende.
//
// Technisch ist die Übung eine Runde mit `kind='uebung'`: Fragen, Antworten, Nachfassen,
// Mitschrieb und Abrechnung sind dieselben wie in der Einordnung.

import { db } from '$lib/server/db';
import {
	classes,
	planItems,
	questions,
	responses,
	rounds,
	students,
	tocEntries
} from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { erzeugeUebungsfragen, materialAlsText, schreibeBeurteilung } from '$lib/server/lernen';
import {
	alsZeile,
	brauchbar,
	entdoppelt,
	kapitelKontext,
	lernzielFuer,
	mitschriebFuer,
	rundeAbrechnen,
	type KapitelKontext
} from '$lib/server/runde';
import { einsortieren, naechsteKarte, offeneKarten } from '$lib/server/warteschlange';
import { kategorieAus, skalaLesen, type Kategorie, type Stufe } from '$lib/kategorie';
import { klasseFuerFach, meineKlassen } from '$lib/server/klasse';

export type Karte = typeof planItems.$inferSelect;

/** Wie das Kind hinterher sagt, wie es lief — gefragt VOR der Zahl. */
export const RUECKSCHAU = {
	gut: 'Gut',
	durchwachsen: 'Durchwachsen',
	'nicht-gut': 'Nicht so gut'
} as const;
export type Rueckschau = keyof typeof RUECKSCHAU;

export function istRueckschau(v: string): v is Rueckschau {
	return v in RUECKSCHAU;
}

/**
 * Die Grenzen, ab denen ein Prozentwert „sitzt" heißt. Sie hängen an der Klasse, und ein Kind
 * sitzt in mehreren — darum mit dem Fach, um das es geht: `fachId` zeigt über
 * `tocEntries.classId` auf genau eine Klasse. Ohne Fach (oder bei Altdaten ohne Klasse) gilt
 * die erste Klasse des Kindes; das ist derselbe Notnagel wie vorher, nur jetzt sichtbar.
 */
export async function skalaFuer(
	studentId: string,
	fachId?: string | null
): Promise<[Stufe, Stufe, Stufe]> {
	if (fachId) {
		const klasse = await klasseFuerFach(studentId, fachId);
		if (klasse) return skalaLesen(klasse.skala);
	}
	return skalaLesen((await meineKlassen(studentId))[0]?.skala ?? null);
}

export async function meineKarte(studentId: string, karteId: string): Promise<Karte | null> {
	return (
		(
			await db
				.select()
				.from(planItems)
				.where(and(eq(planItems.id, karteId), eq(planItems.studentId, studentId)))
		)[0] ?? null
	);
}

/**
 * Startet eine Übung für eine Karte — oder gibt die laufende zurück, wenn schon eine offen ist.
 * Zwei Übungen zur selben Karte gleichzeitig wären zwei Wahrheiten über dieselbe Sache.
 */
export async function uebungStarten(studentId: string, karte: Karte): Promise<string> {
	const laufend = (
		await db
			.select()
			.from(rounds)
			.where(
				and(
					eq(rounds.studentId, studentId),
					eq(rounds.planItemId, karte.id),
					eq(rounds.status, 'laufend')
				)
			)
	)[0];
	if (laufend) return laufend.id;

	const neu = await db
		.insert(rounds)
		.values({
			studentId,
			kind: 'uebung',
			chapterId: karte.chapterId,
			planItemId: karte.id
		})
		.returning({ id: rounds.id });
	return neu[0].id;
}

/** Die nächste Karte der Warteschlange üben. null, wenn die Reihe leer ist. */
export async function naechsteUebung(studentId: string): Promise<string | null> {
	const karte = await naechsteKarte(studentId);
	if (!karte) return null;
	return uebungStarten(studentId, karte);
}

export type UebungsKontext = {
	karte: Karte;
	kapitel: KapitelKontext | null;
};

export async function uebungsKontext(karte: Karte): Promise<UebungsKontext> {
	const kapitel = karte.chapterId ? await kapitelKontext(karte.studentId, karte.chapterId) : null;
	return { karte, kapitel };
}

/** Was in dieser Übung schon gelaufen ist — Frage, eigene Antwort, ob sie saß. Bleibt in der
 *  Oberfläche stehen, damit die Übung ein Verlauf ist und nicht eine Frage, die die vorige
 *  wegwischt. */
export type VerlaufsEintrag = {
	id: string;
	prompt: string;
	art: string;
	punkte: number;
	erreicht: number;
	antworten: { given: string[]; getroffen: boolean }[];
};

export async function verlaufFuer(roundId: string): Promise<VerlaufsEintrag[]> {
	const fragen = (await db.select().from(questions).where(eq(questions.roundId, roundId)))
		.filter((f) => f.kind !== 'control')
		.sort((a, b) => a.sortOrder - b.sortOrder);
	if (!fragen.length) return [];

	const alle = await db.select().from(responses);
	const eintraege: VerlaufsEintrag[] = [];
	for (const f of fragen) {
		const meine = alle.filter((r) => r.questionId === f.id).sort((a, b) => a.attempt - b.attempt);
		if (!meine.length) break;
		const treffer = meine.find((r) => r.outcome !== 'falsch');
		// Noch offen: die Frage steht unten als aktuelle, nicht oben im Verlauf.
		if (!treffer && meine.length < f.punkte) break;
		eintraege.push({
			id: f.id,
			prompt: f.prompt,
			art: f.kind,
			punkte: f.punkte,
			erreicht: treffer ? Math.max(1, f.punkte - (treffer.attempt - 1)) : 0,
			antworten: meine.map((r) => ({
				given: JSON.parse(r.given ?? '[]') as string[],
				getroffen: r.outcome !== 'falsch'
			}))
		});
	}
	return eintraege;
}

/** Alle Punkte, die in dieser Übung zu holen sind. */
export async function moeglichePunkte(roundId: string): Promise<number> {
	return (await db.select().from(questions).where(eq(questions.roundId, roundId)))
		.filter((f) => f.kind !== 'control')
		.reduce((s, f) => s + f.punkte, 0);
}

/** Schreibt die Fragen der Übung — eine Welle, gegen das Zeitbudget der Karte. */
export async function uebungsfragenSchreiben(
	roundId: string,
	karte: Karte,
	kontext: KapitelKontext
): Promise<void> {
	const vorhanden = await db.select().from(questions).where(eq(questions.roundId, roundId));
	if (vorhanden.length) return;

	// Nur das Material der Karte, nicht das ganze Kapitel: schärfere Fragen und knapp halb so
	// viel Eingabe. Karten ohne Thema (aus der Zeit vor `topicId`) bekommen weiter alles.
	const eigene = karte.topicId
		? kontext.themen.filter((t) => t.themaId === karte.topicId)
		: kontext.themen;
	const material = eigene.length ? eigene : kontext.themen;

	const ergebnis = await erzeugeUebungsfragen({
		fach: kontext.fach,
		kapitel: kontext.kapitel,
		auftrag: karte.auftrag,
		minuten: karte.minutes ?? 10,
		material: materialAlsText(material, true),
		lernziel: await lernzielFuer(karte.studentId, kontext.fachId),
		beurteilung: kontext.beurteilung,
		mitschrieb: mitschriebFuer(roundId)
	});

	const gut = entdoppelt(ergebnis.fragen.filter(brauchbar));
	for (const [i, roh] of gut.entries()) {
		const thema = kontext.themen.find(
			(t) => t.titel.localeCompare(roh.thema, 'de', { sensitivity: 'base' }) === 0
		);
		await db.insert(questions).values({
			roundId,
			wave: 1,
			sortOrder: i,
			...alsZeile(roh, thema?.themaId ?? null)
		});
	}
}

export type Ausgang = {
	wert: number;
	kategorie: Kategorie;
	erreicht: number;
	moeglich: number;
	/** Wo die Karte danach wirklich liegt (1-basiert), null wenn abgehakt. Ein Termin kann sie
	 *  weiter vorne festhalten, als die Kategorie sie gelegt hätte — dann gilt der Termin, und
	 *  das Kind soll den echten Platz genannt bekommen, nicht den gedachten. */
	platz: number | null;
	offen: number;
};

/**
 * Übung abschließen: abrechnen, Kategorie bestimmen, Karte abhaken oder einsortieren,
 * Beurteilung nachlaufen lassen.
 *
 * Die Kategorie wird hier nur *benutzt*, nicht gespeichert — sie hängt an der Skala der Klasse,
 * und die darf die Lehrkraft jederzeit verschieben.
 */
export async function uebungAbschliessen(
	runde: typeof rounds.$inferSelect,
	karte: Karte,
	kontext: KapitelKontext | null
): Promise<Ausgang> {
	const { erreicht, moeglich, wert } = await rundeAbrechnen(runde.id);
	const jetzt = new Date();
	await db
		.update(rounds)
		.set({ status: 'abgeschlossen', finishedAt: jetzt })
		.where(eq(rounds.id, runde.id));

	const skala = await skalaFuer(runde.studentId, karte.subjectId);
	// Ohne mögliche Punkte gibt es nichts zu bewerten — dann bleibt die Karte, wo sie ist.
	const kategorie: Kategorie = wert === null ? 4 : kategorieAus(wert, skala);

	let abgehakt = false;
	if (moeglich > 0) {
		if (kategorie === 1) {
			await db
				.update(planItems)
				.set({ status: 'erledigt', updatedAt: jetzt })
				.where(eq(planItems.id, karte.id));
			abgehakt = true;
		} else {
			await einsortieren(karte, kategorie === 2 ? 'hinten' : kategorie === 3 ? 'mitte' : 'zweite-stelle');
		}
	}

	const reihe = await offeneKarten(runde.studentId);
	const platz = abgehakt ? null : reihe.findIndex((k) => k.id === karte.id) + 1 || null;

	// Der Kapitel-Zeitstempel bleibt unberührt: eine Übung prüft eine Karte, sie ordnet kein
	// neues Material ein.
	if (kontext) {
		void schreibeBeurteilung({
			kapitel: kontext.kapitel,
			bisher: kontext.beurteilung,
			selbsteinschaetzung: null,
			spiegelReaktion: runde.selfAfter ? RUECKSCHAU[runde.selfAfter as Rueckschau] : null,
			ergebnisse: await ergebnisseFuer(runde.id),
			planpunkte: [karte.auftrag],
			luecke: null,
			material: materialAlsText(kontext.themen, false),
			mitschrieb: mitschriebFuer(runde.id)
		})
			.then(async ({ text }) => {
				const { chapterAssessments } = await import('$lib/server/db/schema');
				const vorhanden = (
					await db
						.select()
						.from(chapterAssessments)
						.where(eq(chapterAssessments.chapterId, kontext.kapitelId))
				)[0];
				if (vorhanden) {
					await db
						.update(chapterAssessments)
						.set({ text, updatedAt: new Date() })
						.where(eq(chapterAssessments.id, vorhanden.id));
				} else {
					await db.insert(chapterAssessments).values({
						studentId: runde.studentId,
						chapterId: kontext.kapitelId,
						text
					});
				}
			})
			.catch((e) => console.error('[uebung] Beurteilung fehlgeschlagen:', e));
	}

	return { wert: wert ?? 0, kategorie, erreicht, moeglich, platz, offen: reihe.length };
}

/** Was in dieser Übung lief — für den Beurteilungs-Agenten. */
async function ergebnisseFuer(
	roundId: string
): Promise<{ frage: string; thema: string; ergebnis: string }[]> {
	const { responses } = await import('$lib/server/db/schema');
	const fragen = (await db.select().from(questions).where(eq(questions.roundId, roundId))).filter(
		(f) => f.kind !== 'control'
	);
	if (!fragen.length) return [];
	const themen = new Map(
		(await db.select().from(tocEntries)).map((t) => [t.id, t.title] as const)
	);
	const alle = await db.select().from(responses);
	return fragen.map((f) => {
		const meine = alle
			.filter((r) => r.questionId === f.id)
			.sort((a, b) => b.attempt - a.attempt);
		return {
			frage: f.prompt,
			thema: (f.topicId && themen.get(f.topicId)) || 'ohne Thema',
			ergebnis: meine[0]?.outcome ?? 'nicht beantwortet'
		};
	});
}
