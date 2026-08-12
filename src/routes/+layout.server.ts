import { istStaging } from '$lib/server/umgebung';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return { user: locals.user, staging: istStaging() };
};
