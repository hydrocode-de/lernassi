# Kennzeichnungspflichten → Stellen im Code

Begleitliste zu [`AI-ACT.md`](AI-ACT.md). Was ab **2.8.2026** zu kennzeichnen ist und wo
das im Code hängt. Zeilennummern sind Stand `c338e45` und wandern — die Datei ist der
verlässliche Teil, die Zeile nur der Einstieg.

**Befund vorweg:** In der gesamten Oberfläche steht derzeit **an keiner Stelle**, dass
lernassi eine KI ist. Weder für das Kind noch für die Lehrkraft. Geprüft mit einer Suche
nach „KI", „künstlich", „Computer" über alle `.svelte`-Dateien — kein Treffer.

---

## K1 · Art. 50 Abs. 1 + Abs. 5 — Hinweis vor der ersten Interaktion

Fehlt vollständig. Muss **spätestens bei der ersten Interaktion** stehen, klar,
laienverständlich und screenreader-zugänglich — nicht in AGB oder Untermenü.

### Kind-Seite

| Stelle | Warum hier |
|---|---|
| `src/routes/anmelden/+page.svelte` | Allererster Kontakt überhaupt. Registrierung und Anmeldung des Kindes. Der Hinweis gehört sichtbar aufs Formular, nicht in eine Fußzeile. |
| `src/routes/schueler/name/+page.svelte` | Onboarding-Schritt direkt nach der Registrierung — die natürliche Stelle für einen ruhigen Satz, was lernassi ist. |
| `src/routes/schueler/+layout.svelte` | Schale um alle Kind-Seiten. Trägt den dauerhaften, unaufdringlichen Hinweis, der die „jede erste Interaktion"-Regel auch für später hinzukommende Personen erfüllt. |
| `src/routes/schueler/aufnehmen/+page.svelte` | **Wichtigste Stelle.** Hier verlässt zum ersten Mal etwas vom Kind das Gerät Richtung Modell (Foto → Vision-Aufruf). Vor dem Auslösen muss klar sein, dass eine KI das Heft liest. |
| `src/routes/schueler/kapitel/[id]/+page.svelte` | Vorspann vor der Einordnungsrunde — letzter Punkt vor der ersten Fragerunde. |
| `src/routes/schueler/runde/[id]/+page.svelte` | Die Runde selbst; Frage ab Z. 196, Rückmeldungen Z. 157–174. |
| `src/routes/schueler/ueben/[id]/+page.svelte` | Übung; Frage Z. 195, Hinweis Z. 198, Rückmeldungen Z. 159–171. |

### Lehrkraft-Seite

| Stelle | Warum hier |
|---|---|
| `src/routes/lehrer/klasse/[id]/+page.svelte` | Der Text zum Lernziel sagt heute, es „steuert, welche Fragen lernassi auswählt" — beschreibt die Wirkung, benennt die KI aber nicht. Auch die Lehrkraft interagiert direkt. |
| `src/routes/lehrer/klasse/[id]/kind/[kindId]/+page.svelte` | Das Fortschrittsbild beruht vollständig auf maschineller Bewertung. Ab 2.12.2027 kommt hier zusätzlich Art. 26 Abs. 11 und Art. 86 dazu (siehe `AI-ACT.md`). |

---

## K2 · Art. 50 Abs. 2 — maschinenlesbare Kennzeichnung erzeugter Inhalte

Die Pflicht setzt an der **Ausgabe des Systems** an. Praktisch heißt das: an der Quelle
markieren, die Markierung mitspeichern, bei der Ausgabe mitgeben.

### Erzeugungsstellen (hier entsteht der synthetische Inhalt)

| Stelle | Was erzeugt wird |
|---|---|
| `src/lib/server/ingest.ts:78` | Vision-Aufruf über alle Seiten: `kapitel`, `thema`, `zusammenfassung`, `begriffe`, `transkript`, `hinweis` |
| `src/lib/server/lernen.ts:69` | Gemeinsamer Modellaufruf aller Lern-Agenten — die zentrale Stelle, an der eine Markierung ansetzen könnte |
| `src/lib/server/lernen.ts:231` | `erzeugeFragen` — Fragen der Einordnungsrunde |
| `src/lib/server/lernen.ts:297` | `erzeugeUebungsfragen` — Fragen der Übung |
| `src/lib/server/lernen.ts:388` | `bewerteFreitext` — Bewertung und Rückmeldungssatz |
| `src/lib/server/lernen.ts:446` | `spiegle` — der Spiegel-Text nach der ersten Welle |
| `src/lib/server/lernen.ts:517` | `planVorschlaege` — die Aufträge der Lernkarten |
| `src/lib/server/lernen.ts:580` | `schreibeBeurteilung` — interne Beurteilung |

### Speicherorte (hier müsste die Markierung mitgeführt werden)

| Feld | Datei | Inhalt |
|---|---|---|
| `tocEntries.title` | `schema.ts:141` | Kapitel- und Themen-Titel, vom Modell vergeben |
| `notes.transcript` | `schema.ts:186` | Abschrift des Hefts — Grenzfall, siehe `AI-ACT.md` |
| `notes.summary` | `schema.ts:187` | Zusammenfassung — klar synthetisch |
| `notes.keywords` | `schema.ts:188` | Begriffs-Chips |
| `questions.prompt` | `schema.ts:288` | Fragetext |
| `questions.options` | `schema.ts:289` | Antwortoptionen |
| `questions.hint` | `schema.ts:296` | Hinweis beim Nachfassen |
| `chapterAssessments.text` | `schema.ts:323` | Arbeitsgedächtnis des Agenten |
| `planItems.auftrag` | `schema.ts:343` | Auftrag der Lernkarte |

Es gibt bisher **keine Spalte**, die festhält, dass ein Feld aus einem Modellaufruf
stammt. Die Unterscheidung „vom Kind" / „vom Modell" existiert im Datenmodell nicht —
beim Verzeichnis ist sie sogar bewusst verwischt, weil das Kind Titel nachbearbeiten darf
(`src/routes/schueler/+page.server.ts`, `gliederung.ts`). Genau diese Fälle braucht eine
Entscheidung: bleibt ein vom Kind umbenanntes Kapitel KI-erzeugt?

### Anzeigestellen (hier wird es ausgegeben)

| Stelle | Was |
|---|---|
| `src/routes/schueler/aufnahme/[id]/+page.svelte:23,27` | Zusammenfassung und Begriffe nach dem Einlesen |
| `src/routes/schueler/thema/[id]/+page.svelte:34,37` | Zusammenfassung und Begriffe am Thema |
| `src/routes/schueler/plan/+page.svelte:37,68` | Auftrag der Lernkarte |
| `src/routes/schueler/runde/[id]/+page.svelte:196` | Fragetext; Rückmeldungen Z. 157–174 |
| `src/routes/schueler/ueben/[id]/+page.svelte:195,198` | Fragetext und Hinweis; Rückmeldungen Z. 159–171 |
| `src/routes/schueler/kapitel/[id]/+page.svelte:39` | Themen-Chips im Vorspann |
| `src/routes/schueler/+page.svelte` | Inhaltsverzeichnis — Kapitel- und Themen-Titel |

---

## Was noch fehlt, unabhängig von der Frist

- **Kein Export, keine Datei-Ausgabe.** Solange Inhalte nur als HTML gerendert werden,
  ist Metadaten-Kennzeichnung im Markup der realistische Weg. Sobald exportiert wird
  (Förderantrag, Elterngespräch), braucht es Provenance-Metadaten in der Datei.
- **`scripts/fixture-export.mjs`** schreibt Modell-Ausgaben in eine JSON-Fixture. Wenn
  Kennzeichnung ins Datenmodell kommt, muss sie hier mitlaufen.
- **Kein Impressum, keine Anbieterangabe** in der App (Art. 16 Buchst. b ab 2.12.2027,
  handelsrechtlich ohnehin fällig, sobald es öffentlich läuft).
