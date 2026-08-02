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
Selbsteinschätzung → Gespräch (Zug um Zug) → Rückschau → Zahl
```

Ein einziger Abschnitt. Es gibt **keine** getrennte Prüfung am Ende — das Kind soll an keiner
Stelle das Gefühl haben, jetzt beginne die Bewertung.

Die Rückschau steht wie in der klassischen Übung **vor** der Zahl: wer erst 78 % liest,
antwortet nicht mehr über sich.

## Die fünf Entscheidungen

**1. Die Schleife liegt im Server, nicht im SDK.** Kein `generateText` mit Tools und
`stopWhen`: ein Kind überlegt Minuten und lädt zwischendurch die Seite neu — darauf kann ein
Tool-Loop nicht warten. Der Zustand steht in `turns`, der Server ruft je Zug einmal
`naechsterZug` auf. Das bleibt `generateObject` (bzw. `streamObject`), die strukturierte
Ausgabe ist also nicht aufgegeben.

**2. Gemessen wird aus den Fragen der Session — allen, rein additiv.** Es gibt keine zwei
Sorten Fragen. Eine Frage im sechsten Zug zählt genauso viel wie die im ersten. Reine
Redezüge zählen nie, und Fragen, die der Agent selbst als Gesprächssteuerung markiert
(`zaehlt: false`), werden als `kind='control'` abgelegt und von `rundeAbrechnen` übersprungen
— dieselbe Bauart wie die Nachfrage am Anfang einer Einordnung.

Gesteuert wird das über **eine** Zahl: das Punkteziel der Session (`punkteZiel`, rund 1,2
Punkte je Minute Kartenumfang). Der Agent bekommt bei jedem Zug gesagt, wo er steht — bei 5
von 12 und knapper Zeit stellt er Fragen statt zu reden, bei 12 von 12 ist Schluss. Was
früher „die Prüfung" war, ist damit einfach das Auffüllen: mal zwei Fragen, mal keine.

Das Ziel ist Untergrenze, keine Obergrenze; ein Überschießen im letzten Zug ist kein Fehler.
Es soll nur nicht vorkommen, dass eine Session auf drei Punkten steht — daraus lässt sich
kein Prozentwert ablesen, der etwas bedeutet.

**Das Kind erfährt davon nichts.** Der Prompt verbietet dem Agenten ausdrücklich, über
Punkte, Ziele, Prüfung oder Fortschritt zu sprechen, und die Seite zeigt während des
Gesprächs keine Zahl — nur einen Balken ohne Beschriftung. Ein laufender Punktestand wäre das
deutlichste „du wirst gerade geprüft"-Signal, das die Oberfläche senden könnte.

Wann die Session endet, entscheidet der Server, nicht der Agent: ein `schluss`, den niemand
angefordert hat, wird zum Redezug, und beim angeforderten Abschluss wird der Zug als solcher
festgeschrieben, auch wenn das Modell noch eine Frage anhängen wollte.

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

Die Attrappe spielt ein festes Drehbuch (sechs Fragen und ein offener Zug, zusammen genau die
12 Punkte einer Zehn-Minuten-Karte) und streamt in Stücken. Sie sagt **nichts** über die
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

**Kalibrierung des Punkteziels.** 1,2 Punkte je Minute ist geraten. Zu hoch heißt: das
Gespräch wird zum Abfragen, weil der Agent auffüllen muss. Zu niedrig heißt: die Prozentzahl
steht auf zu wenig Fragen. Das ist die erste Zahl, die nach echten Läufen nachzuziehen ist.

**Prüfung durch die Lehrkraft.** Ein freierer Agent braucht mehr Aufsicht, nicht weniger. Die
angetippten Züge lassen sich weiter als einzelne Fragen stichproben (anonym, ohne Kind);
Gesprächsverläufe nicht, weil Kind-Äußerungen identifizierend sind. `questions.bezug` ist
schon dafür da: `darueber-hinaus` ist die naheliegende erste Stichprobe.

**Wiederverwendung.** Eine Frage, die nur als Zug 4 eines bestimmten Gesprächs Sinn ergibt,
ist als Baustein nicht wiederverwendbar. Was bleibt, ist Wiederverwendung eine Ebene höher:
welcher *Zugang* zu diesem Stoff hat getragen.
