#!/usr/bin/env bash
#
# Deployen auf camels-de. Läuft auf dem eigenen Rechner und macht auf dem Server das,
# was in DEPLOY.md steht — plus die Handgriffe, die man sonst vergisst: Sicherung der
# Datenbank vor den Migrationen, und hinterher nachsehen, ob die Seite auch antwortet.
#
#   scripts/deploy.sh              # den Stand von main ausrollen
#   scripts/deploy.sh v0.5.0       # genau diesen Tag ausrollen
#
# Voraussetzung ist ein SSH-Zugang, der ohne Rückfragen durchgeht (Schlüssel im Agent).
# Abweichende Ziele über Umgebungsvariablen:
#
#   LERNASSI_SSH=root@data.camels-de.org
#   LERNASSI_PFAD=/apps/lernassi
#   LERNASSI_DATEN=/data/lernassi
#   LERNASSI_URL=https://lernassi.hydrocode.cloud

set -euo pipefail

ZIEL="${LERNASSI_SSH:-root@data.camels-de.org}"
PFAD="${LERNASSI_PFAD:-/apps/lernassi}"
DATEN="${LERNASSI_DATEN:-/data/lernassi}"
URL="${LERNASSI_URL:-https://lernassi.hydrocode.cloud}"
REF="${1:-}"

sagen() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

sagen "Ziel: $ZIEL:$PFAD${REF:+ (Stand $REF)}"

# Die Datenbank vor den Migrationen sichern. Sie liegt außerhalb des Checkouts, ein
# fehlgeschlagener Deploy fasst sie also nicht an — eine Migration aber schon.
# Die Befehle für den Server kommen als Heredoc und die Werte als Umgebung. Alles andere
# endet in geschachtelten Anführungszeichen, bei denen ein Pfad mit Leerzeichen oder ein
# Tag-Name irgendwann als eigener Befehl ausgeführt wird.
sagen "Datenbank sichern"
ssh "$ZIEL" "DATEN='$DATEN' bash -euo pipefail -s" <<'FERN'
mkdir -p "$DATEN/backups"
if [ -f "$DATEN/db/lernassi.db" ]; then
	stand=$(date +%Y%m%d-%H%M%S)
	cp "$DATEN/db/lernassi.db" "$DATEN/backups/lernassi-$stand.db"
	echo "gesichert: $DATEN/backups/lernassi-$stand.db"
	# Die letzten zehn reichen; mehr sammelt nur Platz.
	ls -1t "$DATEN/backups"/lernassi-*.db 2>/dev/null | tail -n +11 | xargs -r rm --
else
	echo "keine Datenbank vorhanden — erster Start?"
fi
FERN

sagen "Stand holen und bauen"
ssh "$ZIEL" "PFAD='$PFAD' REF='$REF' bash -euo pipefail -s" <<'FERN'
cd "$PFAD"
git fetch --tags --prune
# Mit Tag genau diesen Stand (abgekoppelt, damit klar ist, was läuft), sonst main nachziehen.
if [ -n "$REF" ]; then
	git checkout --detach "$REF"
else
	git checkout main && git pull --ff-only
fi
echo "jetzt auf: $(git describe --tags --always) ($(git rev-parse --short HEAD))"
docker compose up -d --build
FERN

# Die Migrationen laufen beim Containerstart. Bis die Anwendung antwortet, dauert es
# ein paar Sekunden — ohne Warten meldet ein Deploy Erfolg, während der Container
# noch im Kreis läuft.
sagen "Warten, bis die Seite antwortet"
for versuch in $(seq 1 30); do
	code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL" || true)
	if [ "$code" = "200" ]; then
		echo "läuft ($URL antwortet mit 200, nach ${versuch}s)"
		sagen "Fertig"
		exit 0
	fi
	sleep 1
done

sagen "Die Seite antwortet nicht (zuletzt HTTP ${code:-keine Antwort})"
echo "Logs ansehen mit:"
echo "  ssh $ZIEL 'cd $PFAD && docker compose logs --tail 50'"
exit 1
