# Betrieb auf camels-de

Zwei Instanzen auf demselben Server, je ein Zweig:

| | Produktion | Dev |
|---|---|---|
| Zweig | `prod` | `main` |
| Adresse | lernassi.hydrocode.cloud | dev.lernassi.hydrocode.cloud |
| Checkout | `/apps/lernassi` | `/apps/lernassi-dev` |
| Daten | `/data/lernassi` | `/data/lernassi-dev` |
| Port (nur lokal) | 127.0.0.1:8030 | 127.0.0.1:8032 |
| Datenbank | `/data/lernassi/db/lernassi.db` | `/data/lernassi-dev/db/lernassi.db` |
| Bilder | `/data/lernassi/uploads` | `/data/lernassi-dev/uploads` |
| Nginx | `/etc/nginx/sites-enabled/lernassi.conf` | `…/lernassi-dev.conf` |
| Zeichen der PWA | lernassi | dasselbe mit „staging"-Binde |

Die beiden teilen sich nichts außer dem Wirt. Getrennte Datenbanken sind kein
Ordnungsfimmel, sondern Notwehr: `main` ist im Schema immer vor `prod`, und in der
Migrationshistorie stehen `DROP TABLE` und `DROP COLUMN`. Bei geteilter Datenbank würde
ein Push auf `main` das Schema unter der laufenden Produktion wegziehen — ohne Fehler,
ohne Warnung, nur 500er bei den Kindern.

Auf Dev arbeiten Beta-Lehrkräfte mit Testklassen, nie mit echten Kindern. Die Dev-Daten
sind wegwerfbar und werden nicht gesichert.

Damit auf einem Tablet, auf dem beide liegen, niemand die falsche antippt, liefert die
Dev-Instanz ein eigenes Zeichen aus: dasselbe wie sonst, mit einer „staging"-Binde
darüber, und „staging" statt „lernassi" unter dem Symbol auf dem Startbildschirm. Welche
Fassung es wird, entscheidet die Anwendung beim Ausliefern an `LERNASSI_ORIGIN` — ein
Name, der mit `dev.` beginnt, ist Dev. Dafür ist nichts einzurichten; nur falls die
Dev-Instanz einmal anders heißen sollte, setzt man `LERNASSI_UMGEBUNG=staging` in ihre
`.env`. Im Zweifel gilt Produktion.

Die Zeichen liegen als SVG in `static/`; die PNG daneben — die verlangen iOS und Android
beim Einrichten auf dem Startbildschirm — erzeugt `scripts/icons.mjs` daraus:

```bash
npm i --no-save sharp && node scripts/icons.mjs
```

Wer die Dev-Instanz schon auf dem Startbildschirm hat, sieht das neue Zeichen nicht von
selbst: das Betriebssystem holt es nur beim Einrichten. Einmal entfernen und neu
hinzufügen.

Alles, was der Server braucht, liegt im Repo. Von Hand angelegt wird nur, was dort nicht
hingehört: die `.env` neben dem jeweiligen Checkout (Geheimnisse, Vorlage ist
`.env.example`) und das Datenverzeichnis unter `/data/`, das bewusst außerhalb des
Checkouts liegt, damit ein `git pull` es nie berührt.

## Laufender Betrieb

Ausgerollt wird von selbst, sobald etwas auf einem der beiden Zweige landet:

```
Push auf main  ->  Dev          (jeder Commit, sofort)
Merge nach prod ->  Produktion  (nur per Pull Request von main)
```

Nach `prod` führt kein direkter Push, sondern nur der Merge eines PR von `main`. Dieser
PR ist die Stelle, an der der Unterschied zwischen Dev und Produktion sichtbar wird.

Tags lösen nichts aus. Sie markieren Meilensteine. Einen bestimmten Tag trotzdem
ausrollen: „Run workflow" auf `prod`, den Tag ins Feld `ref`.

### Von Hand

```bash
scripts/deploy.sh            # prod auf die Produktion
scripts/deploy.sh v0.5.0     # genau diesen Tag auf die Produktion
```

Und auf die Dev-Instanz:

```bash
LERNASSI_PFAD=/apps/lernassi-dev LERNASSI_DATEN=/data/lernassi-dev \
LERNASSI_URL=https://dev.lernassi.hydrocode.cloud LERNASSI_BRANCH=main \
scripts/deploy.sh
```

Das Skript sichert vorher die Datenbank nach `<Daten>/backups` (die letzten zehn bleiben
liegen), holt den Stand, baut neu und wartet, bis die Seite mit 200 antwortet — sonst
meldet ein Deploy Erfolg, während der Container noch im Kreis läuft.

Migrationen laufen beim Containerstart mit (`node scripts/migrate.mjs`).

### Konten und Passwörter

Wer die Zugangsdaten einer Instanz nicht mehr weiß, fragt sie dort nach — `seed.mjs` hat
auf dem Server nichts zu suchen, das legt die Testklasse neu an und löscht dabei.

```bash
# Welche Konten gibt es? (Produktion; für Dev /apps/lernassi-dev)
ssh root@95.217.79.15 'cd /apps/lernassi && docker compose exec -T web node scripts/passwort.mjs'

# Passwort neu setzen — ohne Vorgabe wird eines ausgewürfelt und angezeigt
ssh root@95.217.79.15 'cd /apps/lernassi && docker compose exec -T web node scripts/passwort.mjs t@test.de'

# Oder selbst vorgeben
ssh root@95.217.79.15 'cd /apps/lernassi && docker compose exec -T web node scripts/passwort.mjs t@test.de geheim123'
```

Kennung ist, womit sich das Konto anmeldet: bei Lehrkräften die E-Mail, bei Kindern das
Pseudonym. Offene Sitzungen des Kontos werden dabei verworfen — wer ein Passwort
zurücksetzt, will den bisher Angemeldeten in der Regel draußen haben.

Das ausgewürfelte Passwort steht danach in der Shell-Historie des Servers und in keinem
Protokoll der App. Es ist als Einmal-Passwort gedacht: weitergeben, und die Lehrkraft
ändert es selbst.

### Wenn ein Deploy scheitert

Es wird nichts zurückgenommen — bewusst. Die Migrationen sind zu dem Zeitpunkt schon
gelaufen; alten Code auf ein neueres Schema zurückzusetzen macht es bei einem
`DROP COLUMN` schlimmer statt besser. Die Sicherung von vor den Migrationen liegt in
`<Daten>/backups`, entschieden wird von Hand:

```bash
ssh root@data.camels-de.org 'cd /apps/lernassi && docker compose logs --tail 50'
```

### Was in den Repository-Secrets liegen muss

| Secret | Inhalt |
|---|---|
| `DEPLOY_KEY` | privater SSH-Schlüssel; der öffentliche Teil gehört auf camels-de in `~/.ssh/authorized_keys`. Ein eigener Schlüssel nur dafür, kein persönlicher. |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan data.camels-de.org`. Ohne das müsste der Lauf den Wirt blind akzeptieren. |

Solange die Secrets fehlen, bricht der Lauf mit einer klaren Meldung ab und rührt den
Server nicht an.

## Einmal aufsetzen

### Produktion

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
cd /apps/lernassi && git checkout prod

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

### Dev

Voraussetzung: `dev.lernassi.hydrocode.cloud` zeigt auf 95.217.79.15. Der Wildcard
`*.hydrocode.cloud` reicht dafür nicht — er greift nur eine Ebene tief, `dev.lernassi.…`
braucht einen eigenen A-Eintrag.

```bash
# 1. Eigene Ablage, gleiche Eigentümerfalle wie oben
mkdir -p /data/lernassi-dev/db /data/lernassi-dev/uploads
chown -R camel:camel /data/lernassi-dev

# 2. Zweiter Checkout, auf main
git clone git@github.com:hydrocode-de/lernassi.git /apps/lernassi-dev
cd /apps/lernassi-dev && git checkout main

# 3. Geheimnisse — plus die vier Werte, die Dev von der Produktion unterscheiden
cp /apps/lernassi-dev/.env.example /apps/lernassi-dev/.env
cat >> /apps/lernassi-dev/.env <<'ENDE'
LERNASSI_PORT=8032
LERNASSI_ORIGIN=https://dev.lernassi.hydrocode.cloud
LERNASSI_DATEN=/data/lernassi-dev
ENDE
$EDITOR /apps/lernassi-dev/.env

# 4. Starten (hört auf 127.0.0.1:8032)
cd /apps/lernassi-dev && docker compose up -d --build

# 5.–7. wie oben, nur mit den Dev-Dateien
ln -sfn /apps/lernassi-dev/nginx/lernassi-dev-bootstrap.conf /etc/nginx/sites-enabled/lernassi-dev.conf
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/html -d dev.lernassi.hydrocode.cloud
ln -sfn /apps/lernassi-dev/nginx/lernassi-dev.conf /etc/nginx/sites-enabled/lernassi-dev.conf
nginx -t && systemctl reload nginx
```

`LERNASSI_ORIGIN` ist nicht optional: steht dort die falsche Adresse, scheitert jede
Formularabsendung an der Origin-Prüfung von SvelteKit — die Seite lädt, aber nichts
lässt sich abschicken.

Den Projektnamen (und damit die Containernamen) leitet Compose aus dem Verzeichnisnamen
ab. `/apps/lernassi` und `/apps/lernassi-dev` kommen sich deshalb nicht ins Gehege.
