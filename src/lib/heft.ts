/** Farbtöne der Fächer — der Reihe nach vergeben, damit benachbarte Fächer sich unterscheiden. */
const TOENE = ['sky', 'lavender', 'mint', 'apricot', 'rose'] as const;

export function fachTon(index: number): (typeof TOENE)[number] {
	return TOENE[index % TOENE.length];
}

export function vorZeit(datum: Date | number): string {
	const d = typeof datum === 'number' ? new Date(datum) : datum;
	const tage = Math.floor((Date.now() - d.getTime()) / 86_400_000);
	if (tage <= 0) return 'heute';
	if (tage === 1) return 'gestern';
	if (tage < 7) return `vor ${tage} Tagen`;
	if (tage < 14) return 'vor 1 Woche';
	if (tage < 31) return `vor ${Math.floor(tage / 7)} Wochen`;
	if (tage < 61) return 'vor 1 Monat';
	return `vor ${Math.floor(tage / 30)} Monaten`;
}

/** Kürzel fürs Konto-Zeichen: die ersten Buchstaben der Pseudonym-Teile, z. B. „blaufuchs42" → „bf". */
export function initialen(pseudonym: string | null | undefined): string {
	const teile = (pseudonym ?? '').split(/[^a-zA-ZäöüÄÖÜß]+/).filter(Boolean);
	if (!teile.length) return '?';
	return (teile[0][0] + (teile[1]?.[0] ?? teile[0][1] ?? '')).toLowerCase();
}

export function seitenLabel(n: number): string {
	if (n === 0) return 'Noch keine Seite';
	return n === 1 ? '1 Seite' : `${n} Seiten`;
}
