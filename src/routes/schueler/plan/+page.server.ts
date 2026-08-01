// Der Lernplan: die Warteschlange der Lernkarten, angezeigt nach Fach gruppiert. Hier kann das
// Kind ansehen, üben, manuell abhaken — auch für extern Geübtes — oder verwerfen.
//
// Sortiert wird nach der Reihe (`position`), nicht nach dem Termin: der Termin klemmt nur das
// Einsortieren und löst den Vorschlag zum Umsortieren aus.

import { db } from '$lib/server/db';
import { planItems, tocEntries } from '$lib/server/db/schema';
import {
	nachVorneHolen,
	offeneKarten,
	reiheNachziehen,
	umsortierenVorschlagen
} from '$lib/server/warteschlange';
import { and, eq, inArray } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { gespraechAn } from '$lib/server/gespraech';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/anmelden');
	const studentId = locals.user.id;

	// Karten aus der Zeit vor der Reihe bekommen hier ihre Positionen.
	await reiheNachziehen(studentId);

	const punkte = await db.select().from(planItems).where(eq(planItems.studentId, studentId));
	const ids = [
		...new Set(punkte.flatMap((p) => [p.subjectId, p.chapterId].filter((x): x is string => !!x)))
	];
	const titel = new Map(
		ids.length
			? (await db.select().from(tocEntries).where(inArray(tocEntries.id, ids))).map((t) => [
					t.id,
					t.title
				])
			: []
	);

	// Nach Fach gruppieren; offene zuerst in ihrer Reihenfolge, erledigte und weggelegte danach.
	const faecher = [...new Set(punkte.map((p) => p.subjectId))]
		.map((fachId) => ({
			id: fachId,
			title: titel.get(fachId) ?? 'Fach',
			punkte: punkte
				.filter((p) => p.subjectId === fachId)
				.map((p) => ({
					id: p.id,
					auftrag: p.auftrag,
					minutes: p.minutes,
					dueAt: p.dueAt?.getTime() ?? null,
					status: p.status,
					position: p.position,
					kapitel: p.chapterId ? (titel.get(p.chapterId) ?? null) : null,
					kapitelId: p.chapterId,
					createdAt: p.createdAt.getTime()
				}))
				.sort(
					(a, b) =>
						(a.status === 'offen' ? 0 : 1) - (b.status === 'offen' ? 0 : 1) ||
						a.position - b.position ||
						b.createdAt - a.createdAt
				)
		}))
		.sort((a, b) => a.title.localeCompare(b.title, 'de'));

	const reihe = await offeneKarten(studentId);
	return {
		faecher,
		offene: reihe.length,
		naechste: reihe[0]?.id ?? null,
		vorschlag: await umsortierenVorschlagen(studentId),
		// Solange der Gesprächsmodus erprobt wird, steht er als zweiter Knopf neben dem
		// gewohnten — nicht an seiner Stelle. Vergleichen kann man nur, was nebeneinander läuft.
		gespraech: gespraechAn(env)
	};
};

async function setzeStatus(
	studentId: string,
	id: string,
	status: 'offen' | 'erledigt' | 'verworfen'
) {
	const treffer = await db
		.update(planItems)
		.set({ status, updatedAt: new Date() })
		.where(and(eq(planItems.id, id), eq(planItems.studentId, studentId)))
		.returning({ id: planItems.id });
	return treffer.length > 0;
}

export const actions: Actions = {
	abhaken: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/anmelden');
		const id = String((await request.formData()).get('id') ?? '');
		if (!(await setzeStatus(locals.user.id, id, 'erledigt')))
			return fail(400, { message: 'Diesen Punkt gibt es nicht mehr.' });
		return { ok: 'Abgehakt.' };
	},
	verwerfen: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/anmelden');
		const id = String((await request.formData()).get('id') ?? '');
		if (!(await setzeStatus(locals.user.id, id, 'verworfen')))
			return fail(400, { message: 'Diesen Punkt gibt es nicht mehr.' });
		return { ok: 'Weggelegt. Vorschlagen tue ich das nicht nochmal.' };
	},
	zurueckholen: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/anmelden');
		const id = String((await request.formData()).get('id') ?? '');
		if (!(await setzeStatus(locals.user.id, id, 'offen')))
			return fail(400, { message: 'Diesen Punkt gibt es nicht mehr.' });
		return { ok: 'Wieder offen.' };
	},
	// Ein Tippen auf den Termin-Vorschlag.
	vorziehen: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/anmelden');
		const ids = (await request.formData()).getAll('id').map(String).filter(Boolean);
		if (!ids.length) return fail(400, { message: 'Da war nichts zum Vorziehen.' });
		await nachVorneHolen(locals.user.id, ids);
		return { ok: 'Steht jetzt vorne.' };
	}
};
