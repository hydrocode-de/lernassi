# Nachlesen (Recherche) — Entwurf, noch nicht gebaut

> Oberfläche: `design-system/patterns/recherche.html` — ein Bildschirm, zwei Zustände.

## Warum

Der Editor (`/schueler/schreiben`) setzt voraus, dass das Kind den Inhalt schon hat. Bei Heft
vergessen, krank gewesen, nicht mitgekommen ist genau das nicht so — dann steht es vor einem
leeren Feld. Der Ausweg, den es heute nimmt, ist ChatGPT im anderen Tab. Der Unterschied hier:
es steht dran, woher der Text kommt, und im Heft landet nur, was das Kind übernimmt.

## Das Werkzeug

Ein Werkzeug, eine Aufgabe: **Thema rein, Artikel raus.**

```ts
// src/lib/server/recherche.ts
const wikipedia = tool({
  description: 'Holt den Wikipedia-Artikel zu einem Thema (deutsche Wikipedia).',
  inputSchema: z.object({ thema: z.string() }),
  execute: async ({ thema }) => {
    // 1. Titel finden: action=query&list=search&srsearch=<thema>&srlimit=1
    // 2. Text holen:   action=query&prop=extracts&explaintext=1&titles=<titel>
    return { titel, text: text.slice(0, 8000), url };
  }
});
```

Kein Schlüssel, kein Konto, keine Kosten. Wikimedia will nur einen `User-Agent` mit
Kontaktadresse. Das Klexikon (`klexikon.zum.de`, einfache Sprache für Kinder) läuft auf
derselben Software — dieselbe Funktion mit anderer Basis-URL, also ein zweites Werkzeug von
drei Zeilen.

Damit ist die „Whitelist" nichts, was man pflegen muss: das Modell kann keine Adresse aufrufen,
weil es kein Werkzeug dafür hat. Es kann `wikipedia({thema})` rufen und `klexikon({thema})`,
sonst nichts. Wer eine Quelle dazu will, schreibt ein Werkzeug.

**MCP braucht es dafür nicht.** MCP ist das Protokoll, mit dem ein *fremder* Prozess Werkzeuge
anbietet. Der Modellaufruf passiert hier in unserem eigenen Server — das Werkzeug ist einfach
eine Funktion, die wir dem AI SDK mitgeben (`tools: { wikipedia }`). Ein eigener MCP-Server für
ein `fetch` wären zwei Prozesse mehr für nichts. Sinnvoll wird MCP, wenn dieselben Werkzeuge
später auch anderswo hängen sollen — dann kann man dieselbe Funktion zusätzlich als
MCP-Server exportieren, ohne hier etwas zu ändern.

## Der Ablauf

```
Editor: „Ich weiß noch nicht genug – nachlesen"
   → Thema eingeben (vorbelegt mit dem Kapiteltitel)
   → ein Modellaufruf MIT Werkzeug: es ruft wikipedia({thema}) und schreibt daraus
     Titel, Text, Zusammenfassung, Begriffe
   → Entwurf im Editor, änderbar
   → „In mein Heft" speichert — als nachgelesene Seite
```

Der Modellaufruf ist `generateText` mit `tools` und `stopWhen: stepCountIs(3)` plus einem
`generateObject` fürs Ergebnis — oder gleich `generateObject` mit Werkzeug, wenn das SDK das
in einem Zug macht. Ein Aufruf, zwei bis drei Schritte, Kosten in der Größenordnung einer
getippten Seite.

Die Stelle im Verzeichnis (`kapitel`, `nach`) läuft durch wie beim Editor.

## Drei Dinge, die dranhängen

**Der Entwurf wird nicht gespeichert.** Er kommt in dasselbe Textfeld, in dem das Kind sonst
selbst schreibt. Gespeichert wird erst beim Übernehmen — im Heft steht nie etwas, das das Kind
nicht gelesen hat.

**Nachgelesen ist nicht Unterricht.** `notes.herkunft = 'recherche'` (dritter Wert neben `foto`
und `selbst`), im Verzeichnis ein Zeichen, und Quelle plus Lizenz am Aufschrieb — CC BY-SA
verlangt die Nennung. Am Entwurf steht der Satz: *was deine Lehrkraft gesagt hat, zählt mehr.*

**Der Artikeltext ist Fremdtext.** Wikipedia ist offen editierbar, da kann Unsinn oder eine
Anweisung drinstehen. Was dagegen trägt: das Modell hat außer „Artikel holen" kein Werkzeug,
die Ausgabe ist ein festes Schema, und sie geht durch ein Kind, das sie liest.

## Was zu bauen wäre

| Stelle | Was |
|---|---|
| `src/lib/server/recherche.ts` | die zwei Werkzeuge + ein Modellaufruf für den Entwurf |
| `src/routes/schueler/recherche/+page.*` | der Bildschirm aus dem Mockup |
| `schueler/schreiben/+page.*` | Knopf hin, Entwurf als Vorbelegung zurück |
| `schema.ts` + Migration | `herkunft='recherche'`, Quelle/URL/Lizenz am Aufschrieb |
| `src/lib/ki.ts`, `AI-ACT-STELLEN.md` | Hinweistext, neue Anzeigestelle |

Kleiner als der Editor. Der Wikipedia-Teil ist ein halber Tag, der Rest ist die Route.

## Offen

- **Fließt nachgelesenes Material in die Fragen ein?** Sonst ist die Seite eine Sackgasse.
  Vorschlag: ja, aber der Runden-Agent weiß, was nachgelesen ist, und für den Kapitelstand
  zählt es nicht.
- **Wikipedia ist für Klasse 6 zu schwer.** Klexikon deckt nicht jedes Thema ab. Alternative:
  den Entwurf auf die Klassenstufe schreiben lassen (`classes.grade`) — dann steht im Heft
  eine Vereinfachung von der KI, mit allem, was daran schiefgehen kann.
- **Ein neuer Empfänger außerhalb.** Die Anfrage geht von unserem Server an Wikimedia (USA),
  ohne Pseudonym und ohne die IP des Kindes. Gehört trotzdem in DSFA und Einwilligung.
- **Freischalten je Klasse** (`classes.recherche`, Standard aus)? Ob Nachlesen erwünscht ist,
  entscheidet der Unterricht, nicht die App.
