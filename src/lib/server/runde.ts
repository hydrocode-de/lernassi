// Ablauf einer Einordnungs-Runde: Material einsammeln, Fragen holen, Antworten bewerten,
// abschließen. Die Agenten selbst stehen in lernen.ts — hier steht, wann welcher dran ist.

import { db } from '$lib/server/db';
import {
	chapterAssessments,
	classes,
	learningGoals,
	notes,
	planItems,
	questions,
	responses,
	roundTopics,
	rounds,
	students,
	tocEntries
} from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
	bewerteFreitext,
	erzeugeFragen,
	erzeugeUebungsfragen,
	materialAlsText,
	planVorschlaege,
	schreibeBeurteilung,
	spiegle,
	type MaterialThema,
	type Mitschrieb,
	type RohFrage
} from '$lib/server/lernen';
import { wertAus } from '$lib/kategorie';
import { naechstePosition } from '$lib/server/warteschlange';

export const WELLE_1 = 3;
export const WELLE_2 = 2;
export const FRAGEN_JE_RUNDE = WELLE_1 + WELLE_2;

/** Längenbegrenzung für getippte Antworten. Ein paar Sätze, kein Aufsatz. */
export const FREITEXT_MAX = 600;

export const SICHERHEIT = [
	'Gar nicht sicher',
	'Ein bisschen',
	'Ziemlich sicher',
	'Sehr sicher'
] as const;

export const SPIEGEL_REAKTIONEN = {
	'kommt-hin': 'Ja, kommt hin',
	'dachte-mehr': 'Ich dachte, ich kann mehr',
	'kann-mehr': 'Ich kann mehr als das'
} as const;

export type SpiegelReaktion = keyof typeof SPIEGEL_REAKTIONEN;

/** Was der Client von einer Frage sehen darf. Die Lösung bleibt auf dem Server. */
export type Optionen = { auswahl: string[]; rechts?: string[] };
export type FrageAnsicht = {
	id: string;
	nummer: number;
	von: number;
	art: string;
	prompt: string;
	optionen: Optionen;
	hatHinweis: boolean;
	/** Volle Punktzahl der Frage — zugleich ihr Versuchs-Kontingent. */
	punkte: number;
	/** Was sie jetzt noch wert ist: jedes Nachfassen kostet einen Punkt. */
	nochWert: number;
};

// ─────────────────────────────────────────────────────────────
// Flüchtiger Zustand (bewusst nur im Arbeitsspeicher)
// ─────────────────────────────────────────────────────────────

// Roh-Mitschriebe der Agenten-Aufrufe. Gehen nach Rundenende auf das Gerät des Kindes
// und nie in die Datenbank — vorher würden die Lösungen der offenen Fragen im Browser liegen.
const mitschriebe = new Map<string, Mitschrieb[]>();

export function mitschriebFuer(roundId: string): Mitschrieb[] {
	let m = mitschriebe.get(roundId);
	if (!m) mitschriebe.set(roundId, (m = []));
	return m;
}

export function holeUndVergesseMitschrieb(roundId: string): Mitschrieb[] {
	const m = mitschriebe.get(roundId) ?? [];
	mitschriebe.delete(roundId);
	return m;
}

// Spiegel und Plan-Vorschläge sind Zwischenstand, kein Ergebnis: persistiert werden am
// Ende die Spiegel-Reaktion und die gewählten Planpunkte, nicht der Weg dorthin. Beim
// Neuladen wird der Zwischenstand aus dem Speicher geholt und nur im Notfall neu gebaut.
export type Zwischenstand = {
	spiegel?: { satz: string; sitzt: string[]; wackelt: string[]; kandidaten: string[] };
	fokus?: string[];
	plan?: {
		satz: string;
		allesSitzt: boolean;
		vorschlaege: { auftrag: string; minuten: number; thema: string }[];
	};
};

const zwischenstaende = new Map<string, Zwischenstand>();

export function zwischenstand(roundId: string): Zwischenstand {
	let z = zwischenstaende.get(roundId);
	if (!z) zwischenstaende.set(roundId, (z = {}));
	return z;
}

// Eine Welle wird im Hintergrund geschrieben, während das Kind noch etwas anderes tut.
// Wer die Fragen braucht, wartet hier auf dieselbe Zusage statt einen zweiten Aufruf zu starten.
const laufendeWellen = new Map<string, Promise<void>>();

function imHintergrund(schluessel: string, arbeit: () => Promise<void>): Promise<void> {
	const vorhanden = laufendeWellen.get(schluessel);
	if (vorhanden) return vorhanden;
	const p = arbeit()
		.catch((e) => {
			console.error('[runde] Welle fehlgeschlagen:', e);
			throw e;
		})
		.finally(() => laufendeWellen.delete(schluessel));
	laufendeWellen.set(schluessel, p);
	return p;
}

// Eine Welle kann durchlaufen und trotzdem keine brauchbare Frage liefern. Damit die
// Runde dann weitergeht statt bei jedem Neuladen einen neuen Aufruf zu bezahlen, wird
// der Versuch vermerkt.
const versuchteWellen = new Map<string, Set<number>>();

export function welleVersucht(roundId: string, welle: number): boolean {
	return versuchteWellen.get(roundId)?.has(welle) ?? false;
}

// ─────────────────────────────────────────────────────────────
// Material und Kontext eines Kapitels
// ─────────────────────────────────────────────────────────────

export type KapitelKontext = {
	kapitelId: string;
	kapitel: string;
	fachId: string;
	fach: string;
	themen: MaterialThema[];
	ohneAufschrieb: string[];
	zuletztEingeordnet: Date | null;
	beurteilung: string | null;
};

export async function kapitelKontext(
	studentId: string,
	kapitelId: string
): Promise<KapitelKontext | null> {
	const kapitel = (
		await db
			.select()
			.from(tocEntries)
			.where(and(eq(tocEntries.id, kapitelId), eq(tocEntries.studentId, studentId)))
	)[0];
	if (!kapitel || kapitel.kind !== 'chapter' || !kapitel.parentId) return null;

	const fach = (await db.select().from(tocEntries).where(eq(tocEntries.id, kapitel.parentId)))[0];
	if (!fach) return null;

	const themen = (
		await db.select().from(tocEntries).where(eq(tocEntries.parentId, kapitelId))
	).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de'));

	const aufschriebe = themen.length
		? await db
				.select()
				.from(notes)
				.where(
					inArray(
						notes.topicId,
						themen.map((t) => t.id)
					)
				)
		: [];

	const seit = kapitel.lastAssessedAt?.getTime() ?? 0;
	const material: MaterialThema[] = [];
	const ohneAufschrieb: string[] = [];
	for (const t of themen) {
		const eigene = aufschriebe
			.filter((n) => n.topicId === t.id)
			.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		if (!eigene.length) {
			ohneAufschrieb.push(t.title);
			continue;
		}
		for (const n of eigene) {
			const wann = n.updatedAt ?? n.createdAt;
			material.push({
				themaId: t.id,
				titel: t.title,
				zusammenfassung: n.summary,
				begriffe: n.keywords,
				transkript: n.transcript,
				wann,
				neu: wann.getTime() > seit
			});
		}
	}

	const beurteilung = (
		await db.select().from(chapterAssessments).where(eq(chapterAssessments.chapterId, kapitelId))
	)[0];

	return {
		kapitelId,
		kapitel: kapitel.title,
		fachId: fach.id,
		fach: fach.title,
		themen: material,
		ohneAufschrieb,
		zuletztEingeordnet: kapitel.lastAssessedAt ?? null,
		beurteilung: beurteilung?.text ?? null
	};
}

/**
 * Das aktuelle Lernziel für dieses Fach. Freitext, ungeschnitten.
 * Ein Kind sitzt in mehreren Klassen, je eine pro Fach — gesucht ist die, deren Fach zum
 * Fach im Heft passt. Fächer, für die es keine Klasse gibt, laufen ohne Lernziel.
 */
export async function lernzielFuer(studentId: string, fach: string): Promise<string | null> {
	const zeilen = await db
		.select({ fach: classes.subject, ziel: learningGoals.description })
		.from(students)
		.innerJoin(classes, eq(classes.id, students.classId))
		.leftJoin(learningGoals, eq(learningGoals.classId, classes.id))
		.where(eq(students.userId, studentId));

	const passend = zeilen.find(
		(z) => z.fach && z.fach.localeCompare(fach, 'de', { sensitivity: 'base' }) === 0
	);
	const text = passend?.ziel?.trim();
	return text?.length ? text : null;
}

// ─────────────────────────────────────────────────────────────
// Runde starten
// ─────────────────────────────────────────────────────────────

export async function offeneRunde(studentId: string, kapitelId: string) {
	const alle = await db
		.select()
		.from(rounds)
		.where(
			and(
				eq(rounds.studentId, studentId),
				eq(rounds.chapterId, kapitelId),
				eq(rounds.status, 'laufend')
			)
		);
	return alle.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null;
}

/** Fortsetzen anbieten nur, wenn die Runde vom selben Tag ist und nichts Neues dazukam. */
export function darfFortsetzen(
	runde: { startedAt: Date },
	kontext: KapitelKontext
): boolean {
	const heute = new Date().toDateString() === runde.startedAt.toDateString();
	const neuesSeitStart = kontext.themen.some((t) => t.wann.getTime() > runde.startedAt.getTime());
	return heute && !neuesSeitStart;
}

export async function starteRunde(studentId: string, kontext: KapitelKontext) {
	// Ältere laufende Runden desselben Kapitels aufgeben — sonst sammeln sich Halbfertige an.
	await db
		.update(rounds)
		.set({ status: 'verworfen', finishedAt: new Date() })
		.where(
			and(
				eq(rounds.studentId, studentId),
				eq(rounds.chapterId, kontext.kapitelId),
				eq(rounds.status, 'laufend')
			)
		);

	const [runde] = await db
		.insert(rounds)
		.values({
			studentId,
			chapterId: kontext.kapitelId,
			sinceAt: kontext.zuletztEingeordnet
		})
		.returning();

	// Die Nachfrage vor der Einordnung ist eine Steuer-Frage: sie wird nicht bewertet,
	// sie hat eine Runde ausgelöst. Sie gehört trotzdem in die Runde, damit später
	// nachvollziehbar ist, dass sie gestellt wurde.
	await db.insert(questions).values({
		roundId: runde.id,
		wave: 0,
		sortOrder: 0,
		kind: 'control',
		prompt: 'Hast du zu diesem Kapitel vielleicht noch eine Heftseite, die ich nicht kenne?',
		options: JSON.stringify({ auswahl: ['Ja', 'Nein'] } satisfies Optionen)
	});

	// Fragen der ersten Welle laufen schon los, während das Kind seine Selbsteinschätzung
	// abgibt. So kann es danach sofort klicken.
	void welleErzeugen(runde.id, 1, kontext, materialFuerRunde(kontext, true)).catch(() => {});

	return runde;
}

/** Ordnet nur das Neue ein, wenn es Neues gibt — sonst das ganze Kapitel. */
export function materialFuerRunde(kontext: KapitelKontext, nurNeues: boolean): MaterialThema[] {
	if (!nurNeues) return kontext.themen;
	const neue = kontext.themen.filter((t) => t.neu);
	return neue.length ? neue : kontext.themen;
}

// ─────────────────────────────────────────────────────────────
// Fragen
// ─────────────────────────────────────────────────────────────

function mische<T>(xs: T[]): T[] {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** Aus der Modellantwort wird eine Zeile: Anzeigeform gemischt, Lösung serverseitig. */
export function alsZeile(roh: RohFrage, themaId: string | null) {
	let optionen: Optionen;
	let loesung: string[];

	switch (roh.art) {
		case 'yesno':
			optionen = { auswahl: ['Ja', 'Nein'] };
			loesung = [roh.richtig[0]?.toLowerCase().startsWith('j') ? 'Ja' : 'Nein'];
			break;
		case 'text':
			// Kein Antippen: das Kind schreibt. `richtig` trägt die Begriffe, die vorkommen
			// müssen — bewertet wird von einem eigenen Agenten, nicht durch Vergleichen.
			optionen = { auswahl: [] };
			loesung = roh.richtig;
			break;
		case 'order':
			// Das Modell liefert die richtige Reihenfolge; angezeigt wird gemischt.
			optionen = { auswahl: mische(roh.auswahl) };
			loesung = roh.auswahl;
			break;
		case 'match':
			optionen = { auswahl: roh.auswahl, rechts: mische(roh.partner) };
			loesung = roh.partner;
			break;
		default:
			optionen = { auswahl: mische(roh.auswahl) };
			loesung = roh.richtig;
	}

	// Punkte = Versuchs-Kontingent. Ohne Hinweis gibt es kein Nachfassen, also ist eine Frage
	// ohne Hinweis immer 1 Punkt wert — sonst wäre ein Kontingent verschenkt, das niemand
	// einlösen kann. Freitext braucht keinen Hinweis fürs Nachfassen: dort ist schon die
	// Rückmeldung des Bewerters der Anstoß.
	const hinweis = roh.hinweis?.trim() || null;
	const kontingent = Math.min(3, Math.max(1, Math.round(roh.punkte ?? 1)));
	const punkte = hinweis || roh.art === 'text' ? kontingent : 1;

	return {
		kind: roh.art,
		prompt: roh.frage,
		options: JSON.stringify(optionen),
		correctAnswer: JSON.stringify(loesung),
		punkte,
		hint: hinweis,
		topicId: themaId
	};
}

/** Inhaltswörter einer Frage — für den Doppel-Vergleich. Kurze Wörter tragen nichts bei. */
function kern(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.replace(/[^a-zäöüß\s]/g, ' ')
			.split(/\s+/)
			.filter((w) => w.length > 4)
	);
}

/**
 * Wirft Fragen weg, die eine frühere nur umformulieren. Der Prüf-Agent bekommt die Regel auch
 * gesagt, hält sie aber nicht zuverlässig ein — und zwei Fragen auf denselben Sachverhalt sind
 * für das Kind Zeitverschwendung und verzerren die Punktzahl.
 */
export function entdoppelt(fragen: RohFrage[], schwelle = 0.6): RohFrage[] {
	const behalten: { roh: RohFrage; woerter: Set<string> }[] = [];
	for (const roh of fragen) {
		const woerter = kern(`${roh.frage} ${roh.richtig.join(' ')}`);
		if (!woerter.size) continue;
		const doppelt = behalten.some(({ woerter: andere }) => {
			const gemeinsam = [...woerter].filter((w) => andere.has(w)).length;
			return gemeinsam / Math.min(woerter.size, andere.size) >= schwelle;
		});
		if (!doppelt) behalten.push({ roh, woerter });
	}
	return behalten.map((b) => b.roh);
}

/** Prüft, ob eine Modellfrage überhaupt spielbar ist. Halbe Fragen fliegen raus. */
export function brauchbar(roh: RohFrage): boolean {
	if (!roh.frage?.trim()) return false;
	if (roh.art === 'text') return roh.richtig.length > 0;
	if (roh.art === 'yesno') return roh.richtig.length === 1;
	if (roh.art === 'match')
		return roh.auswahl.length >= 2 && roh.auswahl.length === roh.partner.length;
	if (roh.art === 'order') return roh.auswahl.length >= 3;
	if (roh.auswahl.length < 2) return false;
	if (roh.art === 'single' && roh.richtig.length !== 1) return false;
	// Die richtigen Möglichkeiten müssen wortgleich in der Auswahl stehen, sonst ist
	// die Frage nicht bewertbar.
	if (!roh.richtig.length) return false;
	return roh.richtig.every((r) => roh.auswahl.includes(r));
}

async function welleErzeugen(
	roundId: string,
	welle: 1 | 2,
	kontext: KapitelKontext,
	material: MaterialThema[]
): Promise<void> {
	return imHintergrund(`${roundId}:${welle}`, async () => {
		const vorhanden = await db
			.select()
			.from(questions)
			.where(and(eq(questions.roundId, roundId), eq(questions.wave, welle)));
		if (vorhanden.length) return;

		const genutzt = material.length ? material : kontext.themen;
		const lernziel = await lernzielFuer(
			(await db.select().from(rounds).where(eq(rounds.id, roundId)))[0].studentId,
			kontext.fach
		);
		const bisher = welle === 2 ? await bisherigeFragen(roundId) : [];

		const ergebnis = await erzeugeFragen({
			fach: kontext.fach,
			kapitel: kontext.kapitel,
			material: materialAlsText(genutzt, true),
			lernziel,
			beurteilung: kontext.beurteilung,
			welle,
			anzahl: welle === 1 ? WELLE_1 : WELLE_2,
			bisher,
			mitschrieb: mitschriebFuer(roundId)
		});

		// Einordnung bleibt reines Antippen — Freitext gibt es nur in der Übung.
		const nach = welle === 1 ? 0 : WELLE_1;
		const gut = ergebnis.fragen
			.filter((f) => f.art !== 'text')
			.filter(brauchbar)
			.slice(0, welle === 1 ? WELLE_1 : WELLE_2);
		for (const [i, roh] of gut.entries()) {
			const thema = genutzt.find(
				(t) => t.titel.localeCompare(roh.thema, 'de', { sensitivity: 'base' }) === 0
			);
			await db.insert(questions).values({
				roundId,
				wave: welle,
				sortOrder: nach + i,
				...alsZeile(roh, thema?.themaId ?? null)
			});
		}
		if (ergebnis.luecke) luecken.set(roundId, ergebnis.luecke);

		const versucht = versuchteWellen.get(roundId) ?? new Set<number>();
		versucht.add(welle);
		versuchteWellen.set(roundId, versucht);
	});
}

// Die Lücke zwischen Erwartung und Material ist keine Störung, sondern Information —
// sie geht in die Beurteilung, nicht zum Kind.
const luecken = new Map<string, string>();

export async function bisherigeFragen(roundId: string) {
	const fragen = await db
		.select()
		.from(questions)
		.where(and(eq(questions.roundId, roundId)));
	const bewertete = fragen.filter((f) => f.kind !== 'control');
	const antworten = bewertete.length
		? await db
				.select()
				.from(responses)
				.where(
					inArray(
						responses.questionId,
						bewertete.map((f) => f.id)
					)
				)
		: [];
	const themen = await themenTitel(bewertete.map((f) => f.topicId));

	return bewertete
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((f) => {
			const meine = antworten
				.filter((r) => r.questionId === f.id)
				.sort((a, b) => b.attempt - a.attempt);
			return {
				frage: f.prompt,
				thema: (f.topicId && themen.get(f.topicId)) || 'ohne Thema',
				ergebnis: meine[0]?.outcome ?? 'offen'
			};
		})
		.filter((f) => f.ergebnis !== 'offen');
}

async function themenTitel(ids: (string | null)[]): Promise<Map<string, string>> {
	const echte = ids.filter((i): i is string => Boolean(i));
	if (!echte.length) return new Map();
	const rows = await db.select().from(tocEntries).where(inArray(tocEntries.id, echte));
	return new Map(rows.map((r) => [r.id, r.title]));
}

/**
 * Nächste unbeantwortete Frage der Runde plus laufender Zähler.
 *
 * `wellen` sagt, wie viele Wellen diese Runde überhaupt hat: die Einordnung hat zwei, die
 * Übung eine. Ohne das würde am Ende einer Übung eine zweite Welle angefordert, die es nie gibt.
 */
export async function naechsteFrage(
	roundId: string,
	wellen: 1 | 2 = 2
): Promise<{
	frage: FrageAnsicht | null;
	zweiterVersuch: boolean;
	hinweis: string | null;
	beantwortet: number;
	welleFehlt: 1 | 2 | null;
	danachWarten: boolean;
}> {
	const fragen = (
		await db.select().from(questions).where(eq(questions.roundId, roundId))
	)
		.filter((f) => f.kind !== 'control')
		.sort((a, b) => a.sortOrder - b.sortOrder);

	const antworten = fragen.length
		? await db
				.select()
				.from(responses)
				.where(
					inArray(
						responses.questionId,
						fragen.map((f) => f.id)
					)
				)
		: [];

	// Fertig, sobald sie getroffen war oder das Kontingent der Frage aufgebraucht ist.
	// Das Kontingent ist die Punktzahl: 1 = ein Versuch, 2 = ein Nachfassen, 3 = zwei.
	const fertig = (id: string) => {
		const frage = fragen.find((f) => f.id === id);
		const meine = antworten.filter((r) => r.questionId === id);
		if (!meine.length) return false;
		return meine.some((r) => r.outcome !== 'falsch') || meine.length >= (frage?.punkte ?? 1);
	};

	const beantwortet = fragen.filter((f) => fertig(f.id)).length;
	const offen = fragen.find((f) => !fertig(f.id));

	if (!offen) {
		// Fehlt noch eine Welle? Dann ist die Runde nicht durch, sondern es wird geschrieben.
		const welle2 = wellen === 2 && fragen.some((f) => f.wave === 2);
		const welleFehlt =
			fragen.length && wellen === 2 && !welle2 ? (2 as const) : fragen.length ? null : (1 as const);
		return {
			frage: null,
			zweiterVersuch: false,
			hinweis: null,
			beantwortet,
			welleFehlt,
			danachWarten: false
		};
	}

	const versuche = antworten.filter((r) => r.questionId === offen.id).length;
	const zweiteWelleFehlt = wellen === 2 && !fragen.some((f) => f.wave === 2);
	// Solange die zweite Welle fehlt, ist die geplante Zahl die ehrlichere Ansage; sobald
	// sie da ist, zählt, was wirklich zustande kam. Die Übung hat nur eine Welle — dort
	// steht die Zahl von Anfang an fest.
	const von = wellen === 1 || fragen.some((f) => f.wave === 2) ? fragen.length : FRAGEN_JE_RUNDE;
	return {
		frage: {
			id: offen.id,
			nummer: beantwortet + 1,
			von,
			art: offen.kind,
			prompt: offen.prompt,
			optionen: JSON.parse(offen.options ?? '{"auswahl":[]}') as Optionen,
			hatHinweis: Boolean(offen.hint),
			punkte: offen.punkte,
			// Wie viel diese Frage jetzt noch wert ist — jedes Nachfassen kostet einen Punkt.
			nochWert: Math.max(0, offen.punkte - versuche)
		},
		zweiterVersuch: versuche > 0,
		hinweis: versuche > 0 ? offen.hint : null,
		beantwortet,
		welleFehlt: null,
		// Nach dieser Antwort muss die zweite Welle geschrieben werden — das ist die eine
		// Wartestelle der Runde, und das Kind soll sie erklärt bekommen.
		danachWarten: zweiteWelleFehlt && beantwortet + 1 >= WELLE_1
	};
}

/** Sorgt dafür, dass die Welle da ist, die das Kind gerade braucht. */
export async function welleNachziehen(
	roundId: string,
	welle: 1 | 2,
	kontext: KapitelKontext,
	material: MaterialThema[]
): Promise<void> {
	await welleErzeugen(roundId, welle, kontext, material);
}

// ─────────────────────────────────────────────────────────────
// Bewerten — immer serverseitig
// ─────────────────────────────────────────────────────────────

function gleich(a: string, b: string) {
	return a.trim().localeCompare(b.trim(), 'de', { sensitivity: 'base' }) === 0;
}

/** Trefferquote zwischen 0 und 1 — bei Reihenfolge und Zuordnung stellenweise. */
function trefferquote(art: string, loesung: string[], gegeben: string[]): number {
	if (art === 'order' || art === 'match') {
		if (!loesung.length) return 0;
		const treffer = loesung.filter((l, i) => gegeben[i] && gleich(l, gegeben[i])).length;
		return treffer / loesung.length;
	}
	if (art === 'multi') {
		const richtig = loesung.filter((l) => gegeben.some((g) => gleich(l, g))).length;
		const falsch = gegeben.filter((g) => !loesung.some((l) => gleich(l, g))).length;
		if (!loesung.length) return 0;
		return Math.max(0, (richtig - falsch) / loesung.length);
	}
	return gegeben.length === 1 && loesung.some((l) => gleich(l, gegeben[0])) ? 1 : 0;
}

export type Bewertung = {
	art: string;
	// Beschreibung, nicht Rechengrundlage: 'richtig' = auf Anhieb, 'teilweise' = erst nach
	// Nachfassen. Gerechnet wird mit Punkten.
	outcome: 'richtig' | 'teilweise' | 'falsch';
	perfekt: boolean;
	nochEinVersuch: boolean;
	hinweis: string | null;
	loesung: string[] | null;
	/** Erreichte Punkte dieser Frage, sobald sie durch ist. null, solange nachgefasst wird. */
	punkte: number | null;
	/** Rückmeldung des Bewerters — nur bei Freitext. */
	satz: string | null;
};

export async function antwortSpeichern(
	roundId: string,
	questionId: string,
	gegeben: string[],
	material?: string
): Promise<Bewertung | null> {
	const frage = (
		await db
			.select()
			.from(questions)
			.where(and(eq(questions.id, questionId), eq(questions.roundId, roundId)))
	)[0];
	if (!frage || frage.kind === 'control') return null;

	const bisherige = await db.select().from(responses).where(eq(responses.questionId, questionId));
	const versuch = bisherige.length + 1;
	// Die Punktzahl der Frage IST ihr Versuchs-Kontingent.
	if (versuch > frage.punkte) return null;

	const loesung = JSON.parse(frage.correctAnswer ?? '[]') as string[];

	// Freitext kann keine Trefferquote haben — das entscheidet der Bewerter-Agent.
	let perfekt: boolean;
	let satz: string | null = null;
	if (frage.kind === 'text') {
		const urteil = await bewerteFreitext({
			frage: frage.prompt,
			erwartet: loesung,
			antwort: gegeben.join(' ').slice(0, FREITEXT_MAX),
			material: material ?? '',
			// Solange ein Versuch übrig ist, darf die Rückmeldung nichts verraten.
			darfNochmal: versuch < frage.punkte,
			mitschrieb: mitschriebFuer(roundId)
		});
		perfekt = urteil.getroffen;
		satz = urteil.satz;
	} else {
		// Halbe Treffer sind nicht richtig: der Versuch ist verbraucht, es geht ins Nachfassen.
		perfekt = trefferquote(frage.kind, loesung, gegeben) === 1;
	}

	// Nachgefasst wird, solange das Kontingent reicht. Bei Antippfragen braucht es dafür einen
	// Hinweis, sonst wäre der zweite Versuch Raten; bei Freitext ist die Rückmeldung der Anstoß.
	const nochEinVersuch =
		!perfekt && versuch < frage.punkte && (frage.kind === 'text' || Boolean(frage.hint));

	const outcome: Bewertung['outcome'] = perfekt
		? versuch === 1
			? 'richtig'
			: 'teilweise'
		: 'falsch';

	await db.insert(responses).values({
		questionId,
		attempt: versuch,
		given: JSON.stringify(gegeben),
		outcome
	});

	// Auf Anhieb die volle Zahl, jedes Nachfassen einen Punkt weniger, nie getroffen 0.
	const punkte = perfekt ? Math.max(1, frage.punkte - (versuch - 1)) : nochEinVersuch ? null : 0;

	return {
		art: frage.kind,
		outcome,
		perfekt,
		nochEinVersuch,
		hinweis: nochEinVersuch ? frage.hint : null,
		loesung: nochEinVersuch ? null : loesung,
		punkte,
		satz
	};
}

// ─────────────────────────────────────────────────────────────
// Spiegel, Plan, Abschluss
// ─────────────────────────────────────────────────────────────

export async function spiegelBauen(runde: typeof rounds.$inferSelect, kontext: KapitelKontext) {
	return spiegle({
		kapitel: kontext.kapitel,
		selbsteinschaetzung: SICHERHEIT[(runde.confidenceBefore ?? 3) - 1],
		ergebnisse: await bisherigeFragen(runde.id),
		material: materialAlsText(kontext.themen, false),
		beurteilung: kontext.beurteilung,
		mitschrieb: mitschriebFuer(runde.id)
	});
}

export async function planBauen(
	runde: typeof rounds.$inferSelect,
	kontext: KapitelKontext,
	spiegel: { sitzt: string[]; wackelt: string[] },
	fokus: string[]
) {
	const schonImPlan = await db
		.select({ auftrag: planItems.auftrag, status: planItems.status })
		.from(planItems)
		.where(and(eq(planItems.studentId, runde.studentId), eq(planItems.subjectId, kontext.fachId)));

	return planVorschlaege({
		kapitel: kontext.kapitel,
		fach: kontext.fach,
		spiegel,
		fokus,
		lernziel: await lernzielFuer(runde.studentId, kontext.fach),
		material: materialAlsText(kontext.themen, false),
		beurteilung: kontext.beurteilung,
		schonImPlan,
		mitschrieb: mitschriebFuer(runde.id)
	});
}

/**
 * Rechnet eine Runde ab: erreichte und mögliche Punkte, je Thema und für die ganze Runde.
 * Gleich für Einordnung und Übung, damit ein Thema schon vor der ersten Übung einen Stand hat.
 *
 * Geschrieben werden nur rohe Summen. Das WORT dazu entsteht bei der Anzeige aus der Skala der
 * Klasse — verschiebt die Lehrkraft die Grenzen, muss hier nichts nachgerechnet werden.
 */
export async function rundeAbrechnen(roundId: string): Promise<{
	erreicht: number;
	moeglich: number;
	wert: number | null;
}> {
	const fragen = (
		await db.select().from(questions).where(eq(questions.roundId, roundId))
	).filter((f) => f.kind !== 'control');

	if (!fragen.length) {
		await db.update(rounds).set({ erreicht: 0, moeglich: 0, wert: null }).where(eq(rounds.id, roundId));
		return { erreicht: 0, moeglich: 0, wert: null };
	}

	const antworten = await db
		.select()
		.from(responses)
		.where(
			inArray(
				responses.questionId,
				fragen.map((f) => f.id)
			)
		);

	/** Auf Anhieb die volle Zahl, jedes Nachfassen einen Punkt weniger, nie getroffen 0. */
	const punkteFuer = (frage: (typeof fragen)[number]) => {
		const meine = antworten
			.filter((r) => r.questionId === frage.id)
			.sort((a, b) => a.attempt - b.attempt);
		const treffer = meine.find((r) => r.outcome !== 'falsch');
		if (!treffer) return 0;
		return Math.max(1, frage.punkte - (treffer.attempt - 1));
	};

	// Je Thema summieren. Fragen ohne Thema zählen für die Runde, aber für kein Thema —
	// sonst entstünde ein Sammel-Eintrag, der im Verzeichnis nirgends hingehört.
	const jeThema = new Map<string, { erreicht: number; moeglich: number }>();
	let erreicht = 0;
	let moeglich = 0;
	for (const f of fragen) {
		const p = punkteFuer(f);
		erreicht += p;
		moeglich += f.punkte;
		if (!f.topicId) continue;
		const stand = jeThema.get(f.topicId) ?? { erreicht: 0, moeglich: 0 };
		stand.erreicht += p;
		stand.moeglich += f.punkte;
		jeThema.set(f.topicId, stand);
	}

	// Neu rechnen heißt neu schreiben: eine Runde hat genau einen Stand je Thema.
	await db.delete(roundTopics).where(eq(roundTopics.roundId, roundId));
	if (jeThema.size) {
		await db.insert(roundTopics).values(
			[...jeThema].map(([topicId, s]) => ({
				roundId,
				topicId,
				erreicht: s.erreicht,
				moeglich: s.moeglich
			}))
		);
	}

	const wert = wertAus(erreicht, moeglich);
	await db.update(rounds).set({ erreicht, moeglich, wert }).where(eq(rounds.id, roundId));
	return { erreicht, moeglich, wert };
}

export async function planpunkteAnlegen(
	runde: typeof rounds.$inferSelect,
	kontext: KapitelKontext,
	punkte: { auftrag: string; minuten: number; dueAt: Date | null; thema?: string }[]
) {
	if (!punkte.length) return;
	// Das Thema des Vorschlags festhalten: die Übung braucht später genau dieses Material.
	const themaId = (titel?: string) =>
		titel
			? (kontext.themen.find(
					(t) => t.titel.localeCompare(titel, 'de', { sensitivity: 'base' }) === 0
				)?.themaId ?? null)
			: null;
	// Neue Karten kommen ans Ende der Reihe — in der Reihenfolge, in der der Plan-Agent sie
	// vorgeschlagen hat.
	const ab = await naechstePosition(runde.studentId);
	await db.insert(planItems).values(
		punkte.map((p, i) => ({
			studentId: runde.studentId,
			subjectId: kontext.fachId,
			chapterId: kontext.kapitelId,
			topicId: themaId(p.thema),
			auftrag: p.auftrag,
			minutes: p.minuten,
			position: ab + i,
			dueAt: p.dueAt,
			createdInRoundId: runde.id
		}))
	);
}

/**
 * Rundenende. Setzt den Kapitel-Zeitstempel und lässt die Beurteilung nachlaufen —
 * *nach* dem Ende, damit sie den Plan mitsieht und das Kind nicht wartet.
 * Verworfene oder abgebrochene Runden kommen hier nie an: sonst gilt Material als
 * geprüft, das nie geprüft wurde.
 */
export async function rundeAbschliessen(
	runde: typeof rounds.$inferSelect,
	kontext: KapitelKontext
): Promise<void> {
	const jetzt = new Date();
	await db
		.update(rounds)
		.set({ status: 'abgeschlossen', finishedAt: jetzt })
		.where(eq(rounds.id, runde.id));
	await db
		.update(tocEntries)
		.set({ lastAssessedAt: jetzt })
		.where(eq(tocEntries.id, kontext.kapitelId));

	// Vor der Beurteilung: der Stand je Thema soll stehen, sobald die Runde durch ist.
	await rundeAbrechnen(runde.id);

	const punkte = await db
		.select({ auftrag: planItems.auftrag })
		.from(planItems)
		.where(eq(planItems.createdInRoundId, runde.id));

	void schreibeBeurteilung({
		kapitel: kontext.kapitel,
		bisher: kontext.beurteilung,
		selbsteinschaetzung: runde.confidenceBefore
			? SICHERHEIT[runde.confidenceBefore - 1]
			: null,
		spiegelReaktion: runde.mirrorReaction
			? SPIEGEL_REAKTIONEN[runde.mirrorReaction as SpiegelReaktion]
			: null,
		ergebnisse: await bisherigeFragen(runde.id),
		planpunkte: punkte.map((p) => p.auftrag),
		luecke: luecken.get(runde.id) ?? null,
		material: materialAlsText(kontext.themen, false),
		mitschrieb: mitschriebFuer(runde.id)
	})
		.then(async ({ text }) => {
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
			luecken.delete(runde.id);
		})
		.catch((e) => console.error('[runde] Beurteilung fehlgeschlagen:', e));
}

export async function rundeVerwerfen(roundId: string): Promise<void> {
	await db
		.update(rounds)
		.set({ status: 'verworfen', finishedAt: new Date() })
		.where(eq(rounds.id, roundId));
	mitschriebe.delete(roundId);
	luecken.delete(roundId);
	zwischenstaende.delete(roundId);
	versuchteWellen.delete(roundId);
}
