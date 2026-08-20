// Zeigt, welche Konten es in einer Instanz gibt, und setzt einzelne Passwörter neu.
// Gedacht für die Server-Instanzen, wo seed.mjs nichts zu suchen hat (das legt die
// Testklasse neu an und löscht dabei).
//
//   node scripts/passwort.mjs                        Konten auflisten
//   node scripts/passwort.mjs t@test.de              neues Passwort auswürfeln
//   node scripts/passwort.mjs t@test.de geheim123    Passwort selbst vorgeben
//
// Angemeldet wird bei Kindern mit dem Pseudonym, bei Lehrkräften mit der E-Mail —
// beides wird hier als Kennung akzeptiert.

import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';

const dbUrl = process.env.DATABASE_URL ?? './local.db';
const [kennung, vorgabe] = process.argv.slice(2);

const db = new Database(dbUrl);
db.pragma('foreign_keys = ON');

const jetzt = Math.floor(Date.now() / 1000);
const neueId = () =>
	[...crypto.getRandomValues(new Uint8Array(24))]
		.map((b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62])
		.join('');

if (!kennung) {
	const konten = db
		.prepare(
			`select u.role, u.username, u.email, u.name, u.first_name,
			        (select count(*) from account a
			          where a.user_id = u.id and a.provider_id = 'credential') as hat_passwort
			   from user u order by u.role desc, u.created_at`
		)
		.all();
	if (!konten.length) {
		console.log(`Keine Konten in ${dbUrl}.`);
		process.exit(0);
	}
	console.log(`Konten in ${dbUrl}:\n`);
	for (const k of konten) {
		const rolle = k.role === 'teacher' ? 'Lehrkraft' : 'Kind';
		const anmeldung = k.role === 'teacher' ? k.email : k.username;
		const rufname = k.first_name ?? k.name ?? '';
		const ohne = k.hat_passwort ? '' : '  (kein Passwort gesetzt)';
		console.log(`  ${rolle.padEnd(10)} ${String(anmeldung).padEnd(24)} ${rufname}${ohne}`);
	}
	console.log('\nPasswort neu setzen: node scripts/passwort.mjs <Kennung> [neues Passwort]');
	process.exit(0);
}

const nutzer = db
	.prepare('select id, role, username, email, name, first_name from user where username = ? or email = ?')
	.get(kennung, kennung);

if (!nutzer) {
	console.error(`Kein Konto mit der Kennung "${kennung}" in ${dbUrl}.`);
	console.error('Ohne Argument aufrufen, um alle Kennungen zu sehen.');
	process.exit(1);
}

// Ausgewürfelt, wenn nichts vorgegeben ist: einmal ablesen, eintippen, danach
// von der Lehrkraft selbst ändern. Keine Zeichen, die man verwechseln kann.
const wuerfeln = () => {
	const zeichen = 'abcdefghjkmnpqrstuvwxyz23456789';
	return [...crypto.getRandomValues(new Uint8Array(10))].map((b) => zeichen[b % zeichen.length]).join('');
};

const passwort = vorgabe ?? wuerfeln();
if (passwort.length < 6) {
	console.error('Das Passwort braucht mindestens 6 Zeichen (so wie in der App).');
	process.exit(1);
}

const hash = await hashPassword(passwort);
const konto = db
	.prepare(`select id from account where user_id = ? and provider_id = 'credential'`)
	.get(nutzer.id);

if (konto) {
	db.prepare('update account set password = ?, updated_at = ? where id = ?').run(hash, jetzt, konto.id);
} else {
	db.prepare(
		`insert into account (id, user_id, account_id, provider_id, password, created_at, updated_at)
		 values (?, ?, ?, 'credential', ?, ?, ?)`
	).run(neueId(), nutzer.id, nutzer.id, hash, jetzt, jetzt);
}

// Angemeldete Sitzungen bleiben sonst gültig — wer das Passwort zurücksetzt, will
// in der Regel genau das nicht.
const raus = db.prepare('delete from session where user_id = ?').run(nutzer.id);

const rolle = nutzer.role === 'teacher' ? 'Lehrkraft' : 'Kind';
const anmeldung = nutzer.role === 'teacher' ? nutzer.email : nutzer.username;
console.log(`${rolle} ${nutzer.first_name ?? nutzer.name ?? ''} (${anmeldung})`);
console.log(`Neues Passwort: ${passwort}`);
if (raus.changes) console.log(`Abgemeldet: ${raus.changes} offene Sitzung(en) verworfen.`);
