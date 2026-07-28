// Bildablage. Standard im Echt-Betrieb: nicht speichern.
// Gespeichert wird nur, wenn das Kind seine Fotos behalten möchte
// (oder im Entwicklungsmodus, damit Transkripte gegen das Original geprüft werden können).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

const ORDNER = env.UPLOAD_DIR ?? './data/uploads';

export function darfSpeichern(kindBehaeltFotos: boolean): boolean {
	return kindBehaeltFotos || dev;
}

export async function legeSeiteAb(
	noteId: string,
	seite: number,
	daten: Uint8Array,
	mimeType: string
): Promise<string> {
	const ziel = join(ORDNER, noteId);
	await mkdir(ziel, { recursive: true });
	const endung = mimeType.includes('png') ? 'png' : mimeType.includes('pdf') ? 'pdf' : 'jpg';
	const name = `${seite}.${endung}`;
	await writeFile(join(ziel, name), daten);
	return `${noteId}/${name}`;
}
