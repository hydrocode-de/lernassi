import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { db } from './db';
import * as schema from './db/schema';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		usePlural: false,
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL ?? 'http://localhost:5173',
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 6
	},
	user: {
		additionalFields: {
			// Serverseitig gesetzt (teacher bei Lehrer-Signup, sonst student). Kein User-Input.
			role: { type: 'string', required: false, defaultValue: 'student', input: false }
		}
	},
	// sveltekitCookies muss zuletzt stehen (setzt Cookies bei server-seitigen auth.api-Aufrufen).
	plugins: [username(), sveltekitCookies(getRequestEvent)]
});

export type Auth = typeof auth;
