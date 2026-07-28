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

export const learningGoals = sqliteTable('learning_goals', {
	id: id(),
	classId: text('class_id')
		.notNull()
		.references(() => classes.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	contextPrompt: text('context_prompt'), // Satz für die Schüler-KI (M2)
	subject: text('subject'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
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
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(now)
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
