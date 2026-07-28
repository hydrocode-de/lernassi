# Mission – KI-Lernassistent

> Privates Projekt. Entwickelt mit dem Goldenen Kreis (Simon Sinek): WHY → HOW → WHAT.

## WHY

**Jedes Kind soll selbstwirksam lernen können — mit denselben Voraussetzungen, unabhängig vom sozialen Hintergrund.**

Der eigentliche Hebel: Die KI fragt nicht nach dem Elternhaus. Ein Kind, dessen Eltern das Thema nicht beherrschen, keine Zeit oder kein Geld für Nachhilfe haben, bekommt denselben geduldigen, sofort antwortenden Tutor wie ein Kind aus dem Akademikerhaushalt. Das ist der Gleichmacher.

**Selbstwirksamkeit ist das Ziel** — das Kind erlebt „ich komme voran, aus eigener Kraft". Nicht „Hausaufgaben effizienter abarbeiten".

Erprobt: Sofortiges Feedback statt zwei Wochen ins Leere lernen. Selbständiges Lernen auch bei Themen, die Eltern selbst nicht können. Spürbar mehr Selbstwirksamkeit — und Spaß.

## HOW

In dieser Reihenfolge:

1. **Lehrkraft steuert, Kind gestaltet.** Nicht Hausaufgabe → abarbeiten, sondern Lernziel → das Kind erarbeitet mit der KI seinen Weg. Der Bruch mit dem Gewohnten. *Notwendige Voraussetzung für Selbstwirksamkeit — nicht das Ziel selbst.* Das kann „ChatGPT mit reingeworfenen Aufschrieben" nicht.
2. **Kontinuität.** Fortschritt, wiederverwendbare Fragen, jede Session baut auf der letzten auf — statt jedes Mal bei Null.
3. **Geerdet im echten Unterricht.** Die Aufschriebe *dieses* Kindes aus *diesem* Unterricht — nicht generisches Weltwissen. (Fundament, aber austauschbar.)
4. **Datenschutz als Vertrauensfundament.** Datenschutz-by-Design ist hier kein Kostenpunkt, sondern ein Differenzierer: *wenig, pseudonym, in der EU, kein Training auf Kinderdaten.* Genau das ist der Grund, warum eine Schule ja sagt. Zahlt aufs WHY ein — Bildungsgerechtigkeit heißt auch, dass gerade die verletzlichen Kinder geschützt sind.

**Design-Prinzip daraus:** *Je strukturierter die Interaktion, desto geringer das Datenschutz-Risiko.* Multiple-Choice/strukturierte Abfragen begrenzen die Eingabe; offener Chat (Vertiefung, „frag-deine-Aufschriebe", Rollenspiel) ist pädagogisch reicher, aber datenschutz-teurer, weil Kinder dort auch Nicht-Lernsachen preisgeben können. Offenheit im MVP bewusst dosieren.

**Das Projekt ist damit kein „weiterer KI-Tutor", sondern ein pädagogisches Instrument**, das Lehrer-Absicht, Kind-Selbstwirksamkeit und Fortschritt über Zeit verbindet.

## WHAT

### MVP: die kleinste *vollständige* Schleife

Kind-Seite und Lehrer-Seite sind gekoppelt und werden **nicht** getrennt gebaut. Selbstwirksamkeit lässt sich nicht ohne die Lehrer-Voraussetzung validieren, und die Lehrer-Schleife nicht ohne selbstwirksam arbeitende Kinder. Also: eine Schleife, die beides einmal ganz durchläuft — ein Fach, eine Lehrkraft, eine Handvoll Kinder.

1. **Lehrkraft** legt ein **Lernziel** an (Freitext genügt), optional ein Satz Kontext für die Schüler-KI.
2. **Kind** startet Session → lädt seine Aufschriebe (Foto) → KI macht Assessment *gegen das Lernziel* → sofortiges Feedback → Vertiefungsfragen → **das Kind entscheidet mit, woran es als Nächstes arbeitet.**
3. **Fortschritt** wird gespeichert → nächste Session baut darauf auf.
4. **Lehrkraft** sieht ein schlichtes **Fortschrittsbild** — was sitzt, wo hakt es.
5. **Selbstwirksamkeit wird von Tag 1 gemessen** — Kind-Selbsteinschätzung vor/nach, freiwillige Nutzung, O-Töne. Zugleich erste Evidenz für den Förderantrag.

### Bewusst NICHT im MVP (späterer Aufsatz auf den tragenden Kern)

- Rollenspiel-Charakter (z. B. Buchfigur „ausfragen" vor dem inneren Monolog)
- Echte A2A-Verhandlung Schüler-Agent ↔ Lehrer-Agent über Lernstand/Lernziel
- Getrennte Lernkarten- / „frag-deine-Aufschriebe"-Tools
- Ausgefeilte wiederverwendbare Fragen-Datenbank

### Datenschutz-Gate (nicht optional)

*Kein Rechtsrat — schulische/r Datenschutzbeauftragte/r und LfDI Baden-Württemberg früh einbinden.*

**Risiko-Einordnung (ehrlich):** Die **Leistungsdaten** (welches Thema, welche Frage, richtig/falsch, an die Lehrkraft übermittelt) sind *nicht* besonders sensibel — es sind normale Schülerleistungsdaten, die die Schule als Verantwortliche ohnehin verarbeitet. Die echte Sensibilität sitzt an zwei Rändern: **(a) offener Freitext** (Kind schreibt Nicht-Lernsachen — Familie, Gesundheit, evtl. Kinderschutz) und **(b) Aufschrieb-Fotos** (Namen anderer, Privates). Beide sind beherrschbar → strukturiert bevorzugen, Fotos zuschneiden/sparsam.

- **Rechtsgrundlage:** informierte **Einwilligung der Erziehungsberechtigten** (Minderjährige). *AVV ≠ Rechtsgrundlage — beides getrennt nötig.*
- **Datenminimierung:** **pseudonyme Konten** — echte Namen bleiben bei der Lehrkraft. Aufschrieb-Fotos sparsam/zugeschnitten.
- **Datenfluss (geklärt):** LLM über **Requesty EU-Endpoint** (`router.eu.requesty.ai`) — Modelle laufen in EU-Regionen (Claude/Bedrock EU, GPT/Azure EU, Gemini/Vertex EU), **Zero-Data-Retention**, **DPA nach Art. 28**. Datenbanken auf eigenem **Hetzner-Server (Nürnberg)**. **AVV** Schule ↔ eigene Firma; **DPA** eigene Firma ↔ Requesty. Offen (2-Min-Check): Requesty **Sub-Processor-Liste** fürs DSFA-Dokument anfragen.
- **On-Device-Option:** Lernstand kann lokal auf dem Schülergerät liegen (PWA/IndexedDB) → nur ein **minimales, pseudonymes Fortschritts-Signal** („Ziel X: sitzt/wackelt") synct zur Lehrkraft. Senkt Speicher-/Breach-Risiko deutlich. **Ändert aber nicht** die Rechtsgrundlage: die Inferenz (Aufschrieb → Modell) passiert weiter, Einwilligung + DSFA bleiben nötig.
- **DSFA (Datenschutz-Folgenabschätzung, Art. 35):** mit hoher Wahrscheinlichkeit **Pflicht** — nicht wegen sensibler Inhalte, sondern wegen des Modus (Kinder + KI + fortlaufende automatisierte Bewertung). Kurzes Dokument (3–8 Seiten), stärkt zugleich den Förderantrag. Darf ehrlich „Restrisiko gering" schließen.
- **Löschkonzept & Betroffenenrechte** von Anfang an.

## Weg & Ressourcen

- **Brückenkopf:** Pilot mit der **KI-Arbeitsgruppe der Lehrkräfte** an der Schule des Sohnes — dort ist die Bereitschaft schon da.
- **Danach:** Erkenntnisse → **Förderantragsphase**.
- **Ressourcen:** Claude-Premium zum Coden; eigenes EU-Hosting über eigene Firma; bis ca. **5.000 €** Token-Budget.
- **Team-Realität:** im Kern *eine Person + Claude*. „Jedes Kind" ist Nordstern, nicht Bauplan — klein anfangen, wo die Bereitschaft da ist.

## Ergebnis des Goldenen-Kreis-Checks

**Bauen — aber streng als kleinste vollständige Schleife.** Nicht drei Features parallel. Alles Weitere kommt erst, wenn diese Schleife bei echten Kindern und echten Lehrkräften trägt.
