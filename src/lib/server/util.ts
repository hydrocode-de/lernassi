export function errMsg(e: unknown, fallback: string): string {
	if (e && typeof e === 'object') {
		const any = e as { body?: { message?: string }; message?: string };
		return any.body?.message ?? any.message ?? fallback;
	}
	return fallback;
}
