import { db } from '$lib/server/db';
import { classes } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';

/** Die Klasse, aber nur wenn sie dieser Lehrkraft gehört. Sonst 404 wie „gibt es nicht". */
export async function ownedClass(locals: App.Locals, id: string) {
	if (!locals.user || locals.user.role !== 'teacher')
		throw redirect(303, '/anmelden?ansicht=lehrer-anmelden');
	const cls = (
		await db
			.select()
			.from(classes)
			.where(and(eq(classes.id, id), eq(classes.teacherId, locals.user.id)))
	)[0];
	if (!cls) throw error(404, 'Klasse nicht gefunden');
	return cls;
}
