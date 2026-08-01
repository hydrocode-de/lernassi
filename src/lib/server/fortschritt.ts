// Das Fortschrittsbild für die Lehrkraft. Zwei Bilder, in dieser Reihenfolge:
//
//   1. Die Kinder der Klasse — je Kind, wie viele seiner Themen wo stehen.
//   2. Ein Kind im Einzelnen, nach Klick.
//
// Warum NICHT über Themen aggregiert: die Gliederung entsteht aus dem Heft jedes Kindes.
// Zwei Kinder haben fast nie dasselbe Thema unter demselben Titel, und eine Klassenliste
// aus 25 Themen mit je „1 wackelt" sagt nichts. Gemeinsam ist der Klasse das Lernziel,
// nicht die Themenliste.
//
// Die Kinder werden NIE nach Leistung sortiert, nirgends.

import { db } from '$lib/server/db';
import { rounds, roundTopics, students, tocEntries, user } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { kategorieAus, type Kategorie, type Stufe } from '$lib/kategorie';

/** Roher Stand eines Kindes zu einem Thema — jüngste Runde gewinnt. */
type Stand = {
	studentId: string;
	topicId: string;
	titel: string;
	erreicht: number;
	moeglich: number;
	wann: number;
};

async function staendeDerKlasse(
	classId: string
): Promise<{ staende: Stand[]; kinder: Kind[]; letzteAktivitaet: Map<string, number> }> {
	const kinderZeilen = await db
		.select({ id: students.userId, pseudonym: user.username, rufname: user.firstName })
		.from(students)
		.innerJoin(user, eq(user.id, students.userId))
		.where(eq(students.classId, classId));

	// Alphabetisch nach dem Namen, unter dem das Kind hier steht — die Reihenfolge sagt
	// nichts über Leistung. Ohne Rufnamen bleibt das Pseudonym stehen.
	const kinder: Kind[] = kinderZeilen
		.map((k) => ({
			id: k.id,
			pseudonym: k.pseudonym ?? '—',
			name: k.rufname?.trim() || k.pseudonym || '—'
		}))
		.sort((a, b) => a.name.localeCompare(b.name, 'de'));
	if (!kinder.length) return { staende: [], kinder, letzteAktivitaet: new Map() };

	const runden = (
		await db
			.select()
			.from(rounds)
			.where(
				inArray(
					rounds.studentId,
					kinder.map((k) => k.id)
				)
			)
	).filter((r) => r.status === 'abgeschlossen');

	// Zuletzt aktiv: die jüngste abgeschlossene Runde eines Kindes, egal ob Einordnung oder
	// Übung — beides ist gelernte Arbeit. Kein Login-Zeitpunkt: der sagt nichts übers Lernen.
	const letzteAktivitaet = new Map<string, number>();
	for (const r of runden) {
		const wann = (r.finishedAt ?? r.startedAt).getTime();
		const bisher = letzteAktivitaet.get(r.studentId);
		if (bisher === undefined || wann > bisher) letzteAktivitaet.set(r.studentId, wann);
	}

	if (!runden.length) return { staende: [], kinder, letzteAktivitaet };

	const zeilen = await db
		.select()
		.from(roundTopics)
		.where(
			inArray(
				roundTopics.roundId,
				runden.map((r) => r.id)
			)
		);
	if (!zeilen.length) return { staende: [], kinder, letzteAktivitaet };

	const titel = new Map(
		(
			await db
				.select()
				.from(tocEntries)
				.where(inArray(tocEntries.id, [...new Set(zeilen.map((z) => z.topicId))]))
		).map((t) => [t.id, t.title] as const)
	);
	const rundeVon = new Map(runden.map((r) => [r.id, r] as const));

	// Je Kind und Thema zählt die jüngste Runde.
	const jueng = new Map<string, Stand>();
	for (const z of zeilen) {
		const runde = rundeVon.get(z.roundId);
		if (!runde) continue;
		const wann = (runde.finishedAt ?? runde.startedAt).getTime();
		const schluessel = `${runde.studentId}:${z.topicId}`;
		const da = jueng.get(schluessel);
		if (da && da.wann >= wann) continue;
		jueng.set(schluessel, {
			studentId: runde.studentId,
			topicId: z.topicId,
			titel: titel.get(z.topicId) ?? 'Thema',
			erreicht: z.erreicht,
			moeglich: z.moeglich,
			wann
		});
	}

	return { staende: [...jueng.values()], kinder, letzteAktivitaet };
}

export type Kind = { id: string; pseudonym: string; name: string };

export type KindZeile = Kind & {
	/** Wie viele Themen dieses Kindes in Kategorie 1 bis 4 stehen. */
	verteilung: [number, number, number, number];
	/** Wie viele Themen es überhaupt schon geübt hat. */
	themen: number;
	/** Wann die jüngste abgeschlossene Runde dieses Kindes war. null = noch nie. */
	zuletztAktiv: number | null;
};

/** Die Klassenliste: jedes Kind mit seinem eigenen Stand. Alphabetisch, nie nach Leistung. */
export async function klassenblick(
	classId: string,
	skala: [Stufe, Stufe, Stufe]
): Promise<KindZeile[]> {
	const { staende, kinder, letzteAktivitaet } = await staendeDerKlasse(classId);

	return kinder.map((kind) => {
		const zeile: KindZeile = {
			...kind,
			verteilung: [0, 0, 0, 0],
			themen: 0,
			zuletztAktiv: letzteAktivitaet.get(kind.id) ?? null
		};
		for (const s of staende) {
			if (s.studentId !== kind.id || !s.moeglich) continue;
			const kategorie = kategorieAus(Math.round((s.erreicht / s.moeglich) * 100), skala);
			zeile.verteilung[kategorie - 1] += 1;
			zeile.themen += 1;
		}
		return zeile;
	});
}

export type KindBild = Kind & {
	themen: {
		topicId: string;
		titel: string;
		erreicht: number;
		moeglich: number;
		kategorie: Kategorie;
	}[];
	/** Selbsteinschätzung vorher und Rückschau nachher gegen das Ergebnis — je Übung eine Zeile. */
	uebungen: {
		wann: number;
		wert: number | null;
		kategorie: Kategorie | null;
		vorher: number | null;
		nachher: string | null;
	}[];
	plan: { offen: number; erledigt: number };
};

/** Das zweite Bild: ein Kind. Nur auf Klick — eine bewusste Handlung. */
export async function kindBild(
	classId: string,
	studentId: string,
	skala: [Stufe, Stufe, Stufe]
): Promise<KindBild | null> {
	const { staende, kinder } = await staendeDerKlasse(classId);
	const kind = kinder.find((k) => k.id === studentId);
	if (!kind) return null;

	const themen = staende
		.filter((s) => s.studentId === studentId && s.moeglich)
		.map((s) => ({
			topicId: s.topicId,
			titel: s.titel,
			erreicht: s.erreicht,
			moeglich: s.moeglich,
			kategorie: kategorieAus(Math.round((s.erreicht / s.moeglich) * 100), skala)
		}))
		.sort((a, b) => a.kategorie - b.kategorie || a.titel.localeCompare(b.titel, 'de'));

	const { planItems } = await import('$lib/server/db/schema');
	const karten = await db.select().from(planItems).where(eq(planItems.studentId, studentId));

	const uebungen = (await db.select().from(rounds).where(eq(rounds.studentId, studentId)))
		.filter((r) => r.kind === 'uebung' && r.status === 'abgeschlossen')
		.sort((a, b) => (a.finishedAt?.getTime() ?? 0) - (b.finishedAt?.getTime() ?? 0))
		.map((r) => ({
			wann: (r.finishedAt ?? r.startedAt).getTime(),
			wert: r.wert,
			kategorie: r.wert === null ? null : kategorieAus(r.wert, skala),
			vorher: r.confidenceBefore,
			nachher: r.selfAfter
		}));

	return {
		...kind,
		themen,
		uebungen,
		plan: {
			offen: karten.filter((k) => k.status === 'offen').length,
			erledigt: karten.filter((k) => k.status === 'erledigt').length
		}
	};
}
