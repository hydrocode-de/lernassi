// Eine Übung im Gespräch: Selbsteinschätzung → Gespräch → Abschlussprüfung → Rückschau → Zahl.
//
// Dieselbe Ordnung wie in der klassischen Übung, und aus demselben Grund: die Rückschau kommt
// VOR der Zahl. Wer erst 78 % liest, antwortet nicht mehr über sich.
//
// Der Zug von lernassi läuft NICHT über eine Action, sondern über `zug/+server.ts` — er wird
// gestreamt. Hier stehen nur die Züge des Kindes.

import { db } from '$lib/server/db';
import { rounds } from '$lib/server/db/schema';
import { FREITEXT_MAX, SICHERHEIT } from '$lib/server/runde';
import {
	gespraechAbschliessen,
	gespraechsstand,
	gespraechVerwerfen,
	karteVon,
	kindSagt,
	kindTippt,
	ZUG_MAX
} from '$lib/server/gespraech';
import { istRueckschau, RUECKSCHAU, skalaFuer, uebungsKontext } from '$lib/server/uebung';
import { holeUndVergesseMitschrieb } from '$lib/server/runde';
import { KATEGORIEN, kategorieAus } from '$lib/kategorie';
import { offeneKarten } from '$lib/server/warteschlange';
import { and, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const RUHIGER_SATZ = 'Das hat gerade nicht geklappt. Versuch es nochmal.';

async function meinGespraech(locals: App.Locals, id: string) {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const runde = (
		await db
			.select()
			.from(rounds)
			.where(and(eq(rounds.id, id), eq(rounds.studentId, locals.user.id)))
	)[0];
	if (!runde) throw error(404, 'Gespräch nicht gefunden');
	// Klassische Übungen laufen auf ihrer eigenen Seite.
	if (runde.modus !== 'gespraech') throw redirect(303, `/schueler/ueben/${runde.id}`);
	const karte = await karteVon(runde);
	if (!karte) throw error(404, 'Zu diesem Gespräch fehlt der Punkt.');
	return { runde, karte };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { runde, karte } = await meinGespraech(locals, params.id);
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
		zugMax: ZUG_MAX,
		freitextMax: FREITEXT_MAX
	};

	// ─── Durch ───
	if (runde.status === 'abgeschlossen') {
		const skala = await skalaFuer(runde.studentId, karte.subjectId);
		const wert = runde.wert ?? 0;
		const kategorie = kategorieAus(wert, skala);
		const reihe = await offeneKarten(runde.studentId);
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
			platz: reihe.findIndex((k) => k.id === karte.id) + 1 || null,
			offen: reihe.length,
			// Roh-Mitschrieb geht jetzt — und erst jetzt — auf das Gerät des Kindes.
			mitschrieb: holeUndVergesseMitschrieb(runde.id)
		};
	}

	if (!kontext.kapitel) {
		return {
			...gemeinsam,
			phase: 'fehler' as const,
			fehler: 'Zu diesem Punkt kann ich gerade nichts fragen. Nimm einen anderen aus deinem Plan.'
		};
	}

	// ─── Selbsteinschätzung vorher ───
	if (runde.confidenceBefore == null) {
		return { ...gemeinsam, phase: 'selbst' as const };
	}

	// ─── Gespräch ───
	const stand = await gespraechsstand(runde.id, karte);
	if (!stand.durch) {
		return { ...gemeinsam, phase: 'gespraech' as const, stand };
	}

	// ─── Rückschau, vor der Zahl ───
	return { ...gemeinsam, phase: 'rueckschau' as const, zuege: stand.zuege };
};

export const actions: Actions = {
	selbst: async ({ params, locals, request }) => {
		const { runde } = await meinGespraech(locals, params.id);
		const wahl = Number((await request.formData()).get('wert'));
		if (!Number.isInteger(wahl) || wahl < 1 || wahl > 4)
			return fail(400, { message: 'Bitte eine Einschätzung auswählen.' });
		await db.update(rounds).set({ confidenceBefore: wahl }).where(eq(rounds.id, runde.id));
		return { ok: true };
	},

	// Ein frei getippter Zug.
	sagen: async ({ params, locals, request }) => {
		const { runde, karte } = await meinGespraech(locals, params.id);
		const text = String((await request.formData()).get('text') ?? '').trim();
		if (!text) return fail(400, { message: 'Bitte etwas schreiben.' });

		const stand = await gespraechsstand(runde.id, karte);
		if (stand.dran !== 'text') return fail(409, { message: 'Da war lernassi gerade schneller.' });
		await kindSagt(runde.id, text);
		return { ok: true };
	},

	// Eine angetippte Antwort — im Gespräch wie in der Prüfung.
	antworten: async ({ params, locals, request }) => {
		const { runde } = await meinGespraech(locals, params.id);
		const fd = await request.formData();
		const questionId = String(fd.get('questionId') ?? '');
		const gegeben = fd.getAll('antwort').map(String).filter(Boolean);
		if (!questionId || !gegeben.length)
			return fail(400, { message: 'Bitte etwas auswählen.' });

		const ok = await kindTippt(runde.id, questionId, gegeben);
		if (!ok) return fail(400, { message: 'Diese Frage ist schon durch.' });
		return { ok: true };
	},

	rueckschau: async ({ params, locals, request }) => {
		const { runde, karte } = await meinGespraech(locals, params.id);
		const wahl = String((await request.formData()).get('wahl') ?? '');
		if (!istRueckschau(wahl)) return fail(400, { message: 'Bitte eine Antwort auswählen.' });

		// Nicht vorziehen: solange das Gespräch läuft, würde die Rückschau die Runde abrechnen,
		// bevor es etwas abzurechnen gibt.
		const stand = await gespraechsstand(runde.id, karte);
		if (!stand.durch) return fail(409, { message: 'Da fehlt noch etwas — lade die Seite neu.' });

		await db.update(rounds).set({ selfAfter: wahl }).where(eq(rounds.id, runde.id));

		const kontext = await uebungsKontext(karte);
		const frisch = (await db.select().from(rounds).where(eq(rounds.id, runde.id)))[0];
		await gespraechAbschliessen(frisch, karte, kontext.kapitel);
		return { ok: true };
	},

	abbrechen: async ({ params, locals }) => {
		const { runde } = await meinGespraech(locals, params.id);
		await gespraechVerwerfen(runde.id);
		throw redirect(303, '/schueler/plan');
	}
};
