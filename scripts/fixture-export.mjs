// Friert den aktuellen Stand einer Klasse als Fixture ein — Konten, Inhaltsverzeichnis,
// Aufschriebe und die dazugehörigen Seitenbilder. Aus dieser Fixture legt scripts/seed.mjs
// alles wieder neu an, ohne dass etwas von Hand eingepflegt werden muss.
//
//   node --env-file=.env scripts/fixture-export.mjs [KLASSENCODE]
//
// Die Fixture landet unter testing/ — dort liegen echte Aufschriebe, das Verzeichnis ist
// bewusst gitignored und darf nicht committet werden.

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const dbUrl = process.env.DATABASE_URL ?? './local.db';
const uploadDir = resolve(process.env.UPLOAD_DIR ?? './data/uploads');
const zielVerzeichnis = resolve('./testing/fixtures');
const bilderVerzeichnis = join(zielVerzeichnis, 'bilder');

const db = new Database(dbUrl, { readonly: true });
const alle = (sql, ...args) => db.prepare(sql).all(...args);
const eine = (sql, ...args) => db.prepare(sql).get(...args);

const code = process.argv[2];
const klasse = code
	? eine('select * from classes where join_code = ?', code)
	: eine('select * from classes order by created_at limit 1');

if (!klasse) {
	console.error(code ? `Keine Klasse mit Code ${code}.` : 'Keine Klasse in der Datenbank.');
	process.exit(1);
}

const lehrkraft = eine('select * from user where id = ?', klasse.teacher_id);
const schuelerProfile = alle('select * from students where class_id = ?', klasse.id);
const schuelerIds = schuelerProfile.map((s) => s.user_id);
const platzhalter = schuelerIds.map(() => '?').join(',') || 'null';

const schuelerUser = schuelerIds.length
	? alle(`select * from user where id in (${platzhalter})`, ...schuelerIds)
	: [];

const uploads = schuelerIds.length
	? alle(`select * from uploads where student_id in (${platzhalter})`, ...schuelerIds)
	: [];
const uploadIds = uploads.map((u) => u.id);
const uploadPlatzhalter = uploadIds.map(() => '?').join(',') || 'null';

const fixture = {
	erstelltAm: new Date().toISOString(),
	klasse,
	lehrkraft,
	schueler: schuelerUser,
	schuelerProfile,
	pseudonyme: alle('select * from pseudonyms where class_id = ?', klasse.id),
	lernziele: alle('select * from learning_goals where class_id = ?', klasse.id),
	tocEintraege: schuelerIds.length
		? alle(`select * from toc_entries where student_id in (${platzhalter})`, ...schuelerIds)
		: [],
	uploads,
	uploadSeiten: uploadIds.length
		? alle(`select * from upload_pages where upload_id in (${uploadPlatzhalter})`, ...uploadIds)
		: [],
	aufschriebe: schuelerIds.length
		? alle(`select * from notes where student_id in (${platzhalter})`, ...schuelerIds)
		: [],
	einwilligungen: schuelerIds.length
		? alle(`select * from consents where student_id in (${platzhalter})`, ...schuelerIds)
		: []
};

// Seitenbilder mitnehmen, damit beim Neuanlegen nichts neu fotografiert werden muss.
rmSync(bilderVerzeichnis, { recursive: true, force: true });
let kopiert = 0;
let fehlend = 0;
for (const seite of fixture.uploadSeiten) {
	if (!seite.image_ref) continue;
	const quelle = join(uploadDir, seite.image_ref);
	const ziel = join(bilderVerzeichnis, seite.image_ref);
	try {
		mkdirSync(dirname(ziel), { recursive: true });
		cpSync(quelle, ziel);
		// Fingerabdruck aus der Datei nachtragen, damit die Doppel-Erkennung auch für
		// Seiten greift, die vor dieser Spalte aufgenommen wurden.
		if (!seite.image_hash) {
			seite.image_hash = createHash('sha256').update(readFileSync(quelle)).digest('hex');
		}
		kopiert++;
	} catch {
		console.warn(`  Bild fehlt, wird übersprungen: ${seite.image_ref}`);
		fehlend++;
	}
}

mkdirSync(zielVerzeichnis, { recursive: true });
const fixtureDatei = join(zielVerzeichnis, 'klasse.json');
writeFileSync(fixtureDatei, JSON.stringify(fixture, null, '\t'));
db.close();

console.log(`Fixture geschrieben: ${fixtureDatei}`);
console.log(`  Klasse         ${klasse.name} (${klasse.join_code})`);
console.log(`  Lehrkraft      ${lehrkraft?.email ?? '—'}`);
console.log(`  Schüler:innen  ${schuelerUser.map((s) => s.username).join(', ') || '—'}`);
console.log(`  Pseudonyme     ${fixture.pseudonyme.length}`);
console.log(`  Gliederung     ${fixture.tocEintraege.length} Einträge`);
console.log(`  Aufschriebe    ${fixture.aufschriebe.length} aus ${uploads.length} Aufnahme(n)`);
console.log(`  Bilder         ${kopiert} kopiert${fehlend ? `, ${fehlend} fehlten` : ''}`);
