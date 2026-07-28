// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				role: string;
				name?: string | null;
				email?: string | null;
				username?: string | null;
				displayUsername?: string | null;
			} | null;
			session: { id: string; userId: string } | null;
		}
	}
}

export {};
