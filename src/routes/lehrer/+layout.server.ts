import { db } from '$lib/server/db';
import { classes } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const lehrkraft = locals.user?.role === 'teacher' ? locals.user : null;
	if (!lehrkraft) return { user: null, klassen: [] };

	// Die Klassen trägt die Seitenleiste auf jeder Seite, darum hier statt in der Route.
	const klassen = await db
		.select({ id: classes.id, name: classes.name, subject: classes.subject })
		.from(classes)
		.where(eq(classes.teacherId, lehrkraft.id))
		.orderBy(desc(classes.createdAt));

	return { user: lehrkraft, klassen };
};
