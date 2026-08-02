# Kennzeichnungspflichten → Stellen im Code

Begleitliste zu [`AI-ACT.md`](AI-ACT.md). Was ab **2.8.2026** zu kennzeichnen ist und wo
das im Code hängt. Zeilennummern sind Stand `c338e45` und wandern — die Datei ist der
verlässliche Teil, die Zeile nur der Einstieg.

**Ausgangsbefund:** In der gesamten Oberfläche stand **an keiner Stelle**, dass lernassi
eine KI ist — weder für das Kind noch für die Lehrkraft. Ein Teil davon ist inzwischen
umgesetzt; die Tabellen führen den Stand mit (**✓ steht**, **offen**).

Die Sätze selbst stehen zentral in [`src/lib/ki.ts`](src/lib/ki.ts) — dieselbe Überlegung
wie bei den Lernstands-Wörtern in `kategorie.ts`: ein Wortlaut, viele Stellen. Die beiden
Darstellungsformen (`.ki-hinweis` für den Satz, `.tag--ki` für das Abzeichen) stehen in
`src/app.css`.

---

## K1 · Art. 50 Abs. 1 + Abs. 5 — Hinweis vor der ersten Interaktion

Muss **spätestens bei der ersten Interaktion** stehen, klar, laienverständlich und
screenreader-zugänglich — nicht in AGB oder Untermenü.

### Kind-Seite

| Stelle | Stand | Warum hier |
|---|---|---|
| `src/routes/schueler/aufnehmen/+page.svelte` | **✓ steht** | **Wichtigste Stelle.** Hier verlässt zum ersten Mal etwas vom Kind das Gerät Richtung Modell (Foto → Vision-Aufruf). Der Hinweis steht vor dem Auslösen, in beiden Varianten (Handy und Rechner). |
| `src/routes/schueler/kapitel/[id]/+page.svelte` | **✓ steht** | Vorspann vor der Einordnungsrunde, am Ende der Karte „Das habe ich von dir". |
| `src/routes/schueler/ueben/[id]/+page.svelte` | **✓ steht** | Übung hat **keinen** Vorspann — der Hinweis steht darum auf der Seite selbst, unter dem Kopf und vor der Selbsteinschätzung. |
| `src/routes/schueler/aufnahme/[id]/+page.svelte` | **✓ steht** | Ergebnis der Fotosession: dort ist jeder Text maschinell, nur die Fotos nicht. Eine Markierung für die ganze Seite statt eine je Absatz. |
| `src/routes/schueler/thema/[id]/+page.svelte` | **✓ steht** | Dasselbe für die Seite eines Aufschriebs — Zusammenfassung, Begriffe und Abschrift. |
| `src/routes/anmelden/+page.svelte` | offen | Allererster Kontakt überhaupt. Registrierung und Anmeldung des Kindes. |
| `src/routes/schueler/name/+page.svelte` | offen | Onboarding-Schritt direkt nach der Registrierung. |
| `src/routes/schueler/+layout.svelte` | offen | Schale um alle Kind-Seiten. Achtung: blendet sich auf `aufnehmen` und `name` bewusst aus (Z. 8–10) — kann die dortigen Hinweise also **nicht** ersetzen. |

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
| `lernen.ts` → `naechsterZug` | **Gesprächsmodus (M5).** Jeder Zug von lernassi: Gesprächstext und Frage in einem — im Gespräch gibt es nur diese eine Erzeugungsstelle. Läuft über `streamObject`, also außerhalb der gemeinsamen `frage()`-Stelle; eine Markierung müsste hier eigens ansetzen. Siehe `GESPRAECH.md`. |
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
| `turns.text` (rolle `lernassi`) | `schema.ts` | Gesprächszüge im Gespräch — vollständig erzeugt. Kind-Züge sind es nicht; die Spalte trägt beides, die Unterscheidung steckt in `rolle`. |

Es gibt bisher **keine Spalte**, die festhält, dass ein Feld aus einem Modellaufruf
stammt. Die Unterscheidung „vom Kind" / „vom Modell" existiert im Datenmodell nicht —
beim Verzeichnis ist sie sogar bewusst verwischt, weil das Kind Titel nachbearbeiten darf
(`src/routes/schueler/+page.server.ts`, `gliederung.ts`). Genau diese Fälle braucht eine
Entscheidung: bleibt ein vom Kind umbenanntes Kapitel KI-erzeugt?

### Anzeigestellen (hier wird es ausgegeben)

`kiErzeugt` aus `$lib/ki` setzt `data-ki-erzeugt="true"` — das ist die maschinenlesbare
Hälfte. Sichtbar wird es entweder über das Abzeichen `.tag--ki` (an der Frage) oder über
den Abschnittshinweis (auf den Aufschrieb-Seiten).

| Stelle | Stand | Was |
|---|---|---|
| `schueler/runde/[id]/+page.svelte` | **✓ Abzeichen + Attribut** | Fragetext, Abzeichen in der Kopfzeile der Fragekarte |
| `schueler/ueben/[id]/+page.svelte` | **✓ Abzeichen + Attribut** | Fragetext und der Auftrag in der Überschrift |
| `schueler/aufnahme/[id]/+page.svelte` | **✓ Hinweis + Attribut** | Zusammenfassung, Begriffe, Kapitel/Thema im Ablage-Pfad |
| `schueler/thema/[id]/+page.svelte` | **✓ Hinweis + Attribut** | Zusammenfassung, Begriffe, Abschrift |
| `schueler/plan/+page.svelte` | **✓ nur Attribut** | Aufträge der Lernkarten. Bewusst ohne Abzeichen: der Plan ist eine Liste, ein Abzeichen je Zeile wäre Lärm. |
| `schueler/gespraech/[id]/+page.svelte` | **✓ Hinweis + Attribut** | Gesprächsmodus: `KI_GESPRAECH` oben auf der Seite (Art. 50 Abs. 1 — ein Gespräch ist die Form, bei der der Hinweis am wenigsten verzichtbar ist), `kiErzeugt` an jedem Zug von lernassi, Abzeichen an der Prüfungsfrage. Kind-Züge tragen es nicht — die sind vom Kind. |
| `schueler/runde/[id]` + `ueben/[id]`, Rückmeldungen | offen | Die Rückmeldungssätze nach einer Antwort sind ebenfalls erzeugt. Die Fragekarte trägt das Abzeichen, die Rückmeldung steht in einer eigenen Blase. |
| `schueler/kapitel/[id]/+page.svelte:39` | offen | Themen-Chips im Vorspann (Titel stammen vom Modell) |
| `schueler/+page.svelte` | offen | Inhaltsverzeichnis — Kapitel- und Themen-Titel. Hier hängt die Entscheidung dran, ob ein vom Kind umbenanntes Kapitel KI-erzeugt bleibt. |

---

## Was noch fehlt, unabhängig von der Frist

- **Kein Export, keine Datei-Ausgabe.** Solange Inhalte nur als HTML gerendert werden,
  ist Metadaten-Kennzeichnung im Markup der realistische Weg. Sobald exportiert wird
  (Förderantrag, Elterngespräch), braucht es Provenance-Metadaten in der Datei.
- **`scripts/fixture-export.mjs`** schreibt Modell-Ausgaben in eine JSON-Fixture. Wenn
  Kennzeichnung ins Datenmodell kommt, muss sie hier mitlaufen.
- **Kein Impressum, keine Anbieterangabe** in der App (Art. 16 Buchst. b ab 2.12.2027,
  handelsrechtlich ohnehin fällig, sobald es öffentlich läuft).
