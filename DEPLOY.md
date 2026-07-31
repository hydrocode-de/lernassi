# Betrieb auf camels-de

Alles, was der Server braucht, liegt im Repo. Auf dem Server wird nichts von
Hand angelegt — bis auf zwei Dinge, die dort nicht hingehören:

- **`/apps/lernassi/.env`** — Geheimnisse (`BETTER_AUTH_SECRET`, `REQUESTY_API_KEY`).
  Vorlage ist `.env.example`.
- **`/data/lernassi/`** — Datenbank und Bilder. Liegt bewusst außerhalb des
  Checkouts, damit ein `git pull` sie nie berührt.

Der Rest ist Auschecken und Starten.

## Laufender Betrieb

```bash
cd /apps/lernassi && git pull && docker compose up -d --build
```

Migrationen laufen beim Containerstart mit (`node scripts/migrate.mjs`).

## Einmal aufsetzen

Voraussetzung: `lernassi.hydrocode.cloud` zeigt auf 95.217.79.15.

```bash
# 1. Ablage für Datenbank und Bilder
mkdir -p /data/lernassi/db /data/lernassi/uploads

# 2. Checkout
git clone git@github.com:hydrocode-de/lernassi.git /apps/lernassi

# 3. Geheimnisse
cp /apps/lernassi/.env.example /apps/lernassi/.env && $EDITOR /apps/lernassi/.env

# 4. Anwendung starten (hört auf 127.0.0.1:8030)
cd /apps/lernassi && docker compose up -d --build

# 5. Nginx vorläufig ohne TLS, damit Certbot die Challenge ausliefern kann
ln -sfn /apps/lernassi/nginx/lernassi-bootstrap.conf /etc/nginx/sites-enabled/lernassi.conf
nginx -t && systemctl reload nginx

# 6. Zertifikat holen, ohne dass Certbot die Konfiguration umschreibt
certbot certonly --webroot -w /var/www/html -d lernassi.hydrocode.cloud

# 7. Auf die endgültige Konfiguration mit TLS umlegen
ln -sfn /apps/lernassi/nginx/lernassi.conf /etc/nginx/sites-enabled/lernassi.conf
nginx -t && systemctl reload nginx
```

Schritt 6 nutzt bewusst `certonly`: `certbot --nginx` würde die Serverblöcke in
`nginx/lernassi.conf` direkt bearbeiten, und diese Datei kommt aus dem Repo.

## Eckdaten

| | |
|---|---|
| Domain | lernassi.hydrocode.cloud |
| Port (nur lokal) | 127.0.0.1:8030 → Container 3000 |
| Datenbank | `/data/lernassi/db/lernassi.db` (SQLite) |
| Bilder | `/data/lernassi/uploads` |
| Nginx | `/etc/nginx/sites-enabled/lernassi.conf` → `/apps/lernassi/nginx/lernassi.conf` |
