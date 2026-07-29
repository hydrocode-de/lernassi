// Legt die Test-Klasse aus testing/fixtures/klasse.json komplett neu an — Konten mit
// bekanntem Passwort, Inhaltsverzeichnis, Aufschriebe und Seitenbilder.
//
//   node --env-file=.env scripts/seed.mjs
//   SEED_PASSWORD=meins node --env-file=.env scripts/seed.mjs
//   SEED_KEEP_IMAGES=1 node --env-file=.env scripts/seed.mjs   (Seitenbilder in der App sichtbar)
//
// Vorhandene Konten aus der Fixture werden vorher gelöscht (die Fremdschlüssel räumen
// Gliederung, Aufnahmen und Aufschriebe mit ab). Damit ist das Skript wiederholbar und
// taugt auch als Rücksetzpunkt, wenn Löschen und Bearbeiten dazukommen.

import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const dbUrl = process.env.DATABASE_URL ?? './local.db';
const uploadDir = resolve(process.env.UPLOAD_DIR ?? './data/uploads');
const passwort = process.env.SEED_PASSWORD ?? 'test1234';
const bilderSichtbar = process.env.SEED_KEEP_IMAGES === '1';
const fixtureDatei = resolve('./testing/fixtures/klasse.json');
const bilderVerzeichnis = resolve('./testing/fixtures/bilder');

if (!existsSync(fixtureDatei)) {
	console.error(`Keine Fixture unter ${fixtureDatei}.`);
	console.error('Erst einmalig einfrieren: node --env-file=.env scripts/fixture-export.mjs');
	process.exit(1);
}
if (passwort.length < 6) {
	console.error('SEED_PASSWORD braucht mindestens 6 Zeichen (so wie in der App).');
	process.exit(1);
}

const f = JSON.parse(readFileSync(fixtureDatei, 'utf8'));
const db = new Database(dbUrl);
db.pragma('foreign_keys = ON');

// Better Auth vergibt eigene IDs; die Domänen-Zeilen behalten ihre, damit Verweise
// untereinander (Kapitel → Thema, Aufnahme → Seite) unverändert bleiben.
const neueId = () =>
	[...crypto.getRandomValues(new Uint8Array(24))]
		.map((b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62])
		.join('');

const jetzt = Math.floor(Date.now() / 1000);
const hash = await hashPassword(passwort);
const userIdMap = new Map();

const einfuegen = (tabelle, zeilen) => {
	if (!zeilen.length) return;
	const spalten = Object.keys(zeilen[0]);
	const sql = `insert into ${tabelle} (${spalten.join(',')}) values (${spalten.map(() => '?').join(',')})`;
	const stmt = db.prepare(sql);
	for (const zeile of zeilen) stmt.run(spalten.map((s) => zeile[s]));
};

const kontoAnlegen = (vorlage) => {
	const id = neueId();
	userIdMap.set(vorlage.id, id);
	einfuegen('user', [{ ...vorlage, id, created_at: jetzt, updated_at: jetzt }]);
	einfuegen('account', [
		{
			id: neueId(),
			user_id: id,
			account_id: id,
			provider_id: 'credential',
			password: hash,
			created_at: jetzt,
			updated_at: jetzt
		}
	]);
	return id;
};

const umschreiben = (zeilen, felder) =>
	zeilen.map((zeile) => {
		const kopie = { ...zeile };
		for (const feld of felder) {
			if (kopie[feld]) kopie[feld] = userIdMap.get(kopie[feld]) ?? kopie[feld];
		}
		return kopie;
	});

const alleKonten = [f.lehrkraft, ...f.schueler].filter(Boolean);

const lauf = db.transaction(() => {
	// Aufräumen: die Konten löschen räumt über die Fremdschlüssel alles Abhängige mit ab.
	const loeschen = db.prepare('delete from user where email = ?');
	for (const konto of alleKonten) if (konto.email) loeschen.run(konto.email);
	db.prepare('delete from classes where join_code = ?').run(f.klasse.join_code);

	const lehrerId = kontoAnlegen(f.lehrkraft);
	for (const schueler of f.schueler) kontoAnlegen(schueler);

	einfuegen('classes', [{ ...f.klasse, teacher_id: lehrerId }]);
	einfuegen('pseudonyms', umschreiben(f.pseudonyme, ['user_id']));
	einfuegen('students', umschreiben(f.schuelerProfile, ['user_id']));
	einfuegen('learning_goals', f.lernziele);
	einfuegen('toc_entries', umschreiben(f.tocEintraege, ['student_id']));
	einfuegen('uploads', umschreiben(f.uploads, ['student_id']));
	einfuegen('upload_pages', f.uploadSeiten);
	einfuegen('notes', umschreiben(f.aufschriebe, ['student_id']));
	einfuegen('consents', umschreiben(f.einwilligungen, ['student_id']));

	// Ohne Einwilligung greift der Standard „Fotos nicht behalten". Eine Ansicht für
	// gespeicherte Heftseiten gibt es noch nicht — der Schalter setzt nur den Zustand,
	// damit sich die Einwilligung testen lässt, ohne ihn in der App umzulegen.
	if (bilderSichtbar) {
		const schonDa = new Set(f.einwilligungen.map((e) => userIdMap.get(e.student_id)));
		const fehlende = f.schueler
			.map((s) => userIdMap.get(s.id))
			.filter((id) => id && !schonDa.has(id));
		einfuegen(
			'consents',
			fehlende.map((id) => ({
				id: crypto.randomUUID(),
				student_id: id,
				keep_own_images: 1,
				teacher_may_view_images: 0,
				updated_at: jetzt
			}))
		);
	}
});

lauf();

// Seitenbilder zurücklegen — die Pfade in upload_pages.image_ref bleiben gültig.
let kopiert = 0;
for (const seite of f.uploadSeiten) {
	if (!seite.image_ref) continue;
	const quelle = join(bilderVerzeichnis, seite.image_ref);
	if (!existsSync(quelle)) continue;
	const ziel = join(uploadDir, seite.image_ref);
	mkdirSync(dirname(ziel), { recursive: true });
	cpSync(quelle, ziel);
	kopiert++;
}

db.close();

console.log(`Testdaten neu angelegt in ${dbUrl}`);
console.log(`  Klasse         ${f.klasse.name}, Klassencode ${f.klasse.join_code}`);
console.log(`  Lehrkraft      ${f.lehrkraft.email}`);
for (const s of f.schueler) console.log(`  Schüler:in     ${s.username}`);
console.log(`  Passwort       ${passwort}  (für alle Konten; über SEED_PASSWORD änderbar)`);
console.log(`  Aufschriebe    ${f.aufschriebe.length}, Bilder ${kopiert} zurückgelegt`);
console.log(
	bilderSichtbar
		? '  Fotos          "behalten" angeschaltet'
		: '  Fotos          Standard: nicht behalten (SEED_KEEP_IMAGES=1 schaltet es an)'
);
