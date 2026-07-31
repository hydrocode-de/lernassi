import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Wer angemeldet ist, landet direkt in seinem Bereich; alle anderen sehen die Startseite.
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role === 'student') throw redirect(303, '/schueler');
	if (locals.user?.role === 'teacher') throw redirect(303, '/lehrer');
};
