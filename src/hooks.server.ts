import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = (session?.user as App.Locals['user']) ?? null;
	event.locals.session = (session?.session as App.Locals['session']) ?? null;

	return svelteKitHandler({ event, resolve, auth, building });
};
