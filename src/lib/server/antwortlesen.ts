// Eine Modellantwort lesen, die nicht ganz aufs Schema passt.
//
// Warum das nötig ist: die Modell-Routen widersprechen sich, und zwar unauflösbar auf der
// Schema-Seite.
//
//   Azure  verlangt, dass JEDER Schlüssel in "required" steht — ein optionaler Schlüssel lässt
//          die Anfrage schon am Schema scheitern, nicht erst an der Antwort. Darum steht
//          überall `nullable()` und nicht `optional()` (siehe auch ingest.ts).
//   Bedrock hält sich daran nicht: der Weg dorthin landet bei Tool-Aufrufen, und dort fehlen
//          Schlüssel, in denen nichts steht. Gesehen: `luecke` fehlt ganz, `partner` fehlt ganz,
//          und einmal der ganze Rumpf noch einmal in einen Fremdschlüssel gewickelt.
//
// Das Schema muss also streng bleiben (sonst bricht Azure), und die Nachsicht muss beim Prüfen
// der Antwort sitzen. Sonst wirft eine fertig geschriebene Fragenwelle weg, wem nur ein leeres
// Feld fehlt — und ohne Fragen bleibt die Einordnung stehen und der Lernplan leer.
//
// Steht bewusst getrennt von lernen.ts: hier hängt nichts an Umgebung oder Netz, das lässt
// sich für sich prüfen.

import type { z } from 'zod';

export function leseWert(wert: unknown, pfad: readonly PropertyKey[]): unknown {
	let hier: unknown = wert;
	for (const stufe of pfad) {
		if (hier === null || typeof hier !== 'object') return undefined;
		hier = (hier as Record<PropertyKey, unknown>)[stufe];
	}
	return hier;
}

export function setzeWert(wert: unknown, pfad: readonly PropertyKey[], neu: unknown): void {
	if (!pfad.length) return;
	const eltern = leseWert(wert, pfad.slice(0, -1));
	if (eltern === null || typeof eltern !== 'object') return;
	(eltern as Record<PropertyKey, unknown>)[pfad[pfad.length - 1]] = neu;
}

/** Was ein fehlender Schlüssel bedeutet, hängt davon ab, was dort stehen sollte: bei einer Liste
 *  „nichts drin" (`partner` und `richtig` sind genau dafür da), sonst „nichts gesetzt". Ein Feld,
 *  das weder leer noch null sein darf — ein Fragetext etwa —, lässt sich so nicht füllen; dann
 *  fällt der Kandidat durch und der ursprüngliche Fehler fliegt weiter. Erfunden wird nichts. */
function fuellwert(erwartet: unknown): unknown {
	return erwartet === 'array' ? [] : null;
}

/** Fehlende Schlüssel nachtragen, solange das dem Schema hilft. */
export function fuelleUndPruefe<T>(schema: z.ZodType<T>, kandidat: unknown): T | null {
	// Eine Runde je Verschachtelungstiefe: erst der Rumpf, dann die Einträge darin.
	for (let runde = 0; runde < 6; runde++) {
		const ergebnis = schema.safeParse(kandidat);
		if (ergebnis.success) return ergebnis.data;
		const fehlend = ergebnis.error.issues.filter(
			(f) => f.path.length > 0 && leseWert(kandidat, f.path) === undefined
		);
		if (!fehlend.length) return null;
		for (const f of fehlend) {
			setzeWert(kandidat, f.path, fuellwert((f as { expected?: unknown }).expected));
		}
	}
	return null;
}

/**
 * Letzte Rettung für eine Antwort, die am Schema gescheitert ist: den Rohtext selbst lesen, eine
 * etwaige Fremdverpackung abziehen und fehlende leere Felder nachtragen. Gibt null zurück, wenn
 * wirklich nichts Brauchbares drinsteht — dann soll der ursprüngliche Fehler weiterfliegen.
 */
export function ausRohtext<T>(schema: z.ZodType<T>, roh: string | undefined): T | null {
	if (!roh) return null;
	let geparst: unknown;
	try {
		geparst = JSON.parse(roh);
	} catch {
		return null;
	}

	// Die Verpackung MUSS vor dem Nachtragen abgezogen werden, sonst richtet das Nachtragen
	// Schaden an: bei einem gewickelten Rumpf fehlt oben `fragen`, und ein nachgetragenes
	// leeres `fragen: []` erfüllt das Schema — die echten Fragen daneben wären still
	// verschwunden. Lieber gar keine Rettung als eine stille leere.
	const kandidat = ausgepackt(schema, geparst);
	return fuelleUndPruefe(schema, structuredClone(kandidat));
}

/** Steckt alles in genau einem Schlüssel, den das Schema NICHT kennt, ist das eine Verpackung
 *  und der Inhalt ist die eigentliche Antwort. Welche Schlüssel das Schema erwartet, sagt es
 *  selbst: eine Prüfung des leeren Objekts nennt genau die, die oben fehlen. */
function ausgepackt<T>(schema: z.ZodType<T>, geparst: unknown): unknown {
	if (!geparst || typeof geparst !== 'object' || Array.isArray(geparst)) return geparst;
	const schluessel = Object.keys(geparst);
	if (schluessel.length !== 1) return geparst;

	const leer = schema.safeParse({});
	if (leer.success) return geparst;
	const erwartet = new Set(
		leer.error.issues.filter((f) => f.path.length === 1).map((f) => String(f.path[0]))
	);
	if (!erwartet.size || erwartet.has(schluessel[0])) return geparst;

	const innen = (geparst as Record<string, unknown>)[schluessel[0]];
	return innen && typeof innen === 'object' ? innen : geparst;
}
