import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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

// Eine Einordnungs-Runde über GENAU EIN Kapitel. Heißt nicht `session`:
// diesen Namen belegt Better Auth.
export const rounds = sqliteTable('rounds', {
	id: id(),
	studentId: text('student_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	chapterId: text('chapter_id')
		.notNull()
		.references(() => tocEntries.id, { onDelete: 'cascade' }),
	startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(now),
	finishedAt: integer('finished_at', { mode: 'timestamp' }),
	status: text('status').notNull().default('laufend'), // 'laufend' | 'abgeschlossen' | 'verworfen'
	confidenceBefore: integer('confidence_before'), // 1–4, vor der ersten Frage
	mirrorReaction: text('mirror_reaction'), // 'kommt-hin' | 'dachte-mehr' | 'kann-mehr'
	// Nur das Neue einordnen: ab hier zählt Material als neu (= Kapitel-Zeitstempel beim Start).
	sinceAt: integer('since_at', { mode: 'timestamp' })
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
	auftrag: text('auftrag').notNull(), // in Worten, keine vorgefertigte Frage
	minutes: integer('minutes'),
	dueAt: integer('due_at', { mode: 'timestamp' }), // null = „sofort"
	status: text('status').notNull().default('offen'), // 'offen' | 'erledigt' | 'verworfen'
	createdInRoundId: text('created_in_round_id').references(() => rounds.id, {
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
