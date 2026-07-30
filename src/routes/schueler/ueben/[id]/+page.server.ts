// Eine Übung: Selbsteinschätzung → Fragen → Rückschau → Kategorie.
//
// Die Rückschau kommt VOR der Zahl. Wer erst 78 % liest, antwortet nicht mehr über sich, und
// genau die Differenz zwischen Selbstbild und Ergebnis ist das Signal, das wir messen wollen.
//
// Welche Phase gilt, steht in den Daten, nicht im Browser: ein Neuladen landet dort, wo das
// Kind war.

import { db } from '$lib/server/db';
import { rounds } from '$lib/server/db/schema';
import { KeinSchluessel, materialAlsText } from '$lib/server/lernen';
import {
	antwortSpeichern,
	FREITEXT_MAX,
	holeUndVergesseMitschrieb,
	naechsteFrage,
	rundeVerwerfen,
	SICHERHEIT
} from '$lib/server/runde';
import {
	istRueckschau,
	meineKarte,
	moeglichePunkte,
	RUECKSCHAU,
	skalaFuer,
	uebungAbschliessen,
	uebungsfragenSchreiben,
	uebungsKontext,
	verlaufFuer
} from '$lib/server/uebung';
import { KATEGORIEN, kategorieAus } from '$lib/kategorie';
import { offeneKarten } from '$lib/server/warteschlange';
import { and, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const RUHIGER_SATZ = 'Das hat gerade nicht geklappt. Versuch es nochmal.';

async function meineUebung(locals: App.Locals, id: string) {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const runde = (
		await db
			.select()
			.from(rounds)
			.where(and(eq(rounds.id, id), eq(rounds.studentId, locals.user.id)))
	)[0];
	if (!runde) throw error(404, 'Übung nicht gefunden');
	// Einordnungen laufen auf ihrer eigenen Seite.
	if (runde.kind !== 'uebung') throw redirect(303, `/schueler/runde/${runde.id}`);
	if (!runde.planItemId) throw error(404, 'Zu dieser Übung fehlt der Punkt.');
	const karte = await meineKarte(locals.user.id, runde.planItemId);
	if (!karte) throw error(404, 'Zu dieser Übung fehlt der Punkt.');
	return { runde, karte };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { runde, karte } = await meineUebung(locals, params.id);
	if (runde.status === 'verworfen') throw redirect(303, '/schueler/plan');

	const kontext = await uebungsKontext(karte);
	const gemeinsam = {
		roundId: runde.id,
		auftrag: karte.auftrag,
		minuten: karte.minutes,
		fach: kontext.kapitel?.fach ?? null,
		kapitel: kontext.kapitel?.kapitel ?? null,
		sicherheiten: SICHERHEIT,
		rueckschauen: RUECKSCHAU,
		freitextMax: FREITEXT_MAX
	};

	// ─── Durch: Kategorie und was mit der Karte passiert ───
	if (runde.status === 'abgeschlossen') {
		const skala = await skalaFuer(runde.studentId);
		const wert = runde.wert ?? 0;
		const kategorie = kategorieAus(wert, skala);
		// Nicht die Kategorie erzählen, sondern den Platz, an dem die Karte wirklich liegt —
		// ein Termin kann sie weiter vorne halten.
		const reihe = await offeneKarten(runde.studentId);
		const platz = reihe.findIndex((k) => k.id === karte.id) + 1 || null;
		return {
			...gemeinsam,
			phase: 'fertig' as const,
			wert,
			erreicht: runde.erreicht ?? 0,
			moeglich: runde.moeglich ?? 0,
			kategorie,
			wort: KATEGORIEN[kategorie].wort,
			farbe: KATEGORIEN[kategorie].farbe,
			abgehakt: karte.status === 'erledigt',
			platz,
			offen: reihe.length,
			// Roh-Mitschrieb geht jetzt — und erst jetzt — auf das Gerät des Kindes.
			mitschrieb: holeUndVergesseMitschrieb(runde.id)
		};
	}

	// ─── Selbsteinschätzung vorher ───
	if (runde.confidenceBefore == null) {
		return { ...gemeinsam, phase: 'selbst' as const };
	}

	// ─── Fragen ───
	let stand = await naechsteFrage(runde.id, 1);
	let fehler: string | null = null;
	if (stand.welleFehlt && kontext.kapitel) {
		try {
			await uebungsfragenSchreiben(runde.id, karte, kontext.kapitel);
		} catch (e) {
			console.error('[uebung] Fragen konnten nicht geschrieben werden:', e);
			fehler = e instanceof KeinSchluessel ? 'Das Üben ist gerade nicht möglich.' : RUHIGER_SATZ;
		}
		stand = await naechsteFrage(runde.id, 1);
	}

	if (!kontext.kapitel) {
		return {
			...gemeinsam,
			phase: 'fehler' as const,
			fehler: 'Zu diesem Punkt kann ich gerade nichts fragen. Nimm einen anderen aus deinem Plan.'
		};
	}

	if (stand.frage) {
		const verlauf = await verlaufFuer(runde.id);
		return {
			...gemeinsam,
			phase: 'fragen' as const,
			frage: stand.frage,
			nachgefasst: stand.zweiterVersuch,
			hinweis: stand.hinweis,
			beantwortet: stand.beantwortet,
			verlauf,
			// Für den Balken: was schon geholt ist und was insgesamt zu holen wäre.
			erreicht: verlauf.reduce((s, e) => s + e.erreicht, 0),
			moeglich: await moeglichePunkte(runde.id)
		};
	}

	if (!stand.beantwortet) {
		return { ...gemeinsam, phase: 'fehler' as const, fehler: fehler ?? RUHIGER_SATZ };
	}

	// ─── Vergleichen, dann Rückschau — beides vor der Zahl ───
	return { ...gemeinsam, phase: 'rueckschau' as const };
};

export const actions: Actions = {
	selbst: async ({ params, locals, request }) => {
		const { runde } = await meineUebung(locals, params.id);
		const wahl = Number((await request.formData()).get('wert'));
		if (!Number.isInteger(wahl) || wahl < 1 || wahl > 4)
			return fail(400, { message: 'Bitte eine Einschätzung auswählen.' });
		await db.update(rounds).set({ confidenceBefore: wahl }).where(eq(rounds.id, runde.id));
		return { ok: true };
	},

	antworten: async ({ params, locals, request }) => {
		const { runde, karte } = await meineUebung(locals, params.id);
		const fd = await request.formData();
		const questionId = String(fd.get('questionId') ?? '');
		const gegeben = fd.getAll('antwort').map(String).filter(Boolean);
		if (!questionId || !gegeben.length)
			return fail(400, { message: 'Bitte etwas auswählen oder schreiben.' });

		const kontext = await uebungsKontext(karte);
		try {
			const bewertung = await antwortSpeichern(
				runde.id,
				questionId,
				gegeben,
				kontext.kapitel ? materialAlsText(kontext.kapitel.themen, false) : ''
			);
			if (!bewertung) return fail(400, { message: 'Diese Frage ist schon durch.' });
			// Bei Freitext den eigenen Text zurückgeben: wer nachfassen darf, soll seinen Satz
			// verbessern können statt ihn neu zu tippen.
			return {
				bewertung,
				entwurf: bewertung.nochEinVersuch && !bewertung.perfekt ? gegeben.join(' ') : null
			};
		} catch (e) {
			console.error('[uebung] Antwort konnte nicht bewertet werden:', e);
			return fail(500, {
				message: e instanceof KeinSchluessel ? 'Das Üben ist gerade nicht möglich.' : RUHIGER_SATZ
			});
		}
	},

	// Rückschau — und erst danach rechnet die Übung ab.
	rueckschau: async ({ params, locals, request }) => {
		const { runde, karte } = await meineUebung(locals, params.id);
		const wahl = String((await request.formData()).get('wahl') ?? '');
		if (!istRueckschau(wahl)) return fail(400, { message: 'Bitte eine Antwort auswählen.' });
		await db.update(rounds).set({ selfAfter: wahl }).where(eq(rounds.id, runde.id));

		const kontext = await uebungsKontext(karte);
		const frisch = (await db.select().from(rounds).where(eq(rounds.id, runde.id)))[0];
		await uebungAbschliessen(frisch, karte, kontext.kapitel);
		return { ok: true };
	},

	abbrechen: async ({ params, locals }) => {
		const { runde } = await meineUebung(locals, params.id);
		await rundeVerwerfen(runde.id);
		throw redirect(303, '/schueler/plan');
	}
};
