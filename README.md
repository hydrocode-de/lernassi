# lernassi

Privater KI-Lernassistent für Schüler und Lehrkräfte. Siehe [MISSION.md](MISSION.md) für WHY/HOW/WHAT.

## Stack
- **SvelteKit** (`adapter-node`) + PWA — ein Full-Stack-Codebase, App-Gefühl, läuft auf jedem Schulgerät.
- **Better Auth** (+ Username-Plugin) — Lehrkraft (E-Mail+Passwort) & Kind (Pseudonym+Passwort) in einem System.
- **Drizzle ORM** + **SQLite** (lokal) → später Postgres.
- **Vercel AI SDK** + **Requesty (EU)** — ab M2 für den Agent-Loop.
- Alles EU-self-hosted (Hetzner Nürnberg). Kinder-Rohdaten (Foto/Freitext) bleiben transient.

## Entwicklung
```bash
cp .env.example .env   # dann BETTER_AUTH_SECRET setzen: openssl rand -base64 32
npm install
npm run db:migrate     # Schema in lokale SQLite anlegen
npm run dev
```

## Meilensteine
Arbeitsdocs unter `milestones/` (gitignored, wegwerfbar). Aktueller Stand: **M1 — Gerüst, Auth, Datenmodell**.
