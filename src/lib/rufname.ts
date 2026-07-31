// Der Rufname des Kindes. Er ist Anzeige und sonst nichts: angemeldet wird mit dem
// Pseudonym, Aufschriebe und Runden hängen am Konto. Leer heißt „kein Rufname" — dann
// steht überall wieder das Pseudonym.

export const RUFNAME_MAX = 24;

export function rufnamePruefen(eingabe: string): { wert: string | null; fehler: string | null } {
	const wert = eingabe.trim().replace(/\s+/g, ' ');
	if (!wert) return { wert: null, fehler: null };
	if (wert.length > RUFNAME_MAX)
		return { wert: null, fehler: `Das ist zu lang – höchstens ${RUFNAME_MAX} Zeichen.` };
	return { wert, fehler: null };
}
