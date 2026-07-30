// Die vier Wörter, mit denen über Lernstand gesprochen wird — dieselbe Funktion für Kind und
// Lehrkraft, damit im Verzeichnis nichts anderes steht als im Dashboard.
//
// Gespeichert wird NIE das Wort, nur erreichte und mögliche Punkte. Das Wort entsteht hier,
// bei der Anzeige. Verschiebt die Lehrkraft die Grenzen, ändern sich alle Wörter der Klasse
// sofort mit — ohne dass etwas nachgerechnet werden muss.

export type Kategorie = 1 | 2 | 3 | 4;

/** Eine Grenze der Skala: ab diesem Prozentwert gilt diese Kategorie. */
export type Stufe = { ab: number };

/** Was mit der Karte passiert, wenn eine Übung in dieser Kategorie endet. */
export type Folge = 'abhaken' | 'hinten' | 'mitte' | 'zweite-stelle';

/** Die vier Statusfarben des Design-Systems, in derselben Reihenfolge wie die Wörter. */
export type Farbe = 'mint' | 'sky' | 'apricot' | 'rose';

export const KATEGORIEN: Record<Kategorie, { wort: string; folge: Folge; farbe: Farbe }> = {
	1: { wort: 'sitzt', folge: 'abhaken', farbe: 'mint' },
	2: { wort: 'fast sicher', folge: 'hinten', farbe: 'sky' },
	3: { wort: 'wackelt', folge: 'mitte', farbe: 'apricot' },
	4: { wort: 'noch nicht', folge: 'zweite-stelle', farbe: 'rose' }
};

/** Standardgrenzen, wenn eine Klasse keine eigenen hinterlegt hat. */
export const STANDARD_SKALA: [Stufe, Stufe, Stufe] = [{ ab: 90 }, { ab: 70 }, { ab: 40 }];

/** Liest die Skala einer Klasse aus dem JSON-Feld. Kaputtes oder fehlendes JSON fällt auf den
 *  Standard zurück — eine Klasse ohne lesbare Skala soll nicht ohne Wörter dastehen. */
export function skalaLesen(json: string | null | undefined): [Stufe, Stufe, Stufe] {
	if (!json) return STANDARD_SKALA;
	try {
		const rohe = JSON.parse(json);
		if (!Array.isArray(rohe) || rohe.length !== 3) return STANDARD_SKALA;
		const stufen = rohe.map((s) => ({ ab: Number(s?.ab) }));
		if (stufen.some((s) => !Number.isFinite(s.ab) || s.ab < 0 || s.ab > 100))
			return STANDARD_SKALA;
		// Muss absteigend sein, sonst wäre die Zuordnung nicht eindeutig.
		if (!(stufen[0].ab > stufen[1].ab && stufen[1].ab > stufen[2].ab)) return STANDARD_SKALA;
		return stufen as [Stufe, Stufe, Stufe];
	} catch {
		return STANDARD_SKALA;
	}
}

export function skalaSchreiben(stufen: [Stufe, Stufe, Stufe]): string {
	return JSON.stringify(stufen);
}

/** Prozentwert aus Punkten. Ohne mögliche Punkte gibt es keinen Wert. */
export function wertAus(erreicht: number, moeglich: number): number | null {
	if (!moeglich) return null;
	return Math.round((erreicht / moeglich) * 100);
}

export function kategorieAus(wert: number, skala: [Stufe, Stufe, Stufe]): Kategorie {
	if (wert >= skala[0].ab) return 1;
	if (wert >= skala[1].ab) return 2;
	if (wert >= skala[2].ab) return 3;
	return 4;
}

/** Der ganze Weg von Punkten zum Wort. null, wenn es nichts zu sagen gibt — ein Thema ohne
 *  Übung bekommt kein graues Wort, sondern gar keins. */
export function standAus(
	erreicht: number,
	moeglich: number,
	skala: [Stufe, Stufe, Stufe]
): { wert: number; kategorie: Kategorie; wort: string; folge: Folge; farbe: string } | null {
	const wert = wertAus(erreicht, moeglich);
	if (wert === null) return null;
	const kategorie = kategorieAus(wert, skala);
	return { wert, kategorie, ...KATEGORIEN[kategorie] };
}
