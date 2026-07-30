// Die Runde selbst: Selbsteinschätzung → fünf Fragen in zwei Wellen → Spiegel → Plan.
// Welche Phase gilt, steht in den Daten, nicht im Browser: ein Neuladen landet dort,
// wo das Kind war, und Teilantworten bleiben erhalten.

import { db } from '$lib/server/db';
import { planItems, rounds } from '$lib/server/db/schema';
import { KeinSchluessel } from '$lib/server/lernen';
import {
	antwortSpeichern,
	FRAGEN_JE_RUNDE,
	holeUndVergesseMitschrieb,
	kapitelKontext,
	materialFuerRunde,
	naechsteFrage,
	planBauen,
	planpunkteAnlegen,
	rundeAbschliessen,
	rundeVerwerfen,
	SICHERHEIT,
	spiegelBauen,
	SPIEGEL_REAKTIONEN,
	WELLE_1,
	welleNachziehen,
	welleVersucht,
	zwischenstand,
	type SpiegelReaktion
} from '$lib/server/runde';
import { and, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const RUHIGER_SATZ = 'Das hat gerade nicht geklappt. Versuch es nochmal.';

async function meineRunde(locals: App.Locals, id: string) {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const runde = (
		await db
			.select()
			.from(rounds)
			.where(and(eq(rounds.id, id), eq(rounds.studentId, locals.user.id)))
	)[0];
	if (!runde) throw error(404, 'Runde nicht gefunden');
	// Diese Seite führt nur Einordnungen. Übungen laufen unter /schueler/ueben.
	if (!runde.chapterId) throw redirect(303, `/schueler/ueben/${runde.id}`);
	const kontext = await kapitelKontext(locals.user.id, runde.chapterId);
	if (!kontext) throw error(404, 'Kapitel nicht gefunden');
	return { runde, kontext };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { runde, kontext } = await meineRunde(locals, params.id);
	if (runde.status === 'verworfen') throw redirect(303, `/schueler/kapitel/${runde.chapterId}`);

	const gemeinsam = {
		roundId: runde.id,
		kapitel: kontext.kapitel,
		kapitelId: kontext.kapitelId,
		fach: kontext.fach,
		fachId: kontext.fachId,
		sicherheiten: SICHERHEIT,
		reaktionen: SPIEGEL_REAKTIONEN,
		selbsteinschaetzung: runde.confidenceBefore
			? SICHERHEIT[runde.confidenceBefore - 1]
			: null,
		von: FRAGEN_JE_RUNDE
	};

	// ─── Plan steht: Runde ist durch ───
	if (runde.status === 'abgeschlossen') {
		const punkte = await db
			.select()
			.from(planItems)
			.where(eq(planItems.createdInRoundId, runde.id));
		return {
			...gemeinsam,
			phase: 'fertig' as const,
			punkte: punkte.map((p) => ({
				auftrag: p.auftrag,
				minutes: p.minutes,
				dueAt: p.dueAt?.getTime() ?? null
			})),
			// Roh-Mitschrieb geht jetzt — und erst jetzt — auf das Gerät des Kindes.
			mitschrieb: holeUndVergesseMitschrieb(runde.id)
		};
	}

	// ─── Selbsteinschätzung vorher ───
	if (runde.confidenceBefore == null) {
		return { ...gemeinsam, phase: 'selbst' as const };
	}

	// ─── Fragen ───
	let stand = await naechsteFrage(runde.id);
	let fehler: string | null = null;
	if (stand.welleFehlt && !welleVersucht(runde.id, stand.welleFehlt)) {
		try {
			await welleNachziehen(
				runde.id,
				stand.welleFehlt,
				kontext,
				materialFuerRunde(kontext, true)
			);
		} catch (e) {
			console.error('[runde] Fragen konnten nicht geschrieben werden:', e);
			fehler = e instanceof KeinSchluessel ? 'Das Üben ist gerade nicht möglich.' : RUHIGER_SATZ;
		}
		stand = await naechsteFrage(runde.id);
	}

	if (stand.frage) {
		return {
			...gemeinsam,
			phase: 'fragen' as const,
			frage: stand.frage,
			zweiterVersuch: stand.zweiterVersuch,
			hinweis: stand.hinweis,
			beantwortet: stand.beantwortet,
			danachWarten: stand.danachWarten
		};
	}

	// Keine Frage übrig und keine Welle nachzuziehen: es gab keine einzige brauchbare Frage.
	if (!stand.beantwortet) {
		return { ...gemeinsam, phase: 'fehler' as const, fehler: fehler ?? RUHIGER_SATZ };
	}

	// ─── Spiegel ───
	const stand2 = zwischenstand(runde.id);
	if (!stand2.spiegel) {
		try {
			stand2.spiegel = await spiegelBauen(runde, kontext);
		} catch (e) {
			console.error('[runde] Spiegel fehlgeschlagen:', e);
			return { ...gemeinsam, phase: 'fehler' as const, fehler: RUHIGER_SATZ };
		}
	}
	if (!runde.mirrorReaction || !stand2.fokus) {
		return {
			...gemeinsam,
			phase: 'spiegel' as const,
			spiegel: stand2.spiegel,
			reaktion: runde.mirrorReaction,
			fokus: stand2.fokus ?? null
		};
	}

	// ─── Plan ───
	if (!stand2.plan) {
		try {
			stand2.plan = await planBauen(runde, kontext, stand2.spiegel, stand2.fokus);
		} catch (e) {
			console.error('[runde] Plan fehlgeschlagen:', e);
			return { ...gemeinsam, phase: 'fehler' as const, fehler: RUHIGER_SATZ };
		}
	}
	return {
		...gemeinsam,
		phase: 'plan' as const,
		spiegel: stand2.spiegel,
		plan: stand2.plan
	};
};

export const actions: Actions = {
	selbsteinschaetzung: async ({ params, locals, request }) => {
		const { runde } = await meineRunde(locals, params.id);
		const wert = Number(String((await request.formData()).get('wert') ?? ''));
		if (!(wert >= 1 && wert <= SICHERHEIT.length)) return fail(400, { message: RUHIGER_SATZ });
		// Nicht zweimal fragen — auch nicht, wenn zwischendurch Material nachgereicht wurde.
		if (runde.confidenceBefore == null) {
			await db
				.update(rounds)
				.set({ confidenceBefore: wert })
				.where(eq(rounds.id, runde.id));
		}
		return { ok: true };
	},

	antworten: async ({ params, locals, request }) => {
		const { runde, kontext } = await meineRunde(locals, params.id);
		const fd = await request.formData();
		const questionId = String(fd.get('frage') ?? '');
		const gegeben = fd
			.getAll('antwort')
			.map((v) => String(v))
			.filter((v) => v.length);
		if (!questionId || !gegeben.length)
			return fail(400, { message: 'Tipp erst eine Antwort an.' });

		const bewertung = await antwortSpeichern(runde.id, questionId, gegeben);
		if (!bewertung) return fail(400, { message: RUHIGER_SATZ });

		// Die zweite Welle wird geschrieben, während das Kind die Rückmeldung liest —
		// so bleibt genau eine kurze Wartestelle, mitten drin.
		const stand = await naechsteFrage(runde.id);
		if (stand.beantwortet >= WELLE_1 && stand.welleFehlt === 2) {
			void welleNachziehen(runde.id, 2, kontext, materialFuerRunde(kontext, true)).catch(
				() => {}
			);
		}

		return {
			antwort: gegeben,
			art: bewertung.art,
			outcome: bewertung.outcome,
			// Ganz richtig im zweiten Versuch zählt als `teilweise` — es liest sich aber
			// anders als halb richtig, und so muss es auch klingen.
			perfekt: bewertung.perfekt,
			nochEinVersuch: bewertung.nochEinVersuch,
			hinweis: bewertung.hinweis,
			loesung: bewertung.loesung
		};
	},

	spiegelReaktion: async ({ params, locals, request }) => {
		const { runde } = await meineRunde(locals, params.id);
		const wert = String((await request.formData()).get('wert') ?? '');
		if (!(wert in SPIEGEL_REAKTIONEN)) return fail(400, { message: RUHIGER_SATZ });
		await db
			.update(rounds)
			.set({ mirrorReaction: wert as SpiegelReaktion })
			.where(eq(rounds.id, runde.id));
		return { ok: true };
	},

	fokus: async ({ params, locals, request }) => {
		const { runde } = await meineRunde(locals, params.id);
		const gewaehlt = (await request.formData())
			.getAll('kandidat')
			.map((v) => String(v))
			.filter((v) => v.length);
		// Auswahl ist Steuerung für den Plan-Vorschlag, keine Messung — leer ist erlaubt.
		zwischenstand(runde.id).fokus = gewaehlt;
		return { ok: true };
	},

	planSpeichern: async ({ params, locals, request }) => {
		const { runde, kontext } = await meineRunde(locals, params.id);
		if (runde.status !== 'laufend') throw redirect(303, `/schueler/runde/${runde.id}`);
		const fd = await request.formData();
		const vorschlaege = zwischenstand(runde.id).plan?.vorschlaege ?? [];
		const angetippt = fd.getAll('punkt').map((v) => Number(String(v)));
		// Die Vorschläge liegen nur im Arbeitsspeicher. Sind sie weg (Serverneustart),
		// darf die Runde nicht mit leerem Plan zugehen — dann lieber neu vorschlagen.
		if (angetippt.length && !vorschlaege.length)
			return fail(409, { message: 'Die Vorschläge sind mir abhandengekommen. Lade neu.' });
		const gewaehlt = angetippt.filter(
			(i) => Number.isInteger(i) && i >= 0 && i < vorschlaege.length
		);

		const punkte = gewaehlt.map((i) => {
			const wann = String(fd.get(`wann-${i}`) ?? 'sofort');
			const datum = wann === 'sofort' ? null : new Date(`${wann}T12:00:00`);
			return {
				auftrag: vorschlaege[i].auftrag,
				minuten: vorschlaege[i].minuten,
				thema: vorschlaege[i].thema,
				dueAt: datum && !isNaN(datum.getTime()) ? datum : null
			};
		});

		await planpunkteAnlegen(runde, kontext, punkte);
		await rundeAbschliessen(runde, kontext);
		throw redirect(303, `/schueler/runde/${runde.id}`);
	},

	// Nichts mitnehmen ist eine gültige Antwort: ein Plan entsteht nur, wenn es etwas zu tun gibt.
	ohnePlan: async ({ params, locals }) => {
		const { runde, kontext } = await meineRunde(locals, params.id);
		if (runde.status === 'laufend') await rundeAbschliessen(runde, kontext);
		throw redirect(303, `/schueler/runde/${runde.id}`);
	},

	// Abbruch mitten drin: kein Plan, kein Kapitel-Zeitstempel, keine Beurteilung.
	beenden: async ({ params, locals }) => {
		const { runde, kontext } = await meineRunde(locals, params.id);
		if (runde.status === 'laufend') await rundeVerwerfen(runde.id);
		throw redirect(303, `/schueler?fach=${kontext.fachId}`);
	}
};
