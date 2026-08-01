# Übung im Gespräch (M5) — Erprobungszweig

> Steht **neben** der klassischen Übung, nicht an ihrer Stelle. Ohne `GESPRAECH=1` ändert
> sich für niemanden etwas. Ziel dieses Zweigs ist eine Antwort auf eine Frage, die sich
> nicht am Schreibtisch entscheiden lässt: trägt ein Gespräch besser als eine Welle Fragen?

## Warum überhaupt

Die klassische Runde schreibt drei Fragen auf einmal und sieht die Antworten nie. Sichtbar
wird das an `bisherigeFragen` (`src/lib/server/runde.ts`): dem Prüf-Agenten werden `frage`,
`thema` und `ergebnis` übergeben — **die Antwort des Kindes nie**. `responses.given` steht in
der Datenbank und landet in keinem Prompt. Die Anweisung „nimm gezielt auf, was gerade
gewackelt hat" konnte der Agent also gar nicht befolgen: er weiß, *dass* etwas falsch war,
nie *was* das Kind gedacht hat.

Daraus folgt der Zuschnitt hier: **ein Modellaufruf je Kind-Zug**, mit dem ganzen bisherigen
Verlauf samt Antworten.

## Der Ablauf

```
Selbsteinschätzung → Gespräch (Zug um Zug) → Abschlussprüfung → Rückschau → Zahl
```

Die Rückschau steht wie in der klassischen Übung **vor** der Zahl: wer erst 78 % liest,
antwortet nicht mehr über sich.

## Die fünf Entscheidungen

**1. Die Schleife liegt im Server, nicht im SDK.** Kein `generateText` mit Tools und
`stopWhen`: ein Kind überlegt Minuten und lädt zwischendurch die Seite neu — darauf kann ein
Tool-Loop nicht warten. Der Zustand steht in `turns`, der Server ruft je Zug einmal
`naechsterZug` auf. Das bleibt `generateObject` (bzw. `streamObject`), die strukturierte
Ausgabe ist also nicht aufgegeben.

**2. Gemessen wird aus Fragen — im Gespräch und in der Prüfung.** Reine Redezüge zählen nie.
Fragen, die der Agent selbst als Gesprächssteuerung markiert (`zaehlt: false`), werden als
`kind='control'` abgelegt und von `rundeAbrechnen` übersprungen — dieselbe Bauart wie die
Nachfrage am Anfang einer Einordnung.

Bewusst **kein** ganzheitliches Modellurteil über das Gespräch: daran hängen
`roundTopics` → Lehrer-Dashboard → `kategorieAus` → die Position der Karte in der
Warteschlange. Und die Auskunft nach Art. 86 KI-VO soll „so viele Punkte, hier sind die
Fragen" bleiben können, nicht „das Modell fand es 68 %". Das Gespräch erzeugt das
qualitative Bild, und das geht dorthin, wo es hingehört: `chapterAssessments`.

`rundeAbrechnen` musste dafür **nicht angefasst werden**. Für die Abrechnung ist ein Gespräch
eine Übung wie jede andere; das Klassen-Dashboard weiß von alldem nichts.

**3. Das Heft ist Bias, kein Zaun.** Der Agent darf verknüpfen, gegenüberstellen, nach dem
Warum fragen — auch über den Aufschrieb hinaus. Der Preis dafür ist Ehrlichkeit: jeder Zug
trägt `bezug` (`heft` | `darueber-hinaus`), und bei `darueber-hinaus` verweist der Agent
nicht aufs Heft (sonst stimmt „schau nochmal nach" nicht) und das Kind sieht ein Abzeichen.
Gespeichert wird das an `turns.bezug` und `questions.bezug` — auch für die spätere Prüfung
durch die Lehrkraft.

**4. Freitext als Frageart entfällt, das Gespräch ist der Freitext.** `bewerteFreitext` prüfte
gegen eine Stichwortliste und musste dabei die Verrenkung `darfNochmal` machen: sag, dass
etwas fehlt, aber nicht was. Im Gespräch fällt das weg — der nächste Zug *ist* das
Nachfassen. Deshalb hat eine Gesprächsfrage **genau einen Versuch** und trägt keinen Hinweis;
ihre Punktzahl ist reine Schwierigkeit statt Versuchs-Kontingent (`alsZeile(..., {einVersuch:
true})`).

**5. Der Wortlaut des Kindes bleibt nicht liegen.** Beim Abschluss wird `turns.text` für frei
getippte Kind-Züge auf `null` gesetzt. Das Gerüst des Gesprächs bleibt (wer wann welchen Zug
gemacht hat, alle Fragen, alle Punkte), der Wortlaut nicht. Angetippte Antworten bleiben
stehen: sie stehen ohnehin in `responses` und sind kein Freitext.

Das ist der bewusste Preis für den offenen Kanal. MISSION sagt dazu: *„Je strukturierter die
Interaktion, desto geringer das Datenschutz-Risiko"* — ein Gespräch ist genau die teure Form,
die dort zurückgestellt wurde. Deshalb ist der Normalfall auch der **angetippte** Zug und
freies Reden die Ausnahme, nicht umgekehrt.

## Ausprobieren

```bash
GESPRAECH=1 npm run dev
```

Im Lernplan steht dann an jeder offenen Karte ein zweiter Knopf „Im Gespräch" neben „Üben".
Beide Wege laufen nebeneinander — anders ließe sich nicht vergleichen.

Ohne API-Schlüssel geht es mit der Attrappe:

```bash
node scripts/gespraech-attrappe.mjs          # hört auf :8787
REQUESTY_BASE_URL=http://127.0.0.1:8787/v1 REQUESTY_API_KEY=egal GESPRAECH=1 npm run dev
```

Die Attrappe spielt ein festes Drehbuch (Frage → offener Zug → Frage über das Heft hinaus →
Frage → Schluss → drei Prüfungsfragen) und streamt in Stücken. Sie sagt **nichts** über die
Qualität echter Modellantworten — sie prüft nur, dass der Ablauf trägt.

## Was noch offen ist

**Kosten.** Es gibt bis heute **kein Prompt-Caching** im Projekt — kein `providerOptions`,
nirgends. Bei zwei Aufrufen je Einordnung fiel das nicht auf; bei 6–12 Zügen mit wachsendem
Kontext ist es die Frage, an der das Budget hängt. Erster Schritt: prüfen, ob Requesty über
den `openai-compatible`-Provider Cache-Control durchreicht. Der Verbrauch je Aufruf wird seit
diesem Zweig im Mitschrieb mitgeführt (`Mitschrieb.tokens`), damit der Vergleich der beiden
Modi keine Meinungsfrage ist.

**Material-Werkzeug.** Heute geht das volle Transkript in *jeden* Zug. Ein Werkzeug
`hol_material(thema)`, mit dem der Agent Material anfordert statt es immer zu bekommen, wäre
die zweite große Kostenschraube — und zugleich die technische Form von „Heft als Bias":
danach greifen statt darin eingesperrt sein.

**Gewichtung.** Gespräch und Prüfung zählen gleich in dieselbe Summe; getrennt ausgewiesen
wird nur bei der Anzeige („Im Gespräch 6 von 6, in der Prüfung 0 von 6"). Ob die Prüfung
schwerer wiegen sollte, entscheidet man besser an echten Daten als vorher.

**Prüfung durch die Lehrkraft.** Ein freierer Agent braucht mehr Aufsicht, nicht weniger. Die
angetippten Züge lassen sich weiter als einzelne Fragen stichproben (anonym, ohne Kind);
Gesprächsverläufe nicht, weil Kind-Äußerungen identifizierend sind. `questions.bezug` ist
schon dafür da: `darueber-hinaus` ist die naheliegende erste Stichprobe.

**Wiederverwendung.** Eine Frage, die nur als Zug 4 eines bestimmten Gesprächs Sinn ergibt,
ist als Baustein nicht wiederverwendbar. Was bleibt, ist Wiederverwendung eine Ebene höher:
welcher *Zugang* zu diesem Stoff hat getragen.
