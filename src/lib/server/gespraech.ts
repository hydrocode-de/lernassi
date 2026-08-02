// Ablauf einer Übung im Gespräch (M5). Die klassische Übung schreibt eine Welle Fragen und
// arbeitet sie ab; hier wird Zug um Zug entschieden, und jeder Zug sieht die vorige Antwort.
//
// Der Reihe nach:
//
//   Selbsteinschätzung → Gespräch (Zug um Zug) → Rückschau → Zahl
//
// Gemessen wird aus den Fragen der Session — ALLEN, rein additiv. Es gibt keinen zweiten
// Abschnitt und keine zweite Sorte Frage: eine Frage gegen Ende zählt genauso viel wie die
// erste, und das Kind soll an keiner Stelle das Gefühl haben, jetzt beginne die Prüfung.
// Gesteuert wird das über EINE Zahl, das Punkteziel (`punkteZiel`): der Agent bekommt bei
// jedem Zug gesagt, wo er steht, und füllt auf. Reine Redezüge zählen nie, und Fragen, die
// der Agent selbst als Steuerung markiert, auch nicht (`kind='control'`).
//
// Gerechnet wird weiterhin von `rundeAbrechnen`: für die Abrechnung ist ein Gespräch eine
// Übung wie jede andere, und das Klassen-Dashboard muss davon nichts wissen.
//
// DIE SCHLEIFE LIEGT HIER, NICHT IM SDK. Ein Kind überlegt Minuten und lädt zwischendurch die
// Seite neu — ein Tool-Loop im Modellaufruf könnte darauf nicht warten. Ein Modellaufruf je
// Kind-Zug, der Zustand steht in der Datenbank.

import { db } from '$lib/server/db';
import { planItems, questions, responses, rounds, turns } from '$lib/server/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { materialAlsText, naechsterZug, type Verlaufszug, type Zug } from '$lib/server/lernen';
import {
	alsZeile,
	brauchbar,
	mitschriebFuer,
	type KapitelKontext,
	type Optionen
} from '$lib/server/runde';
import type { Karte } from '$lib/server/uebung';

/** Ist der Gesprächsmodus überhaupt freigeschaltet? Solange er erprobt wird, steht die
 *  klassische Übung unverändert daneben — sonst gibt es nichts zu vergleichen. */
export function gespraechAn(env: Record<string, string | undefined>): boolean {
	return env.GESPRAECH === '1';
}

/** Längenbegrenzung für einen frei getippten Zug. Ein Gesprächsbeitrag, kein Aufsatz. */
export const ZUG_MAX = 600;

/**
 * Wie viele Züge lernassi höchstens hat. Reine Notbremse gegen ein Gespräch, das nicht
 * aufhört — wann Schluss ist, entscheidet das Punkteziel, nicht diese Zahl.
 * Rund eine Minute je Zug: Lesen, Antworten, Rückmeldung.
 */
export function zuegeBudget(minuten: number | null): number {
	const m = Math.max(3, Math.min(20, minuten ?? 10));
	return Math.max(5, Math.min(16, Math.round((m * 60) / 55)));
}

/**
 * Wie viele Punkte eine Session einsammeln soll.
 *
 * Das ist die EINE Steuergröße des Gesprächs. Es gibt keine getrennte Prüfung und keine zwei
 * Sorten Fragen: alles, was gefragt wird, zählt in dieselbe Summe. Der Agent bekommt bei
 * jedem Zug gesagt, wo er steht — merkt er bei 5 von 12, dass die Zeit knapp wird, stellt er
 * eben Fragen statt zu reden; ist er schon drüber, hört er auf.
 *
 * Das Ziel ist Untergrenze, keine Obergrenze: eine Frage, die drüber hinausschießt, ist kein
 * Fehler. Es soll nur nicht vorkommen, dass eine ganze Session auf drei Punkten steht — aus
 * drei Punkten lässt sich kein Prozentwert ablesen, der etwas bedeutet.
 */
export function punkteZiel(minuten: number | null): number {
	const m = Math.max(3, Math.min(20, minuten ?? 10));
	return Math.max(6, Math.min(20, Math.round(m * 1.2)));
}

// ─────────────────────────────────────────────────────────────
// Starten
// ─────────────────────────────────────────────────────────────

/** Startet ein Gespräch zu einer Karte — oder gibt das laufende zurück. */
export async function gespraechStarten(studentId: string, karte: Karte): Promise<string> {
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
			modus: 'gespraech',
			chapterId: karte.chapterId,
			planItemId: karte.id
		})
		.returning({ id: rounds.id });
	return neu[0].id;
}

// ─────────────────────────────────────────────────────────────
// Verlauf lesen
// ─────────────────────────────────────────────────────────────

/** Was von einem Zug angezeigt werden darf. Die Lösung bleibt auch hier auf dem Server. */
export type Zugansicht = {
	id: string;
	wer: 'lernassi' | 'kind';
	art: string;
	text: string | null;
	bezug: string | null;
	frage: {
		id: string;
		art: string;
		optionen: Optionen;
		punkte: number;
		zaehlt: boolean;
		/** null, solange nicht beantwortet. */
		getroffen: boolean | null;
		erreicht: number | null;
	} | null;
};

type Roh = {
	zuege: Zugansicht[];
	offeneFrage: Zugansicht['frage'] | null;
	letzterIstLernassi: boolean;
	geredet: number;
	moeglich: number;
	schluss: boolean;
};

async function lesen(roundId: string): Promise<Roh> {
	const zeilen = await db
		.select()
		.from(turns)
		.where(eq(turns.roundId, roundId))
		.orderBy(asc(turns.sortOrder));

	const frageIds = zeilen.map((z) => z.questionId).filter((x): x is string => Boolean(x));
	const fragen = frageIds.length
		? await db.select().from(questions).where(inArray(questions.id, frageIds))
		: [];
	const antworten = frageIds.length
		? await db.select().from(responses).where(inArray(responses.questionId, frageIds))
		: [];

	const zuege: Zugansicht[] = zeilen.map((z) => {
		const f = fragen.find((q) => q.id === z.questionId);
		if (!f) {
			return { id: z.id, wer: z.rolle as 'lernassi' | 'kind', art: z.art, text: z.text, bezug: z.bezug, frage: null };
		}
		const meine = antworten.filter((r) => r.questionId === f.id);
		const treffer = meine.find((r) => r.outcome !== 'falsch');
		return {
			id: z.id,
			wer: z.rolle as 'lernassi' | 'kind',
			art: z.art,
			text: z.text,
			bezug: z.bezug,
			frage: {
				id: f.id,
				art: f.kind,
				optionen: JSON.parse(f.options ?? '{"auswahl":[]}') as Optionen,
				punkte: f.punkte,
				// Steuerfragen tragen `kind='control'` und gehen nicht in die Punkte ein.
				zaehlt: f.kind !== 'control',
				getroffen: meine.length ? Boolean(treffer) : null,
				erreicht: meine.length ? (treffer ? f.punkte : 0) : null
			}
		};
	});

	const letzter = zuege[zuege.length - 1] ?? null;
	return {
		zuege,
		offeneFrage:
			letzter?.wer === 'lernassi' && letzter.frage && letzter.frage.getroffen === null
				? letzter.frage
				: null,
		letzterIstLernassi: letzter?.wer === 'lernassi',
		geredet: zuege.filter((z) => z.wer === 'lernassi').length,
		// Alles, was bisher zu holen war. Steuerfragen zählen nicht mit — und NUR die Züge von
		// lernassi: der Antwort-Zug des Kindes zeigt auf dieselbe Frage, sonst zählte jede
		// Frage doppelt und das Punkteziel wäre bei der Hälfte erreicht.
		moeglich: zuege.reduce(
			(s, z) => s + (z.wer === 'lernassi' && z.frage?.zaehlt ? z.frage.punkte : 0),
			0
		),
		schluss: zuege.some((z) => z.art === 'schluss')
	};
}

export type Gespraechsstand = {
	zuege: Zugansicht[];
	/** Wer am Zug ist: lernassi (das Kind wartet und der Client holt den Zug), das Kind mit
	 *  einer Antwort auf eine Frage, oder das Kind mit einem freien Satz. */
	dran: 'lernassi' | 'frage' | 'text';
	offeneFrage: Zugansicht['frage'] | null;
	restzuege: number;
	/** Was bisher zu holen war und was die Session einsammeln soll. Nur für den Agenten und
	 *  den Fortschrittsbalken — dem Kind wird während des Gesprächs KEINE Zahl gezeigt. */
	moeglich: number;
	ziel: number;
	/** Der nächste Zug ist der letzte: Ziel erreicht oder Züge fast alle. Der Agent bekommt
	 *  das gesagt und rundet ab, statt noch eine Frage zu stellen. */
	abschluss: boolean;
	/** Das Gespräch ist durch — es folgt die Rückschau. */
	durch: boolean;
};

export async function gespraechsstand(roundId: string, karte: Karte): Promise<Gespraechsstand> {
	const roh = await lesen(roundId);
	const budget = zuegeBudget(karte.minutes);
	const ziel = punkteZiel(karte.minutes);
	const restzuege = Math.max(0, budget - roh.geredet);

	return {
		zuege: roh.zuege,
		dran: roh.offeneFrage ? 'frage' : roh.letzterIstLernassi && !roh.schluss ? 'text' : 'lernassi',
		offeneFrage: roh.offeneFrage,
		restzuege,
		moeglich: roh.moeglich,
		ziel,
		// Genug eingesammelt, oder die Notbremse greift. Beides führt zu genau einem letzten
		// Zug — einem Satz, keiner Frage.
		abschluss: !roh.schluss && (roh.moeglich >= ziel || restzuege <= 1),
		durch: roh.schluss
	};
}

/** Der Verlauf, wie der Agent ihn sieht: Wortlaut plus Ausgang der gezählten Fragen. */
async function fuerDenAgenten(roundId: string): Promise<Verlaufszug[]> {
	const roh = await lesen(roundId);
	return roh.zuege
		.filter((z) => z.text?.trim())
		.map((z) => ({
			wer: z.wer,
			text: z.text!,
			ergebnis:
				z.wer === 'lernassi' || !z.frage
					? null
					: z.frage.getroffen === null
						? null
						: z.frage.getroffen
							? 'richtig'
							: 'falsch'
		}));
}

// ─────────────────────────────────────────────────────────────
// Züge schreiben
// ─────────────────────────────────────────────────────────────

async function naechsteStelle(roundId: string): Promise<number> {
	const alle = await db.select().from(turns).where(eq(turns.roundId, roundId));
	return alle.length;
}

/**
 * Holt den nächsten Zug von lernassi. Gibt den Textstrom heraus, damit die Route ihn direkt
 * weiterreichen kann, und schreibt den Zug weg, sobald er vollständig und geprüft ist.
 *
 * Der Aufrufer MUSS `textStrom` auslaufen lassen und danach `fertig` abwarten.
 */
export function lernassiZug(
	roundId: string,
	karte: Karte,
	kontext: KapitelKontext,
	lernziel: string | null,
	stand: Gespraechsstand,
	verlauf: Verlaufszug[]
): { textStrom: AsyncIterable<string>; fertig: Promise<Zug> } {
	// Nur das Material der Karte, nicht das ganze Kapitel — wie in der klassischen Übung.
	const eigene = karte.topicId
		? kontext.themen.filter((t) => t.themaId === karte.topicId)
		: kontext.themen;
	const material = eigene.length ? eigene : kontext.themen;

	const lauf = naechsterZug({
		fach: kontext.fach,
		kapitel: kontext.kapitel,
		auftrag: karte.auftrag,
		material: materialAlsText(material, true),
		lernziel,
		beurteilung: kontext.beurteilung,
		verlauf,
		restzuege: stand.restzuege,
		punkte: stand.moeglich,
		ziel: stand.ziel,
		abschluss: stand.abschluss,
		mitschrieb: mitschriebFuer(roundId)
	});

	const fertig = lauf.fertig.then(async (zug) => {
		// War der Abschluss angesagt, ist es der Abschluss — auch wenn das Modell noch eine
		// Frage anhängen wollte. Sonst entscheidet der Agent, wann die Session endet, und das
		// soll er nicht.
		await zugSpeichern(roundId, karte, zug, stand.abschluss);
		return zug;
	});

	return { textStrom: lauf.textStrom, fertig };
}

/** Prüft, ob eine Frage im Zug überhaupt spielbar ist — dieselbe Latte wie bei den Wellen. */
function frageBrauchbar(zug: Zug): boolean {
	if (zug.zug !== 'frage' || !zug.art) return false;
	return brauchbar({
		thema: '',
		art: zug.art,
		punkte: zug.punkte,
		frage: zug.text,
		auswahl: zug.auswahl,
		partner: zug.partner,
		richtig: zug.richtig,
		hinweis: null
	});
}

async function zugSpeichern(
	roundId: string,
	karte: Karte,
	zug: Zug,
	erzwingeSchluss = false
): Promise<void> {
	const stelle = await naechsteStelle(roundId);

	// Eine Frage, die die Kontrolle nicht besteht, wird zum Redezug: der Satz steht trotzdem,
	// er ist nur nichts zum Antippen. Besser als ein Zug, der ins Leere läuft.
	// Beim Abschluss wird ohnehin keine Frage mehr angelegt.
	const alsFrage = !erzwingeSchluss && frageBrauchbar(zug);
	let questionId: string | null = null;

	if (alsFrage && zug.art) {
		const zeile = alsZeile(
			{
				thema: '',
				art: zug.art,
				punkte: zug.punkte,
				frage: zug.text,
				auswahl: zug.auswahl,
				partner: zug.partner,
				richtig: zug.richtig,
				hinweis: null
			},
			karte.topicId ?? null,
			// Im Gespräch gibt es kein Nachfassen an der Frage — der nächste Zug ist das
			// Nachfassen. Die Punktzahl ist damit reine Schwierigkeit.
			{ einVersuch: true }
		);
		const [neu] = await db
			.insert(questions)
			.values({
				...zeile,
				roundId,
				wave: 1,
				sortOrder: stelle,
				// Eine Steuerfrage ist eine Frage ohne Messwert — dieselbe Bauart wie die
				// Nachfrage am Anfang einer Einordnung.
				kind: zug.zaehlt ? zeile.kind : 'control',
				bezug: zug.bezug
			})
			.returning({ id: questions.id });
		questionId = neu.id;
	}

	// Wann die Session endet, entscheidet das Punkteziel — nicht der Agent. Ein „schluss",
	// den niemand angefordert hat, wird darum zum Redezug: der Satz steht, das Gespräch
	// geht weiter. Sonst könnte ein Modell bei 6 von 12 Punkten aussteigen, und die Runde
	// stünde mit einer Punktzahl da, aus der sich nichts ablesen lässt.
	const art = erzwingeSchluss
		? 'schluss'
		: zug.zug === 'schluss' || (zug.zug === 'frage' && !alsFrage)
			? 'reden'
			: zug.zug;

	await db.insert(turns).values({
		roundId,
		sortOrder: stelle,
		rolle: 'lernassi',
		art,
		// Bei einer Frage steht derselbe Text auch in `questions.prompt`. Bewusst doppelt:
		// der Verlauf soll für sich lesbar sein, und die Frage muss es für die Prüfung durch
		// die Lehrkraft ebenfalls sein.
		text: zug.text,
		questionId,
		bezug: zug.bezug
	});
}

/** Ein frei getippter Zug des Kindes. */
export async function kindSagt(roundId: string, text: string): Promise<void> {
	const sauber = text.trim().slice(0, ZUG_MAX);
	if (!sauber) return;
	await db.insert(turns).values({
		roundId,
		sortOrder: await naechsteStelle(roundId),
		rolle: 'kind',
		art: 'antwort',
		text: sauber
	});
}

/** Ein angetippter Zug des Kindes: erst bewerten, dann als Zug vermerken. */
export async function kindTippt(
	roundId: string,
	questionId: string,
	gegeben: string[]
): Promise<boolean> {
	const { antwortSpeichern } = await import('$lib/server/runde');
	const bewertung = await antwortSpeichern(roundId, questionId, gegeben);
	if (!bewertung) return false;

	await db.insert(turns).values({
		roundId,
		sortOrder: await naechsteStelle(roundId),
		rolle: 'kind',
		art: 'wahl',
		text: gegeben.join(', '),
		questionId
	});
	return true;
}

// ─────────────────────────────────────────────────────────────
// Abschluss
// ─────────────────────────────────────────────────────────────

/**
 * Abschluss. Räumt zuerst den Wortlaut des Kindes weg, dann rechnet die gewöhnliche Übung ab:
 * Kategorie, Karte einsortieren, Beurteilung nachlaufen lassen.
 *
 * Der Wortlaut geht, das Gerüst bleibt. Was ein Kind frei geschrieben hat, soll so wenig
 * liegen bleiben wie ein Aufschrieb-Foto — die Züge selbst, die Fragen und die Punkte bleiben,
 * weil ohne sie weder Abrechnung noch Prüfung durch die Lehrkraft möglich wäre.
 * Angetippte Antworten bleiben stehen: sie stehen ohnehin in `responses` und sind kein Freitext.
 */
export async function gespraechAbschliessen(
	runde: typeof rounds.$inferSelect,
	karte: Karte,
	kontext: KapitelKontext | null
) {
	await db
		.update(turns)
		.set({ text: null })
		.where(and(eq(turns.roundId, runde.id), eq(turns.rolle, 'kind'), eq(turns.art, 'antwort')));

	const { uebungAbschliessen } = await import('$lib/server/uebung');
	return uebungAbschliessen(runde, karte, kontext);
}

/** Verwerfen: dasselbe wie bei jeder Runde, plus die Züge. */
export async function gespraechVerwerfen(roundId: string): Promise<void> {
	const { rundeVerwerfen } = await import('$lib/server/runde');
	await db.delete(turns).where(eq(turns.roundId, roundId));
	await rundeVerwerfen(roundId);
}

/** Die Karte hinter einer Gesprächsrunde. */
export async function karteVon(runde: typeof rounds.$inferSelect): Promise<Karte | null> {
	if (!runde.planItemId) return null;
	return (
		(
			await db
				.select()
				.from(planItems)
				.where(and(eq(planItems.id, runde.planItemId), eq(planItems.studentId, runde.studentId)))
		)[0] ?? null
	);
}

export { fuerDenAgenten };
