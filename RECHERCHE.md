# Nachlesen (Recherche) — Entwurf, noch nicht gebaut

> Oberfläche: `design-system/patterns/recherche.html` (Kind) und
> `design-system/patterns/recherche-quellen.html` (Lehrkraft).

## Warum

Der Editor (`/schueler/schreiben`) setzt voraus, dass das Kind den Inhalt schon hat. Bei Heft
vergessen, krank gewesen, nicht mitgekommen ist genau das nicht so — dann steht es vor einem
leeren Feld. Der Ausweg, den es heute nimmt, ist ChatGPT im anderen Tab. Der Unterschied hier:
es steht dran, woher der Text kommt, es sind Seiten, die die Lehrkraft freigegeben hat, und im
Heft landet nur, was das Kind übernimmt.

## Das Werkzeug

Ein Werkzeug pro Quelle, eine Aufgabe: **Thema rein, Artikel raus.**

```ts
// src/lib/server/recherche.ts
const klexikon = tool({
  description: 'Sucht im Klexikon (für Kinder erklärt, einfache Sprache) und holt den Artikel.',
  inputSchema: z.object({ thema: z.string() }),
  execute: async ({ thema }) => {
    // MediaWiki: action=query&list=search&srsearch=<thema>  →  Titel
    //            action=query&prop=extracts&explaintext=1   →  Text
    return { titel, text: text.slice(0, 8000), url };
  }
});
```

Kein Schlüssel, keine Kosten. Wikimedia will nur einen `User-Agent` mit Kontaktadresse.

Damit ist die „Whitelist" nichts, was man pflegen muss: **das Modell kann keine Adresse
aufrufen, weil es kein Werkzeug dafür hat.** Es kann `klexikon({thema})` rufen,
`zumUnterrichten({thema})`, `wikipedia({thema})` — sonst nichts. Neue Quelle = neues Werkzeug.

Eine **freie URL-Eingabe kommt nicht rein**, und zwar nicht aus Vorsicht, sondern weil sie das
Gegenteil davon wäre: dann liest lernassi beliebige Seiten, und keiner weiß mehr, was drin
stand.

**MCP braucht es dafür nicht.** MCP ist das Protokoll, mit dem ein *fremder* Prozess Werkzeuge
anbietet. Der Modellaufruf läuft in unserem eigenen Server — das Werkzeug ist einfach eine
Funktion am AI-SDK-Aufruf (`tools: { klexikon, … }`). Ein eigener MCP-Server für ein `fetch`
wären zwei Prozesse mehr für nichts. Wenn dieselben Werkzeuge später auch anderswo hängen
sollen, exportiert man dieselbe Funktion zusätzlich als MCP-Server, ohne hier etwas zu ändern.

## Die Quellen — Ergebnis der Recherche

Sortiert nach dem, was für ein Gymnasium taugt. **Wikipedia steht immer unten:** sie findet
fast alles, ist aber für die Mittelstufe oft zu schwer und niemandes Lehrwerk.

| # | Quelle | API | Lizenz | Wofür |
|---|---|---|---|---|
| 1 | **Klexikon** `klexikon.zum.de` | MediaWiki, Volltext ✔ *(live geprüft)* | CC BY-SA | Einstieg, einfache Sprache. Reicht für Klasse 5–7, darüber oft zu knapp. |
| 2 | **ZUM Unterrichten** `unterrichten.zum.de` | MediaWiki, Volltext ✔ *(live geprüft)* | CC BY-SA | Von Lehrkräften geschrieben, quer über die Fächer, **auf Schulniveau** — der beste Treffer für die Sek I. |
| 3 | **Serlo** `de.serlo.org` | öffentliche GraphQL-API (`api.serlo.org`) | CC BY-SA | MINT: sehr stark in Mathe, dazu Bio, Chemie, Informatik; mit Abituraufgaben. Serlo bittet um Kontakt vor produktiver Nutzung. |
| 4 | **Wikibooks / Wikisource** | MediaWiki, Volltext | CC BY-SA | Schulbuchartiges bzw. Quellentexte (Geschichte, Deutsch). Nachrangig, sehr ungleichmäßig. |
| 5 | **LEIFIphysik** `leifiphysik.de` | keine | CC BY-**NC** | Das beste Physik-Portal fürs Gymnasium (Klasse 5 bis Abitur, nach Bundesland) — aber ohne Schnittstelle, und NC passt nicht zu einem Betrieb über eine Firma. **Nur verlinken.** |
| 6 | **bpb.de** | keine | meist CC BY-NC-**ND** | Politik/Zeitgeschichte, redaktionell geprüft. ND verbietet Bearbeitungen — eine Zusammenfassung *ist* eine Bearbeitung. **Nur verlinken.** |
| 7 | **Wikipedia** `de.wikipedia.org` | MediaWiki, Volltext | CC BY-SA | Letzter Rückfall, wenn oben nichts Passendes stand. |

Zwei Sachen, die ich unterwegs verworfen habe:

- **MUNDO / SODIX, WirLernenOnline, ELIXIER** sind die offiziellen OER-Sucher der Länder. Sie
  liefern aber **Metadaten zu Material** (PDFs, Videos, Arbeitsblätter), keinen lesbaren
  Artikeltext, und der Zugang läuft über Partnerschaft/Anmeldung. Als „Fundstelle zum
  Weiterklicken" später interessant, für einen Entwurf nutzlos.
- **DWDS** (Wörterbuch) hat seit Mai 2026 die Korpus-API für automatisierten Zugriff
  geschlossen; übrig bleiben Wortexistenz und Häufigkeit. Für Deutsch also kein Textlieferant.

Das Muster dahinter: **die brauchbaren Quellen sind Wikis.** Ein MediaWiki-Adapter deckt
Klexikon, ZUM, Wikibooks, Wikisource und Wikipedia ab — fünf Quellen, eine Funktion mit
wechselnder Basis-URL. Serlo ist der einzige Sonderfall, der eigenen Code braucht. Die guten
Fachportale (LEIFI, bpb) sind an ihrer Lizenz zu erkennen, nicht an fehlender Technik: NC und
ND verbieten genau das, was wir tun wollen.

## Die Lehrkraft gibt frei

In den Einstellungen der Lehrkraft, **je Klasse**, Standard: Nachlesen aus. Pro Quelle ein
Schalter; die Reihenfolge ist fest (nicht sortierbar), lernassi fragt von oben nach unten.
Quellen, aus denen wegen NC/ND nicht geschrieben werden darf, sind als „nur Link" gekennzeichnet
— sie erscheinen im Entwurf höchstens als Hinweis „schau auch hier".

```ts
classes.recherche       // 0 | 1 — der Knopf beim Kind
classes.rechercheQuellen // JSON: ['klexikon','zum','serlo','wikipedia']
```

Warum je Klasse und nicht global: ob nachgelesen werden darf, ist eine Entscheidung über den
Unterricht. In Klasse 6 kann die Antwort anders sein als im Leistungskurs.

## Der Agent sagt, was er tut

Der mittlere Bildschirm im Mockup ist der wichtigste. Kein Ladebalken, sondern Sätze:

```
✓ Ich suche im Klexikon nach „Wiener Kongress".
✓ Gefunden. Der Artikel ist kurz – ich lese ihn ganz.
✓ Was 1815 beschlossen wurde, steht dort nicht genau genug für Klasse 9.
⟳ Ich schaue bei ZUM Unterrichten nach.
· Dann schreibe ich deinen Entwurf.
```

Drei Gründe, warum das nicht Deko ist: es ist die Erklärung, **warum** eine Quelle nicht
gereicht hat (das ist Recherchekompetenz, und sie ist hier beiläufig zu haben); es macht die
Wartezeit erträglich, ohne zu lügen; und es ist die ehrlichste Form von Kennzeichnung — das
Kind sieht die Arbeit, nicht nur das Ergebnis.

**Technisch schon vorhanden.** `welle/+server.ts` und `gespraech/[id]/zug/+server.ts` streamen
NDJSON, eine JSON-Zeile je Ereignis. Dasselbe hier:

```
{"t":"schritt","v":"Ich suche im Klexikon nach „Wiener Kongress"."}
{"t":"schritt","v":"Gefunden. Der Artikel ist kurz – ich lese ihn ganz."}
{"t":"entwurf","v":{…}}
```

Die Schritte entstehen nicht aus Rohdaten der Werkzeugaufrufe, sondern der Agent formuliert sie
selbst mit: jeder Werkzeugaufruf bekommt im Schema ein Feld `warum` („was du gerade tust, ein
Satz, an das Kind gerichtet"). Damit steht dort ein Grund und kein Protokoll.

## Der Ablauf

```
Editor: „Ich weiß noch nicht genug – nachlesen"
   → Thema eingeben (vorbelegt mit dem Kapiteltitel)
   → ein Modellaufruf MIT Werkzeugen, 2–4 Schritte, Schritte werden gestreamt
   → Entwurf: Titel, Text, Zusammenfassung, Begriffe, benutzte Quellen
   → im Editor änderbar → „In mein Heft" speichert als nachgelesene Seite
```

Die Stelle im Verzeichnis (`kapitel`, `nach`) läuft durch wie beim Editor.

## Drei Dinge, die dranhängen

**Der Entwurf wird nicht gespeichert.** Er kommt in dasselbe Textfeld, in dem das Kind sonst
selbst schreibt. Gespeichert wird erst beim Übernehmen — im Heft steht nie etwas, das das Kind
nicht gelesen hat.

**Nachgelesen ist nicht Unterricht.** `notes.herkunft = 'recherche'` (dritter Wert neben `foto`
und `selbst`), im Verzeichnis ein Zeichen, Quelle und Lizenz am Aufschrieb — CC BY-SA verlangt
die Nennung. Am Entwurf steht: *was deine Lehrkraft gesagt hat, zählt mehr.*

**Der Artikeltext ist Fremdtext.** Wikis sind offen editierbar, da kann Unsinn oder eine
Anweisung drinstehen. Was dagegen trägt: das Modell hat außer „Artikel holen" kein Werkzeug,
die Ausgabe ist ein festes Schema, und sie geht durch ein Kind, das sie liest.

## Was zu bauen wäre

| Stelle | Was |
|---|---|
| `src/lib/server/recherche.ts` | MediaWiki-Adapter (fünf Quellen, eine Funktion), Serlo separat, ein Modellaufruf mit Werkzeugen |
| `src/routes/schueler/recherche/+page.*` + `strom/+server.ts` | die drei Zustände, NDJSON wie bei der Welle |
| `schueler/schreiben/+page.*` | Knopf hin, Entwurf als Vorbelegung zurück |
| `lehrer/klasse/[id]` | Schalter je Quelle |
| `schema.ts` + Migration | `herkunft='recherche'`, Quellen am Aufschrieb, `classes.recherche{,Quellen}` |
| `src/lib/ki.ts`, `AI-ACT-STELLEN.md` | Hinweistext, neue Anzeigestelle |

Der MediaWiki-Teil ist ein halber Tag, weil er einmal für fünf Quellen gilt. Der Rest ist die
Route und der Schalter bei der Lehrkraft.

## Offen

- **Fließt nachgelesenes Material in die Fragen ein?** Sonst ist die Seite eine Sackgasse.
  Vorschlag: ja, aber der Runden-Agent weiß, was nachgelesen ist, und für den Kapitelstand
  zählt es nicht.
- **Niveau.** Klexikon ist zu leicht, Wikipedia zu schwer, ZUM trifft es — deckt aber nicht
  jedes Thema ab. Der Agent kennt `classes.grade`; ob er den Entwurf auf die Klassenstufe
  herunterschreiben soll, ist eine echte Entscheidung: dann steht im Heft eine Vereinfachung
  von der KI, mit allem, was daran schiefgehen kann.
- **LEIFI und bpb** wären inhaltlich die besten Quellen fürs Gymnasium und sind lizenzrechtlich
  zu. Fragen kostet nichts: beide Häuser sind gemeinnützig, und für ein Schulprojekt ist eine
  Ausnahme denkbar. Das ist eine Mail, kein Code.
- **Ein neuer Empfänger außerhalb.** Die Anfrage geht von unserem Server an Wikimedia (USA) bzw.
  ZUM/Serlo (Deutschland), ohne Pseudonym und ohne die IP des Kindes. Gehört trotzdem in DSFA
  und Einwilligung.
