// Roh-Mitschrieb der Agenten-Aufrufe: bleibt auf dem Gerät des Kindes, nicht in der
// zentralen Datenbank. Geschrieben wird erst nach Rundenende — vorher lägen die Lösungen
// der offenen Fragen im Browser.
//
// Beim lokalen Entwickeln ist das die einzige Stelle, an der man sieht, was die Agenten
// wirklich bekommen und antworten. Im Piloten ist es standardmäßig an und umschaltbar.

const SCHLUESSEL = 'lernassi.mitschrieb';
const EINSTELLUNG = 'lernassi.mitschrieb.einstellung';

export type MitschriebEintrag = {
	agent: string;
	modell: string;
	wann: number;
	system: string;
	eingabe: string;
	antwort: unknown;
};

export type MitschriebRunde = {
	roundId: string;
	kapitel: string;
	wann: number;
	aufrufe: MitschriebEintrag[];
};

export type Einstellung = { an: boolean; tage: number };

export const TAGE_OPTIONEN = [1, 7, 30, 0] as const; // 0 = ohne Ablauf
const STANDARD: Einstellung = { an: true, tage: 7 };

export function einstellungLesen(): Einstellung {
	if (typeof localStorage === 'undefined') return STANDARD;
	try {
		const roh = localStorage.getItem(EINSTELLUNG);
		if (!roh) return STANDARD;
		const e = JSON.parse(roh) as Partial<Einstellung>;
		return { an: e.an ?? STANDARD.an, tage: e.tage ?? STANDARD.tage };
	} catch {
		return STANDARD;
	}
}

export function einstellungSchreiben(e: Einstellung): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(EINSTELLUNG, JSON.stringify(e));
	if (!e.an) alleLoeschen();
	else aufraeumen();
}

export function alleLesen(): MitschriebRunde[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const roh = localStorage.getItem(SCHLUESSEL);
		return roh ? (JSON.parse(roh) as MitschriebRunde[]) : [];
	} catch {
		return [];
	}
}

export function alleLoeschen(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(SCHLUESSEL);
}

/** Wirft weg, was älter ist als die eingestellte Frist. */
export function aufraeumen(): void {
	const { tage } = einstellungLesen();
	if (!tage) return;
	const grenze = Date.now() - tage * 86_400_000;
	const bleibt = alleLesen().filter((r) => r.wann >= grenze);
	schreiben(bleibt);
}

function schreiben(runden: MitschriebRunde[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SCHLUESSEL, JSON.stringify(runden));
	} catch {
		// Speicher voll: die ältesten Runden fliegen raus, statt gar nichts zu speichern.
		if (runden.length > 1) schreiben(runden.slice(1));
	}
}

export function rundeAblegen(runde: MitschriebRunde): void {
	if (!einstellungLesen().an || !runde.aufrufe.length) return;
	const alle = alleLesen().filter((r) => r.roundId !== runde.roundId);
	alle.push(runde);
	schreiben(alle);
	aufraeumen();
}
