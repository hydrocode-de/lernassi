// Eine Seite selbst schreiben, statt sie zu fotografieren. Der zweite Weg ins Heft.
//
// Warum es den gibt: nicht jeder Aufschrieb existiert auf Papier. Im Unterricht nur zugehört,
// Heft vergessen, etwas selbst nachgelesen, ein Tafelbild abgetippt — bisher konnte das Kind
// daraus nichts machen, und das Verzeichnis behauptete, es gäbe zu diesem Kapitel nichts.
//
// Die Arbeitsteilung ist umgekehrt zur Foto-Route: dort schreibt die KI den Text und das Kind
// korrigiert die Einordnung, hier schreibt das Kind den Text und die KI macht nur die
// Zusammenfassung und die Begriffe. Kapitel und Stelle im Verzeichnis stehen vorher fest —
// das Kind kommt aus dem Verzeichnis her und hat sie dort gewählt.
//
// Der Text ist ein offenes Freitextfeld, das teuerste Datenschutz-Format (MISSION.md). Hier
// ist es eng gefasst: es steht im Heft des Kindes, geht in keine Bewertung ein und wird der
// Lehrkraft nicht übermittelt. Was daraus gefragt wird, entsteht später wie bei jedem anderen
// Aufschrieb.

import { db } from '$lib/server/db';
import { notes, tocEntries } from '$lib/server/db/schema';
import { einsortieren, kapitelMitFach } from '$lib/server/gliederung';
import { themenReihenfolge } from '$lib/server/heft';
import { KeinSchluessel, leseGetipptes, tocAlsText } from '$lib/server/ingest';
import { and, eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** Kürzer geht ein Aufschrieb nicht — darunter gibt es nichts zusammenzufassen. */
const MINDESTENS = 40;
const HOECHSTENS = 20_000;

function wer(locals: App.Locals): string {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	return locals.user.id;
}

/**
 * Das Kapitel, in das geschrieben wird — entweder aus der Adresse (neue Seite) oder über den
 * Aufschrieb, der bearbeitet wird. Liefert alles, was Seite und Aktion brauchen.
 */
async function ziel(studentId: string, kapitelId: string, noteId: string | null) {
	if (noteId) {
		const note = (
			await db
				.select()
				.from(notes)
				.where(and(eq(notes.id, noteId), eq(notes.studentId, studentId)))
		)[0];
		// Nur selbst getippte Texte sind hier bearbeitbar. Eine Abschrift aus Fotos zu ändern
		// hieße, sie von den Seiten zu lösen, die daneben liegen — dann steht im Heft etwas
		// anderes als im Heft.
		if (!note || note.herkunft !== 'selbst' || !note.topicId) throw error(404, 'Nicht gefunden');
		const thema = (await db.select().from(tocEntries).where(eq(tocEntries.id, note.topicId)))[0];
		const treffer = thema?.parentId ? await kapitelMitFach(studentId, thema.parentId) : null;
		if (!thema || !treffer) throw error(404, 'Nicht gefunden');
		return { ...treffer, note, thema };
	}

	const treffer = await kapitelMitFach(studentId, kapitelId);
	if (!treffer) throw error(404, 'Nicht gefunden');
	return { ...treffer, note: null, thema: null };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const studentId = wer(locals);
	const noteId = url.searchParams.get('note');
	const { kapitel, fach, note, thema } = await ziel(
		studentId,
		url.searchParams.get('kapitel') ?? '',
		noteId
	);

	const themen = await themenReihenfolge(studentId, kapitel.id);
	const roheStelle = url.searchParams.get('nach');
	const stelle =
		roheStelle === 'anfang' || themen.some((t) => t.id === roheStelle) ? roheStelle : '';

	return {
		fach: { id: fach.id, title: fach.title },
		kapitel: { id: kapitel.id, title: kapitel.title },
		// Beim Bearbeiten bleibt die Stelle, wo sie ist — umsortiert wird im Verzeichnis.
		stelle: note ? '' : stelle,
		davor: themen.find((t) => t.id === stelle)?.title ?? null,
		note: note ? { id: note.id, titel: thema!.title, text: note.transcript ?? '' } : null,
		mindestens: MINDESTENS
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const studentId = wer(locals);
		const fd = await request.formData();
		const noteId = String(fd.get('note') ?? '') || null;
		const titel = String(fd.get('titel') ?? '').trim();
		const text = String(fd.get('text') ?? '').trim();

		// Der Text kommt bei jedem Fehlschlag zurück in das Feld. Ein Kind, das zehn Minuten
		// getippt hat, verliert das nicht, weil das Modell gerade nicht antwortet.
		const zurueck = (status: number, message: string) =>
			fail(status, { message, titel, text });

		if (text.length < MINDESTENS)
			return zurueck(400, `Schreib noch ein bisschen mehr – mindestens ein paar Sätze.`);
		if (text.length > HOECHSTENS)
			return zurueck(400, 'Das ist sehr viel Text. Mach daraus lieber zwei Seiten.');
		if (titel.length > 120) return zurueck(400, 'Das ist ein sehr langer Titel.');

		const { kapitel, fach, note } = await ziel(
			studentId,
			String(fd.get('kapitel') ?? ''),
			noteId
		);

		// Dieselbe Gliederung als Kontext wie beim Foto — damit die Zusammenfassung in der
		// Sprache dieses Fachs bleibt und nicht neben dem Unterricht steht.
		const alle = await db.select().from(tocEntries).where(eq(tocEntries.studentId, studentId));
		const gliederung = tocAlsText(
			alle
				.filter((e) => e.kind === 'chapter' && e.parentId === fach.id)
				.map((k) => ({
					title: k.title,
					themen: alle.filter((t) => t.kind === 'topic' && t.parentId === k.id).map((t) => t.title)
				}))
		);

		let ergebnis;
		try {
			ergebnis = await leseGetipptes({ text, fach: fach.title, kapitel: kapitel.title, gliederung });
		} catch (e) {
			if (e instanceof KeinSchluessel)
				return zurueck(503, 'Das Zusammenfassen geht gerade nicht. Versuch es später nochmal.');
			console.error('[schreiben] Zusammenfassen fehlgeschlagen:', e);
			const body = (e as { responseBody?: unknown }).responseBody;
			if (body) console.error('[schreiben] Antwort:', String(body).slice(0, 800));
			return zurueck(502, 'Ich konnte deinen Text gerade nicht zusammenfassen. Versuch es nochmal.');
		}

		if (!ergebnis.verstanden)
			return zurueck(
				422,
				ergebnis.hinweis ||
					'Daraus werde ich noch nicht schlau. Schreib in ganzen Sätzen, worum es geht.'
			);

		// Der Titel des Kindes gewinnt. Der Vorschlag der KI greift nur, wenn keiner da ist.
		const themaTitel = titel || ergebnis.thema.trim() || 'Ohne Titel';

		if (note) {
			await db
				.update(notes)
				.set({
					transcript: text,
					summary: ergebnis.zusammenfassung,
					keywords: ergebnis.begriffe.join(', '),
					updatedAt: new Date()
				})
				.where(eq(notes.id, note.id));
			await db
				.update(tocEntries)
				.set({ title: themaTitel })
				.where(eq(tocEntries.id, note.topicId!));
			throw redirect(303, `/schueler/thema/${note.topicId}`);
		}

		const [thema] = await db
			.insert(tocEntries)
			.values({ studentId, kind: 'topic', title: themaTitel, parentId: kapitel.id })
			.returning({ id: tocEntries.id });

		await db.insert(notes).values({
			studentId,
			topicId: thema.id,
			herkunft: 'selbst',
			transcript: text,
			summary: ergebnis.zusammenfassung,
			keywords: ergebnis.begriffe.join(', ')
		});

		await einsortieren(studentId, kapitel.id, [thema.id], String(fd.get('nach') ?? ''));
		throw redirect(303, `/schueler/thema/${thema.id}`);
	}
};
