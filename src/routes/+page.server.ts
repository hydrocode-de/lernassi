import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Ein Einstieg für beide Rollen: die Rolle wird im Formular umgeschaltet,
// eine eigene Startseite davor gibt es nicht mehr.
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role === 'student') throw redirect(303, '/schueler');
	if (locals.user?.role === 'teacher') throw redirect(303, '/lehrer');
	throw redirect(303, '/anmelden');
};
