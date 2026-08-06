# Nachlesen (Recherche) — Entwurf, noch nicht gebaut

> Der dritte Weg, eine Seite zu füllen: nicht fotografieren, nicht selbst tippen, sondern
> lernassi in einer **festen Liste von Seiten** nachlesen lassen. Oberflächen-Entwurf:
> `design-system/patterns/recherche.html`.
>
> Dieses Dokument ist die Idee, nicht die Umsetzung. Was hier steht, ist noch entscheidbar.

## Warum

Der manuelle Editor (`/schueler/schreiben`) setzt voraus, dass das Kind den Inhalt schon hat.
Genau das ist bei den Fällen, für die er gedacht war, oft nicht so: Heft vergessen, im
Unterricht nicht mitgekommen, krank gewesen. Dann steht das Kind vor einem leeren Feld — und
ein leeres Feld ist das Gegenteil von Selbstwirksamkeit.

Der Ausweg, den ein Kind heute nimmt, ist ChatGPT im anderen Tab. Dagegen ist der Punkt
dieses Wegs nicht, dass er besser antwortet, sondern **dass er nachvollziehbar ist**: er sagt,
woher etwas kommt, er kann nur in einer Liste nachlesen, die vorher festgelegt wurde, und was
ins Heft kommt, hat das Kind gelesen und übernommen.

## Der Ablauf

```
Editor („ich weiß noch nicht genug")
   → Recherche: Frage stellen  →  Treffer ankreuzen  →  Entwurf
   → zurück in den Editor, Text vorbelegt, änderbar
   → Übernehmen  →  Seite im Heft, markiert als „nachgelesen"
```

Drei Bildschirme, davon zwei neu. Die Stelle im Verzeichnis (`kapitel`, `nach`) wird
durchgereicht wie bisher — die Entscheidung „wohin" ist schon gefallen, bevor die Recherche
beginnt.

## Die Entscheidungen

**1. Die Whitelist ist eine Liste von Suchen, keine Liste von erlaubten URLs.**

Der Unterschied ist der ganze Sicherheitsgewinn. Eine URL-Whitelist muss man gegen
Weiterleitungen, Unterseiten und Parameter verteidigen. Stattdessen: pro Quelle ein Adapter
mit genau zwei Fähigkeiten — `suche(frage)` und `holeText(treffer)`. Beides spricht die API
*einer* Domain. Das Modell bekommt **kein Werkzeug**, mit dem es etwas abrufen könnte; es
sieht nur Text, den der Server vorher geholt hat.

```ts
// src/lib/server/recherche/quellen.ts (Skizze)
export const QUELLEN = [
  { id: 'wikipedia', label: 'Wikipedia',  api: 'https://de.wikipedia.org/w/api.php',   adapter: mediawiki, lizenz: 'CC BY-SA 4.0' },
  { id: 'klexikon',  label: 'Klexikon',   api: 'https://klexikon.zum.de/api.php',      adapter: mediawiki, lizenz: 'CC BY-SA 4.0' },
  // später, und teurer (kein Wiki-API, Text muss aus HTML gelöst werden):
  // { id: 'bpb', label: 'bpb.de', adapter: htmlLesen, … }
] as const;
```

Wikipedia und Klexikon sind beide MediaWiki — **ein** Adapter deckt die ersten zwei Quellen
ab, und das Klexikon ist der wichtigere von beiden: einfache Sprache, für Kinder geschrieben.
Alles, was kein Wiki ist, braucht HTML-Extraktion und ist der eigentliche Aufwand.

MediaWiki reicht dafür aus:
- Suche: `action=query&list=search&srsearch=…&srlimit=6`
- Text: `action=query&prop=extracts&explaintext=1&titles=…` (auf ~8.000 Zeichen gekappt)
- Wikimedia verlangt einen aussprechbaren `User-Agent` mit Kontaktadresse. Kein Schlüssel,
  kein Konto, keine Kosten.

**2. Die Suche ist keine KI.** Sie ist ein API-Aufruf. Erst der Entwurf ist ein Modellaufruf —
`generateObject`, ein Aufruf, dieselbe Bauart wie `leseGetipptes`. Kein Agent, keine Schleife,
kein Tool-Loop. Das hält die Kosten bei ungefähr dem, was eine getippte Seite heute kostet,
und es hält den Ablauf erklärbar.

**3. Das Kind kreuzt an, was gelesen wird.** Kein Automatismus, der die ersten drei Treffer
einsaugt. Drei Gründe, in dieser Reihenfolge: es ist die Stelle, an der das Kind etwas
entscheidet (und Auswahl ist der Anfang von Recherchekompetenz); es begrenzt, was überhaupt
abgerufen wird; und es begrenzt die Eingabemenge des Modellaufrufs.

**4. Der Entwurf ist ein Entwurf.** Er wird nicht gespeichert. Er kommt zurück in den Editor,
in dasselbe Textfeld, in dem das Kind sonst selbst schreibt, und erst „Übernehmen" schreibt
eine Zeile in die Datenbank. Damit ist der letzte Schritt derselbe wie beim getippten Text,
und im Heft steht nie etwas, das das Kind nicht gelesen hat.

Am Entwurf steht ausdrücklich: *„Das ist nachgelesen, nicht dein Unterricht. Was deine
Lehrkraft gesagt hat, zählt mehr."* Das ist keine Höflichkeit, sondern der Punkt 3 aus
MISSION.md — geerdet im echten Unterricht. Eine nachgelesene Seite ist eine Krücke, und sie
soll sich wie eine anfühlen.

**5. Der geholte Text ist nicht vertrauenswürdig.** Wikipedia ist offen editierbar; irgendwo
in einem Artikel kann „Ignoriere deine Anweisungen" stehen. Was dagegen trägt: das Modell hat
keine Werkzeuge (es kann also nichts tun, wozu es verleitet würde), die Ausgabe ist ein festes
Schema, der Fremdtext geht klar abgegrenzt und als Daten markiert in den Prompt — und jede
Ausgabe geht durch ein Kind, das sie liest, bevor sie irgendwo landet. Zusätzlich: Wikitext,
Vorlagen und Belegmarken vorher wegwerfen (`explaintext` erledigt das meiste).

**6. Herkunft und Belege bleiben am Aufschrieb.** `notes.herkunft = 'recherche'` neben `foto`
und `selbst`, plus eine kleine Tabelle:

```ts
export const noteSources = sqliteTable('note_sources', {
  id: id(),
  noteId: text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  quelle: text('quelle').notNull(),   // 'wikipedia' | 'klexikon' | …
  titel: text('titel').notNull(),
  url: text('url').notNull(),
  lizenz: text('lizenz').notNull(),   // CC BY-SA verlangt Nennung — nicht optional
  createdAt: …
});
```

Das ist zugleich die Lizenzpflicht (CC BY-SA heißt: Quelle nennen) und die Antwort auf „woher
weiß das Kind das?". Im Verzeichnis bekommt eine solche Seite ein Zeichen („nachgelesen"),
damit Kind und Lehrkraft sie nicht mit einer Heftseite verwechseln.

**7. Die Lehrkraft schaltet es frei, je Klasse, Standard aus.** `classes.recherche`. Ob
Nachlesen pädagogisch erwünscht ist, ist eine Entscheidung über den Unterricht, nicht über die
App — und im Piloten will man es klein anfangen lassen.

## Was gebaut werden müsste

| Stelle | Was |
|---|---|
| `src/lib/server/recherche/quellen.ts` | Whitelist + MediaWiki-Adapter (`suche`, `holeText`) |
| `src/lib/server/recherche/entwurf.ts` | ein `generateObject`-Aufruf: Titel, Text, Zusammenfassung, Begriffe, verwendete Quellen |
| `src/routes/schueler/recherche/+page.*` | Frage, Quellenwahl, Trefferliste, Entwurf |
| `src/routes/schueler/schreiben/+page.svelte` | zweiter Knopf: „Ich weiß noch nicht genug – nachlesen" |
| `src/routes/schueler/schreiben/+page.server.ts` | Entwurf als Vorbelegung annehmen, `herkunft='recherche'` schreiben, Belege mitschreiben |
| `schema.ts` + Migration | `notes.herkunft` um `'recherche'` erweitern (Textspalte, kein Schemabruch), `note_sources`, `classes.recherche` |
| `src/lib/ki.ts` | `KI_RECHERCHE` — Hinweis für die Recherche-Seite |
| `AI-ACT-STELLEN.md` | neue Anzeigestelle, neue Herkunft |
| `research_cache` (optional) | geholte Artikel mit Zeitstempel: 25 Kinder derselben Klasse holen denselben Artikel einmal |

Größenordnung: das Grundgerüst mit den zwei Wiki-Quellen ist etwa so viel Arbeit wie der
Editor selbst. Der teure Teil sind die Nicht-Wiki-Quellen (bpb, planet-schule, LEIFIphysik) —
jede braucht eigene Extraktion, und sie sind es einzeln vermutlich nicht wert. Erst Klexikon
und Wikipedia, dann sehen, ob überhaupt etwas fehlt.

## Datenschutz und KI-VO

- **Neuer Datenfluss nach außen.** Bisher verlässt nur der Modellaufruf (Requesty EU) den
  Server. Hier kommt ein Aufruf zu Wikimedia dazu: die Suchanfrage des Kindes, von unserem
  Server aus. Kein Pseudonym, keine Kennung, nicht die IP des Kindes. Muss trotzdem in die
  DSFA und in die Einwilligung — es ist ein Empfänger mehr, und Wikimedia sitzt in den USA.
  (Prüfen, ob der EU-Cache-Cluster ausreicht; Artikeltexte sind öffentlich, die Anfrage nicht.)
- **Die Suchanfrage ist Freitext von einem Kind** — dieselbe Kategorie wie der Editortext, nur
  verlässt sie zusätzlich das Haus. Vorbelegen mit dem Kapiteltitel, damit der Normalfall ein
  Sachbegriff ist und kein freier Satz.
- **Art. 50 KI-VO:** der Entwurf ist vollständig erzeugt → `kiErzeugt` + sichtbarer Hinweis,
  wie bei allem anderen. Sobald das Kind ihn überschreibt, wird es zum Mischtext; die Grenze
  ist nicht sauber ziehbar. Vorschlag: die Seite bleibt „nachgelesen" gekennzeichnet, das
  `data-ki-erzeugt` am Text fällt beim Übernehmen weg — das Kind hat ihn dann verantwortet.
  Das ist eine Entscheidung, die noch begründet werden muss, siehe `AI-ACT.md`.

## Was noch offen ist

- **Fließt nachgelesenes Material in die Fragen ein?** Wenn ja, fragt lernassi Dinge ab, die
  nie im Unterricht waren. Wenn nein, ist die nachgelesene Seite eine Sackgasse im Heft.
  Vorschlag: ja, aber der Runden-Agent erfährt, welches Material nachgelesen ist, und die
  Einordnung eines Kapitels zählt sie nicht als Unterrichtsstand.
- **Wikipedia ist für Klasse 6 zu schwer.** Klexikon deckt Grundschule bis früh Sek I ab, aber
  nicht jedes Thema. Alternative: den Entwurf ausdrücklich auf die Klassenstufe schreiben
  lassen (die Klasse kennt `grade`) — dann steht im Heft eine Vereinfachung, die die KI
  gemacht hat, mit allem, was daran schiefgehen kann.
- **Wie viele Treffer, wie viel Text?** Sechs Treffer und zwei Artikel klingen richtig, sind
  aber geraten. Hängt am Modellpreis und an der Geduld eines Zwölfjährigen.
- **Bilder und Schaubilder** aus den Quellen: bleiben draußen. Lizenzlage je Bild anders.
- **Offline/PWA:** die Recherche braucht Netz. Der Service-Worker muss das sauber abweisen,
  nicht in einen halben Entwurf laufen.
