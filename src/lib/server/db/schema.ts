import { sqliteTable, text, integer, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

const now = () => new Date();
const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());

// ─────────────────────────────────────────────────────────────
// Better Auth (Feldnamen exakt nach @better-auth/core + username-Plugin)
// ─────────────────────────────────────────────────────────────

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	// username-Plugin
	username: text('username').unique(),
	displayUsername: text('display_username'),
	// unser Zusatzfeld: 'teacher' | 'student'
	role: text('role').notNull().default('student'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(now),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(now)
});

// ─────────────────────────────────────────────────────────────
// Domäne (M1) — mitwachsend; Session/Frage/Plan/Mastery kommen M2/M3
// ─────────────────────────────────────────────────────────────

export const classes = sqliteTable('classes', {
	id: id(),
	teacherId: text('teacher_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	joinCode: text('join_code').notNull().unique(),
	// Die Grenzen, ab denen ein Prozentwert „sitzt" heißt. JSON, vier Einträge.
	// null = Standardskala aus dem Code. An der Klasse, nicht an der Lehrkraft: was in
	// Klasse 6 „sitzt" heißt, heißt in Klasse 10 nicht dasselbe.
	masteryScale: text('mastery_scale'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Dünnes Profil: verknüpft Auth-User (role=student) mit einer Klasse.
// KEIN Klarname-Feld — Zuordnung Pseudonym→Kind bleibt off-system bei der Lehrkraft.
export const students = sqliteTable('students', {
	id: id(),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	classId: text('class_id')
		.notNull()
		.references(() => classes.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Ein aktuelles Lernziel pro Klasse und Fach, von der Lehrkraft fortgeschrieben.
// Freitext (Kompetenzformulierungen, wie Lehrkräfte sie real schreiben) — bewusst NICHT
// zerlegt: es ist Kontext für die Agenten, und genau dafür ist Kontext da.
// `description` trägt diesen Freitext; `title` bleibt aus M1 und führt nur noch das Fach.
export const learningGoals = sqliteTable('learning_goals', {
	id: id(),
	classId: text('class_id')
		.notNull()
		.references(() => classes.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	contextPrompt: text('context_prompt'), // Satz für die Schüler-KI (M2)
	subject: text('subject'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// ─────────────────────────────────────────────────────────────
// Ingestion: Material aufbauen (M2)
// ─────────────────────────────────────────────────────────────

// Gliederung pro Kind: Fach → Kapitel → Thema. Wächst mit jedem Aufschrieb.
// Ein Inhaltsverzeichnis zeigt immer genau EIN Fach (Fächer werden nie gemischt).
export const tocEntries = sqliteTable('toc_entries', {
	id: id(),
	studentId: text('student_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	parentId: text('parent_id'),
	kind: text('kind').notNull(), // 'subject' | 'chapter' | 'topic'
	title: text('title').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	// Nur bei kind='chapter': wann zuletzt eine abgeschlossene Runde über dieses Kapitel lief.
	// Pro Kapitel, nicht pro Fach — sonst gelten neue Seiten in Kapitel A als eingeordnet,
	// sobald Kapitel B geübt wurde.
	lastAssessedAt: integer('last_assessed_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Eine Fotosession: die Seiten, die in einem Zug aufgenommen wurden.
// Daraus können mehrere eigenständige Aufschriebe entstehen — eine einzelne Seite
// kann schon zwei Themen tragen.
export const uploads = sqliteTable('uploads', {
	id: id(),
	studentId: text('student_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	subject: text('subject').notNull(),
	pageCount: integer('page_count').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Einzelseite der Fotosession. imageRef nur gesetzt, wenn das Bild behalten werden darf
// (Standard: nicht speichern; Testumgebung oder Einwilligung: ablegen).
export const uploadPages = sqliteTable('upload_pages', {
	id: id(),
	uploadId: text('upload_id')
		.notNull()
		.references(() => uploads.id, { onDelete: 'cascade' }),
	pageNumber: integer('page_number').notNull(),
	imageRef: text('image_ref'),
	// Fingerabdruck des Bildes. Wird immer gesetzt, auch wenn das Bild nicht abgelegt wird —
	// nur damit erkannt werden kann, dass dieselbe Heftseite schon einmal da war.
	imageHash: text('image_hash'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Ein eigenständiger Aufschrieb (ein Thema) aus einer Fotosession.
export const notes = sqliteTable('notes', {
	id: id(),
	studentId: text('student_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	uploadId: text('upload_id').references(() => uploads.id, { onDelete: 'cascade' }),
	topicId: text('topic_id').references(() => tocEntries.id, { onDelete: 'set null' }),
	transcript: text('transcript'),
	summary: text('summary'),
	keywords: text('keywords'), // kommagetrennt, für die Begriffs-Chips
	pageNumbers: text('page_numbers'), // z. B. "2,3" — welche Seiten dieses Thema betreffen
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
	// Zusammen mit dem Kapitel-Zeitstempel die Antwort auf „ist hier was Neues?".
	// Gleich createdAt = neu; später = nachträglich geändert.
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// Kind-Präferenzen (zusätzlich zur rechtlichen Elterneinwilligung).
export const consents = sqliteTable('consents', {
	id: id(),
	studentId: text('student_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	// Standard: Fotos werden NICHT behalten. Der Schalter ist noch nicht freigegeben.
	keepOwnImages: integer('keep_own_images', { mode: 'boolean' }).notNull().default(false),
	teacherMayViewImages: integer('teacher_may_view_images', { mode: 'boolean' })
		.notNull()
		.default(false),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Vergebene (reservierte) Pseudonyme pro Klasse. Die Lehrkraft generiert die Liste
// und teilt sie aus; ein Kind beansprucht beim Registrieren ein unbeanspruchtes.
// So können keine Klarnamen als Pseudonym reinrutschen.
// ─────────────────────────────────────────────────────────────
// Lern-Session: Material NUTZEN (M3)
// ─────────────────────────────────────────────────────────────

// Eine Runde. Zwei Arten: `einordnung` läuft über GENAU EIN Kapitel und füllt den Plan
// (M3), `uebung` arbeitet GENAU EINE Karte ab und räumt ihn ab (M4). Bewusst eine Tabelle:
// Fragen, Antworten, Mitschrieb und Abrechnung sind für beide dasselbe, und das Dashboard
// hätte sonst zwei Quellen zusammenzurechnen.
// Heißt nicht `session`: diesen Namen belegt Better Auth.
export const rounds = sqliteTable('rounds', {
	id: id(),
	studentId: text('student_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	kind: text('kind').notNull().default('einordnung'), // 'einordnung' | 'uebung'
	// Bei einer Übung kann die Karte fachweit sein — dann gibt es kein Kapitel.
	chapterId: text('chapter_id').references(() => tocEntries.id, { onDelete: 'cascade' }),
	// Nur bei kind='uebung': die Karte, die abgearbeitet wird. Die Rückrichtung
	// (planItems.createdInRoundId) zeigt hierher — bei sich gegenseitig referenzierenden
	// Tabellen braucht Drizzle die ausgeschriebene Spaltentype, sonst kann TypeScript den
	// Ring nicht auflösen.
	planItemId: text('plan_item_id').references((): AnySQLiteColumn => planItems.id, {
		onDelete: 'set null'
	}),
	startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
	finishedAt: integer('finished_at', { mode: 'timestamp' }),
	status: text('status').notNull().default('laufend'), // 'laufend' | 'abgeschlossen' | 'verworfen'
	confidenceBefore: integer('confidence_before'), // 1–4, vor der ersten Frage
	mirrorReaction: text('mirror_reaction'), // 'kommt-hin' | 'dachte-mehr' | 'kann-mehr'
	// Rückschau des Kindes nach den Fragen, ABER VOR der Zahl — sonst antwortet es über die
	// Zahl statt über sich. Die Differenz zum Ergebnis ist das Selbstwirksamkeits-Signal.
	selfAfter: text('self_after'), // 'hatte-ich' | 'teil-fehlte' | 'nicht-wirklich'
	// Beim Abschluss gerechnet: erreichte Punkte, mögliche Punkte, Prozentwert.
	// Das WORT dazu wird nie gespeichert — es entsteht bei der Anzeige aus der Klassen-Skala,
	// damit ein Verschieben der Grenzen nichts nachrechnen muss.
	erreicht: integer('erreicht'),
	moeglich: integer('moeglich'),
	wert: integer('wert'), // 0–100
	// Nur das Neue einordnen: ab hier zählt Material als neu (= Kapitel-Zeitstempel beim Start).
	sinceAt: integer('since_at', { mode: 'timestamp' })
});

// Abrechnung einer Runde je Thema — rohe Summen, keine Bewertung. Eine Zeile pro Thema,
// das in dieser Runde Fragen hatte. Gleich für Einordnung und Übung, damit ein Thema schon
// vor der ersten Übung einen Stand hat.
//
// Daraus fällt alles: Kartenlabel (Summe über die Runde), Verzeichnis-Chip am Thema
// (jüngste Zeile), Dashboard (Zeilen über alle Kinder der Klasse). Wegschrieben statt bei
// jeder Anzeige aus `responses` gerechnet, weil das Dashboard über eine ganze Klasse und
// alle Runden aggregiert.
export const roundTopics = sqliteTable('round_topics', {
	id: id(),
	roundId: text('round_id')
		.notNull()
		.references(() => rounds.id, { onDelete: 'cascade' }),
	topicId: text('topic_id')
		.notNull()
		.references(() => tocEntries.id, { onDelete: 'cascade' }),
	erreicht: integer('erreicht').notNull(),
	moeglich: integer('moeglich').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Eine Frage der Runde. `kind='control'` ist eine Steuer-Frage (Nachfrage ohne Bewertung),
// alle anderen sind bewertete Fragen.
export const questions = sqliteTable('questions', {
	id: id(),
	roundId: text('round_id')
		.notNull()
		.references(() => rounds.id, { onDelete: 'cascade' }),
	wave: integer('wave').notNull().default(1), // 1 = erste drei, 2 = letzte zwei
	sortOrder: integer('sort_order').notNull().default(0),
	kind: text('kind').notNull(), // 'single' | 'multi' | 'yesno' | 'order' | 'match' | 'control'
	prompt: text('prompt').notNull(),
	options: text('options'), // JSON: string[] bzw. bei 'match' {links,rechts}[]
	// Bleibt serverseitig. Der Client bekommt sie nie zu sehen.
	correctAnswer: text('correct_answer'), // JSON
	// Die Frage trägt ihre Schwierigkeit selbst: der Prüf-Agent setzt 1–3. Die Zahl ist
	// zugleich das Versuchs-Kontingent — 2 Punkte = ein Nachfassen, 3 = zwei. Auf Anhieb
	// richtig gibt die volle Zahl, jedes Nachfassen einen Punkt weniger, nie richtig 0.
	punkte: integer('punkte').notNull().default(1),
	hint: text('hint'), // optional; bei Ja/Nein meist leer
	topicId: text('topic_id').references(() => tocEntries.id, { onDelete: 'set null' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

export const responses = sqliteTable('responses', {
	id: id(),
	questionId: text('question_id')
		.notNull()
		.references(() => questions.id, { onDelete: 'cascade' }),
	attempt: integer('attempt').notNull().default(1),
	given: text('given'), // JSON, genau wie das Kind geklickt hat
	outcome: text('outcome').notNull(), // 'richtig' | 'teilweise' | 'falsch'
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Arbeitsgedächtnis des Agenten, fortschreibbar. Kein Zeugnis: weder Kind noch
// Lehrkraft lesen das. Die Lehrkraft-Darstellung entsteht in M4 aus den harten Daten.
export const chapterAssessments = sqliteTable('chapter_assessments', {
	id: id(),
	studentId: text('student_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	chapterId: text('chapter_id')
		.notNull()
		.unique()
		.references(() => tocEntries.id, { onDelete: 'cascade' }),
	text: text('text').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});

// Der Lernplan eines Fachs IST die Menge seiner Punkte — kein Plan-Kopf, kein Deckel.
// Eine neue Runde fügt hinzu; verworfene Punkte behalten ihren Status, damit nichts
// dreimal vorgeschlagen wird.
export const planItems = sqliteTable('plan_items', {
	id: id(),
	studentId: text('student_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	subjectId: text('subject_id')
		.notNull()
		.references(() => tocEntries.id, { onDelete: 'cascade' }),
	chapterId: text('chapter_id').references(() => tocEntries.id, { onDelete: 'set null' }),
	// Das Thema, aus dem der Plan-Agent diesen Punkt gebaut hat. Damit die Übung nur DIESES
	// Material vor sich hat statt des ganzen Kapitels — schärfere Fragen und knapp halb so
	// viel Eingabe. Leer bei Karten aus der Zeit davor: dann gilt weiter das ganze Kapitel.
	topicId: text('topic_id').references(() => tocEntries.id, { onDelete: 'set null' }),
	auftrag: text('auftrag').notNull(), // in Worten, keine vorgefertigte Frage
	minutes: integer('minutes'), // Umfang — daraus fällt die Fragenzahl der Übung
	// Die Warteschlange: eine einzige Reihe pro Kind über ALLE Fächer. Sonst könnte das Kind
	// der wackelnden Karte durch Fachwechsel ausweichen, und genau die soll wiederkommen.
	// Angezeigt wird weiter nach Fach gruppiert, sortiert nach dieser Zahl.
	// Lücken sind egal — verglichen wird nur die Ordnung.
	position: integer('position').notNull().default(0),
	// Termin, KEINE Sortierung: der Umzug auf `position` hat das getrennt. Steht eine Karte
	// mit nahem Termin zu weit hinten, wird das Umsortieren vorgeschlagen; und beim
	// Einsortieren rutscht eine Karte nie hinter eine mit späterem oder ohne Termin.
	dueAt: integer('due_at', { mode: 'timestamp' }),
	status: text('status').notNull().default('offen'), // 'offen' | 'erledigt' | 'verworfen'
	createdInRoundId: text('created_in_round_id').references((): AnySQLiteColumn => rounds.id, {
		onDelete: 'set null'
	}),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

export const pseudonyms = sqliteTable('pseudonyms', {
	id: id(),
	classId: text('class_id')
		.notNull()
		.references(() => classes.id, { onDelete: 'cascade' }),
	value: text('value').notNull().unique(),
	claimed: integer('claimed', { mode: 'boolean' }).notNull().default(false),
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
});
