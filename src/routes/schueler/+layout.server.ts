import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return { pseudonym: locals.user?.role === 'student' ? locals.user.username : null };
};
