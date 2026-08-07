# Betrieb auf camels-de

Alles, was der Server braucht, liegt im Repo. Auf dem Server wird nichts von
Hand angelegt — bis auf zwei Dinge, die dort nicht hingehören:

- **`/apps/lernassi/.env`** — Geheimnisse (`BETTER_AUTH_SECRET`, `REQUESTY_API_KEY`).
  Vorlage ist `.env.example`.
- **`/data/lernassi/`** — Datenbank und Bilder. Liegt bewusst außerhalb des
  Checkouts, damit ein `git pull` sie nie berührt.

Der Rest ist Auschecken und Starten.

## Laufender Betrieb

Von Hand auf dem Server:

```bash
cd /apps/lernassi && git pull && docker compose up -d --build
```

Oder vom eigenen Rechner aus, mit Sicherung und Kontrolle danach:

```bash
scripts/deploy.sh            # den Stand von main ausrollen
scripts/deploy.sh v0.5.0     # genau diesen Tag ausrollen
```

Das Skript sichert vorher die Datenbank nach `/data/lernassi/backups` (die letzten zehn
bleiben liegen), holt den Stand, baut neu und wartet, bis die Seite mit 200 antwortet —
sonst meldet ein Deploy Erfolg, während der Container noch im Kreis läuft. Ziel, Pfad und
Adresse lassen sich über `LERNASSI_SSH`, `LERNASSI_PFAD`, `LERNASSI_DATEN` und
`LERNASSI_URL` überschreiben.

Migrationen laufen beim Containerstart mit (`node scripts/migrate.mjs`).

### Von selbst, beim Tag

`.github/workflows/deploy.yml` rollt aus, sobald ein Tag `v*` gepusht wird (und von Hand
über „Run workflow"). Dafür müssen zwei Secrets im Repository liegen:

| Secret | Inhalt |
|---|---|
| `DEPLOY_KEY` | privater SSH-Schlüssel; der öffentliche Teil gehört auf camels-de in `~/.ssh/authorized_keys`. Ein eigener Schlüssel nur dafür, kein persönlicher. |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan data.camels-de.org`. Ohne das müsste der Lauf den Wirt blind akzeptieren. |

Solange die Secrets fehlen, bricht der Lauf mit einer klaren Meldung ab und rührt den
Server nicht an.

## Einmal aufsetzen

Voraussetzung: `lernassi.hydrocode.cloud` zeigt auf 95.217.79.15.

```bash
# 1. Ablage für Datenbank und Bilder.
#    Der Docker auf camels-de läuft mit userns-remap auf "camel": Container-Root
#    ist auf dem Wirt uid 1000. Gehört die Ablage root, sieht der Container sie
#    als nobody und kann nicht schreiben — die Migration stirbt mit
#    SQLITE_CANTOPEN und der Container läuft im Kreis.
mkdir -p /data/lernassi/db /data/lernassi/uploads
chown -R camel:camel /data/lernassi

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
