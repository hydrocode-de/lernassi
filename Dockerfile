# lernassi — SvelteKit mit adapter-node.
# Debian statt Alpine: better-sqlite3 ist ein natives Modul und findet für
# glibc fertige Binaries; unter musl müsste es jedes Mal übersetzt werden.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Übersetzungswerkzeug für den Fall, dass kein fertiges Binary passt.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# better-auth wird beim Bauen einmal ausgeführt und besteht auf einem Secret.
# Nur für diese Stufe, und es landet nirgends im Ergebnis: der Code liest über
# $env/dynamic/private, also erst zur Laufzeit aus der Umgebung.
ENV BETTER_AUTH_SECRET=nur-zum-bauen-niemals-in-betrieb
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Aufschrieb-Fotos: adapter-node lässt sonst nur 512 kB durch.
ENV BODY_SIZE_LIMIT=26214400

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

# Migrationen laufen beim Start – die Datenbank liegt auf /data und überlebt den Container.
CMD ["sh", "-c", "node scripts/migrate.mjs && node build"]
