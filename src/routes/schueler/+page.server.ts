import { db } from '$lib/server/db';
import { notes, tocEntries } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export type Thema = { id: string; title: string; zuletzt: number | null };
export type Kapitel = { id: string; title: string; themen: Thema[] };
export type Fach = { id: string; title: string; kapitel: Kapitel[]; anzahlThemen: number };

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'student') throw redirect(303, '/schueler/anmelden');
	const studentId = locals.user.id;

	const alle = await db.select().from(tocEntries).where(eq(tocEntries.studentId, studentId));
	const meine = await db.select().from(notes).where(eq(notes.studentId, studentId));

	// jüngster Aufschrieb pro Thema
	const zuletztJeThema = new Map<string, number>();
	for (const n of meine) {
		if (!n.topicId) continue;
		const t = n.createdAt.getTime();
		if (t > (zuletztJeThema.get(n.topicId) ?? 0)) zuletztJeThema.set(n.topicId, t);
	}

	const kinder = (parentId: string) =>
		alle
			.filter((e) => e.parentId === parentId)
			.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de'));

	const faecher: Fach[] = alle
		.filter((e) => e.kind === 'subject')
		.sort((a, b) => a.title.localeCompare(b.title, 'de'))
		.map((f) => {
			const kapitel = kinder(f.id).map((k) => ({
				id: k.id,
				title: k.title,
				// Neueste Aufschriebe oben — das Verzeichnis wächst nach vorn.
				themen: kinder(k.id)
					.map((t) => ({
						id: t.id,
						title: t.title,
						zuletzt: zuletztJeThema.get(t.id) ?? null
					}))
					.sort((a, b) => (b.zuletzt ?? 0) - (a.zuletzt ?? 0))
			}));
			return {
				id: f.id,
				title: f.title,
				kapitel,
				anzahlThemen: kapitel.reduce((s, k) => s + k.themen.length, 0)
			};
		});

	return { faecher };
};
