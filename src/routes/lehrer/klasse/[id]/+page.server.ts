import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { classes, learningGoals, pseudonyms, students, user, account } from '$lib/server/db/schema';
import { makePseudonym } from '$lib/server/roster';
import { ZIEL_WARNSCHWELLE } from '$lib/lernziel';
import { KATEGORIEN, skalaLesen, skalaSchreiben } from '$lib/kategorie';
import { istQuellenId, QUELLEN, quellenAus } from '$lib/server/recherche';
import { env } from '$env/dynamic/private';
import { klassenblick } from '$lib/server/fortschritt';
import { ownedClass } from '$lib/server/lehrer';
import { and, eq, desc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function str(v: FormDataEntryValue | null): string | null {
	const s = String(v ?? '').trim();
	return s.length ? s : null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const cls = await ownedClass(locals, params.id);
	const ziel = (
		await db.select().from(learningGoals).where(eq(learningGoals.classId, cls.id))
	)[0] ?? null;
	const ps = await db
		.select()
		.from(pseudonyms)
		.where(eq(pseudonyms.classId, cls.id))
		.orderBy(desc(pseudonyms.createdAt));

	// Die Klassenliste. Ein Kind im Einzelnen ist eine eigene Seite — kein Aufklappen.
	const skala = skalaLesen(cls.masteryScale);
	const kinder = await klassenblick(cls.id, skala);

	// Am eingelösten Zugang steht, wer ihn genommen hat — sonst weiß die Lehrkraft beim
	// Zurücksetzen des Passworts nicht, wessen Passwort sie zurücksetzt.
	const namen = new Map(kinder.map((k) => [k.id, k.name] as const));

	return {
		zurueck: { href: '/lehrer', text: 'Meine Klassen' },
		cls,
		ziel,
		pseudonyms: ps.map((p) => ({ ...p, name: p.userId ? (namen.get(p.userId) ?? null) : null })),
		warnschwelle: ZIEL_WARNSCHWELLE,
		// Der Zweig ist in Erprobung: ohne RECHERCHE=1 gibt es die Einstellung gar nicht.
		rechercheMoeglich: env.RECHERCHE === '1',
		quellen: QUELLEN.map((q) => ({
			id: q.id,
			label: q.label,
			wofuer: q.wofuer,
			an: quellenAus(cls.rechercheQuellen).some((f) => f.id === q.id)
		})),
		skala,
		kategorien: KATEGORIEN,
		kinder
	};
};

export const actions: Actions = {
	// Nachlesen freigeben und festlegen, wo lernassi lesen darf. Beides an der Klasse: ob
	// nachgeschlagen werden soll, ist eine Entscheidung über den Unterricht.
	speichereRecherche: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const an = fd.get('an') === '1';
		const gewaehlt = fd
			.getAll('quelle')
			.map((q) => String(q))
			.filter(istQuellenId);

		await db
			.update(classes)
			.set({ recherche: an, rechercheQuellen: JSON.stringify(gewaehlt) })
			.where(eq(classes.id, cls.id));

		return {
			ok: an
				? gewaehlt.length
					? 'Nachlesen ist an.'
					: 'Nachlesen ist an, aber keine Quelle ausgewählt — so findet lernassi nichts.'
				: 'Nachlesen ist aus.'
		};
	},

	// Ein Lernziel je Klasse, fortgeschrieben statt ergänzt.
	speichereZiel: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const text = String(fd.get('text') ?? '').trim();
		if (!text) return fail(400, { message: 'Bitte das Lernziel eintragen.' });

		const vorhanden = (
			await db.select().from(learningGoals).where(eq(learningGoals.classId, cls.id))
		)[0];

		if (vorhanden) {
			await db
				.update(learningGoals)
				.set({ description: text, updatedAt: new Date() })
				.where(eq(learningGoals.id, vorhanden.id));
		} else {
			await db
				.insert(learningGoals)
				.values({ classId: cls.id, description: text, updatedAt: new Date() });
		}

		return {
			ok: 'Lernziel gespeichert.',
			// Warnen, nicht blockieren: zu viel Kontext verwässert die Fragenauswahl.
			warnung:
				text.length > ZIEL_WARNSCHWELLE
					? `Das Lernziel ist mit ${text.length} Zeichen sehr lang. Je knapper die Kompetenzen ` +
						'formuliert sind, desto gezielter wählt lernassi die Fragen aus.'
					: null
		};
	},

	// Name, Klasse und Fach. Das Fach steuert, welcher Zweig im Heft eines Kindes zu dieser
	// Klasse gehört — es umzubenennen trennt die Klasse von den Aufschrieben. Darum nur hier,
	// bewusst, und nicht nebenbei.
	speichereKlasse: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const name = str(fd.get('name'));
		const grade = str(fd.get('grade'));
		const subject = str(fd.get('subject'));
		if (!name) return fail(400, { message: 'Bitte einen Namen angeben.' });
		if (!subject) return fail(400, { message: 'Bitte das Fach angeben.' });

		await db
			.update(classes)
			.set({ name, grade: grade ?? '', subject })
			.where(eq(classes.id, cls.id));
		return { ok: 'Gespeichert.' };
	},

	// Die Grenzen der Skala. Sie wirken RÜCKWIRKEND auf alle Kinder der Klasse — es wird nichts
	// nachgerechnet, weil nur rohe Punkte gespeichert sind und das Wort immer neu entsteht.
	speichereSkala: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const zahlen = ['eins', 'zwei', 'drei'].map((f) => Number(fd.get(f)));
		if (zahlen.some((z) => !Number.isFinite(z) || z < 1 || z > 100))
			return fail(400, { message: 'Bitte drei Grenzen zwischen 1 und 100 angeben.' });
		if (!(zahlen[0] > zahlen[1] && zahlen[1] > zahlen[2]))
			return fail(400, {
				message: 'Die Grenzen müssen fallen: „sitzt" höher als „fast sicher", das höher als „wackelt".'
			});

		await db
			.update(classes)
			.set({
				masteryScale: skalaSchreiben([{ ab: zahlen[0] }, { ab: zahlen[1] }, { ab: zahlen[2] }])
			})
			.where(eq(classes.id, cls.id));
		return {
			ok: `Grenzen gespeichert: sitzt ab ${zahlen[0]} %, fast sicher ab ${zahlen[1]} %, wackelt ab ${zahlen[2]} %.`
		};
	},

	generatePseudonyms: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const count = Math.min(40, Math.max(1, parseInt(String(fd.get('count') ?? '0'), 10) || 0));
		if (!count) return fail(400, { message: 'Bitte eine Anzahl zwischen 1 und 40 angeben.' });
		let created = 0;
		for (let i = 0; i < count; i++) {
			for (let tries = 0; tries < 8; tries++) {
				const value = makePseudonym();
				const dupPs = await db.select().from(pseudonyms).where(eq(pseudonyms.value, value));
				const dupUser = await db.select().from(user).where(eq(user.username, value));
				if (dupPs.length === 0 && dupUser.length === 0) {
					await db.insert(pseudonyms).values({ classId: cls.id, value });
					created++;
					break;
				}
			}
		}
		return { ok: `${created} Pseudonyme erzeugt.` };
	},

	resetPassword: async ({ params, locals, request }) => {
		const cls = await ownedClass(locals, params.id);
		const fd = await request.formData();
		const userId = String(fd.get('userId') ?? '');
		const newPassword = String(fd.get('newPassword') ?? '');
		if (newPassword.length < 6) return fail(400, { message: 'Neues Passwort zu kurz (min. 6 Zeichen).' });
		const st = (
			await db
				.select()
				.from(students)
				.where(and(eq(students.userId, userId), eq(students.classId, cls.id)))
		)[0];
		if (!st) return fail(400, { message: 'Schüler:in gehört nicht zu dieser Klasse.' });
		const ctx = await auth.$context;
		const hash = await ctx.password.hash(newPassword);
		await db
			.update(account)
			.set({ password: hash })
			.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
		return { ok: 'Passwort zurückgesetzt.' };
	}
};
