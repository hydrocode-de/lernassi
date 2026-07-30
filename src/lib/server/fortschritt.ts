// Das Fortschrittsbild für die Lehrkraft. Zwei Bilder, in dieser Reihenfolge:
//
//   1. Themenblick der Klasse — je Thema die Verteilung der Kinder über die vier Kategorien.
//   2. Ein Kind, nach Klick auf sein Pseudonym.
//
// Warum so: die Lehrkraft handelt in der Klasse. Was sie aus dem Bild zieht, ist „das Thema
// muss ich nochmal machen" — das steht in der Verteilung, nicht in 25 Einzelzeilen. Eine
// Kind-mal-Thema-Matrix wäre eine Rangliste und auf keinem Bildschirm lesbar.
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

async function staendeDerKlasse(classId: string): Promise<{ staende: Stand[]; kinder: Kind[] }> {
	const kinderZeilen = await db
		.select({ id: students.userId, pseudonym: user.username })
		.from(students)
		.innerJoin(user, eq(user.id, students.userId))
		.where(eq(students.classId, classId));

	// Alphabetisch nach Pseudonym — die Reihenfolge sagt nichts über Leistung.
	const kinder: Kind[] = kinderZeilen
		.map((k) => ({ id: k.id, pseudonym: k.pseudonym ?? '—' }))
		.sort((a, b) => a.pseudonym.localeCompare(b.pseudonym, 'de'));
	if (!kinder.length) return { staende: [], kinder };

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
	if (!runden.length) return { staende: [], kinder };

	const zeilen = await db
		.select()
		.from(roundTopics)
		.where(
			inArray(
				roundTopics.roundId,
				runden.map((r) => r.id)
			)
		);
	if (!zeilen.length) return { staende: [], kinder };

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

	return { staende: [...jueng.values()], kinder };
}

export type Kind = { id: string; pseudonym: string };

export type ThemenZeile = {
	topicId: string;
	titel: string;
	/** Wie viele Kinder in Kategorie 1 bis 4 stehen. */
	verteilung: [number, number, number, number];
	/** Wie viele Kinder das Thema überhaupt schon hatten. */
	kinder: number;
};

/** Der Themenblick: Wackelndes oben. */
export async function themenblick(
	classId: string,
	skala: [Stufe, Stufe, Stufe]
): Promise<{ themen: ThemenZeile[]; kinder: Kind[] }> {
	const { staende, kinder } = await staendeDerKlasse(classId);

	const jeThema = new Map<string, ThemenZeile>();
	for (const s of staende) {
		if (!s.moeglich) continue;
		const zeile =
			jeThema.get(s.topicId) ??
			({ topicId: s.topicId, titel: s.titel, verteilung: [0, 0, 0, 0], kinder: 0 } as ThemenZeile);
		const kategorie = kategorieAus(Math.round((s.erreicht / s.moeglich) * 100), skala);
		zeile.verteilung[kategorie - 1] += 1;
		zeile.kinder += 1;
		jeThema.set(s.topicId, zeile);
	}

	// „Wackelndes oben" heißt: der Anteil in den unteren zwei Kategorien entscheidet.
	const themen = [...jeThema.values()].sort((a, b) => {
		const unten = (z: ThemenZeile) => (z.verteilung[2] + z.verteilung[3]) / z.kinder;
		return unten(b) - unten(a) || b.kinder - a.kinder || a.titel.localeCompare(b.titel, 'de');
	});

	return { themen, kinder };
}

export type KindBild = {
	pseudonym: string;
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
		pseudonym: kind.pseudonym,
		themen,
		uebungen,
		plan: {
			offen: karten.filter((k) => k.status === 'offen').length,
			erledigt: karten.filter((k) => k.status === 'erledigt').length
		}
	};
}
