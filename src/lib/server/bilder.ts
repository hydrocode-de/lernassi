// Bildablage. Standard im Echt-Betrieb: nicht speichern.
// Gespeichert wird nur, wenn das Kind seine Fotos behalten möchte
// (oder im Entwicklungsmodus, damit Transkripte gegen das Original geprüft werden können).

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
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

/** Entfernt die abgelegten Seiten einer verworfenen Aufnahme. */
export async function entferneAufnahmeBilder(uploadId: string): Promise<void> {
	await rm(join(ORDNER, uploadId), { recursive: true, force: true });
}

/** Fingerabdruck einer Seite — erkennt, ob dieselbe Datei schon einmal hochgeladen wurde. */
export function fingerabdruck(daten: Uint8Array): string {
	return createHash('sha256').update(daten).digest('hex');
}

const TYPEN: Record<string, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	pdf: 'application/pdf'
};

/** Liest eine abgelegte Seite. Der Verweis kommt aus der Datenbank, nie aus der URL. */
export async function holeSeite(imageRef: string): Promise<{ daten: Buffer; typ: string } | null> {
	// Sicherheitsnetz, falls je ein Verweis mit ".." in die Datenbank geriete.
	const sauber = normalize(imageRef);
	if (sauber.startsWith('..') || sauber.startsWith('/')) return null;
	try {
		const daten = await readFile(join(ORDNER, sauber));
		const endung = sauber.split('.').pop()?.toLowerCase() ?? '';
		return { daten, typ: TYPEN[endung] ?? 'application/octet-stream' };
	} catch {
		return null;
	}
}
