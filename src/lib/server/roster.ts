// Pseudonym- und Join-Code-Generierung.
// Validator von Better Auth erlaubt nur [a-zA-Z0-9_.] → Unterstriche, keine Bindestriche.

const ADJEKTIVE = [
	'mutig', 'flink', 'klug', 'ruhig', 'froh', 'stark', 'sanft', 'wach', 'keck', 'edel',
	'fein', 'frei', 'warm', 'hell', 'kuehn', 'weise', 'munter', 'tapfer', 'heiter', 'emsig'
];
const TIERE = [
	'tiger', 'otter', 'fuchs', 'luchs', 'dachs', 'biber', 'falke', 'reiher', 'igel', 'marder',
	'kranich', 'wolf', 'hirsch', 'specht', 'uhu', 'krebs', 'molch', 'panda', 'koala', 'delfin'
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** z. B. "mutig_tiger_42" */
export function makePseudonym(): string {
	return `${pick(ADJEKTIVE)}_${pick(TIERE)}_${10 + Math.floor(Math.random() * 90)}`;
}

/** 6 gut lesbare Großbuchstaben/Ziffern (ohne verwechselbare Zeichen) */
export function makeJoinCode(): string {
	const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	let s = '';
	for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
	return s;
}
