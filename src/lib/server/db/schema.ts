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
