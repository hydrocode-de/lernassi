# KI-Verordnung (EU AI Act) — was für lernassi gilt

> **Kein Rechtsrat.** Arbeitsstand für die Entwicklung, damit die Kennzeichnungs- und
> Transparenzpflichten nicht erst beim Pilot auffallen. Für den Pilot an der Schule
> braucht es weiterhin die schulische Datenschutzbeauftragte und ggf. anwaltliche Prüfung.
>
> **Quellenlage:** Die Primärtexte (EUR-Lex, Kommissionsseiten) waren aus der
> Entwicklungsumgebung nicht abrufbar (Egress-Policy, HTTP 403). Der Stand unten stützt
> sich auf übereinstimmende Sekundärquellen (Kanzlei- und Behördenveröffentlichungen,
> siehe Quellen am Ende). Vor einer belastbaren Entscheidung im Originaltext gegenlesen.
>
> Stand: 1. August 2026

## Die zwei Verordnungen

- **KI-VO / AI Act** — Verordnung (EU) 2024/1689.
- **Digital Omnibus on AI** — Verordnung (EU) 2026/1744, im Amtsblatt am 24.7.2026,
  in Kraft seit 27.7.2026. Ändert über 40 Artikel der KI-VO, vor allem die Fristen.
  Politische Einigung war am 7.5.2026 — Ratgeber, die davor entstanden sind, nennen
  noch die alten Termine.

## Zeitleiste

| Datum | Was |
|---|---|
| 2.2.2025 | Verbotene Praktiken (Art. 5), KI-Kompetenz (Art. 4) — **gilt schon** |
| 2.8.2025 | GPAI-Pflichten, Governance, Sanktionsrahmen |
| **2.8.2026** | **Transparenzpflichten Art. 50 — vom Omnibus NICHT verschoben** |
| 2.12.2026 | Ende der Übergangsfrist für Art. 50 Abs. 2 bei Systemen, die vor dem 2.8.2026 in Verkehr waren |
| **2.12.2027** | Hochrisiko-Pflichten für eigenständige Anhang-III-Systeme (vorher 2.8.2026) |
| 2.8.2028 | Hochrisiko für in Produkte eingebettete KI (Anhang I) |

Der Omnibus hat die **Hochrisiko**-Pflichten um 16 Monate verschoben, die
**Transparenzpflichten aus Art. 50 aber nicht.** Für lernassi heißt das: das, was morgen
greift, ist die Kennzeichnung — nicht die große Konformitätsbewertung.

Bußgeldrahmen für Verstöße gegen Art. 50 ab 2.8.2026: bis 15 Mio. € oder 3 % des
weltweiten Jahresumsatzes.

## Wo lernassi steht

**Rolle:** lernassi ist **Anbieter** eines KI-Systems (eigenes System auf einem
Fremdmodell über Requesty). Die Schule, die es einsetzt, ist **Betreiber**. Beide Rollen
haben eigene Pflichten; die Anbieterpflichten aus Art. 50 Abs. 1 und 2 treffen uns.

**Einstufung:** Anhang III Nr. 3 Buchst. b erfasst KI-Systeme zur *„Bewertung von
Lernergebnissen, auch wenn diese Ergebnisse zur Steuerung des Lernprozesses verwendet
werden"*. Genau das tut lernassi: Punkte je Frage → Kategorie („sitzt/wackelt") →
Lernplan und Warteschlange. Damit ist es **voraussichtlich Hochrisiko ab 2.12.2027**.

Die Ausnahme in Art. 6 Abs. 3 (kein erhebliches Risiko, nur vorbereitende/enge Aufgabe)
dürfte nicht greifen: sie ist ausgeschlossen, wenn das System **Profiling** betreibt, und
die fortlaufende Leistungsbewertung eines Kindes ist genau das. Wer die Ausnahme dennoch
für sich in Anspruch nimmt, muss das **vor** der Inbetriebnahme dokumentieren und das
System registrieren (Art. 6 Abs. 4, Art. 49 Abs. 2).

**Forschungsausnahme (Art. 2):** Solange nur entwickelt und getestet wird, greift die
Verordnung nicht. Sobald das System an der Schule *in Betrieb genommen* wird — echte
Kinder, echter Unterricht — ist es in Anwendung. Ein Pilot ist keine Ausnahme.

## Was schon gilt (seit 2.2.2025)

**Art. 5 Abs. 1 Buchst. f — Emotionserkennung in Bildungseinrichtungen ist verboten.**
Gemeint ist das Ableiten von Emotionen aus **biometrischen** Daten (Gesicht, Stimme,
Haltung, Puls, Blick). Ausnahmen nur aus medizinischen oder Sicherheitsgründen.

Für lernassi: die Selbsteinschätzung (`confidenceBefore`, `mirrorReaction`, `selfAfter`)
ist eine **eigene Aussage des Kindes**, keine biometrische Ableitung — unproblematisch.
Die Grenze, die nicht überschritten werden darf: aus Fotos, Tippverhalten, Antwortzeiten
oder Formulierungen auf Stimmung, Motivation oder Konzentration schließen. Auch nicht als
„Engagement-Analyse" verpackt. Das wäre verboten, nicht nur hochriskant.

**Art. 4 — KI-Kompetenz.** Vom Omnibus abgeschwächt: „fördern" statt „sicherstellen",
kein garantiertes Kompetenzniveau je Person. Bleibt aber eine Pflicht — für den Pilot
heißt das eine kurze Einweisung der Lehrkräfte, kein Zertifikatsprogramm.

## Kennzeichnungspflichten ab morgen (Art. 50)

### K1 · Art. 50 Abs. 1 — Hinweis, dass man mit einer KI spricht

Anbieter müssen KI-Systeme, die **für die direkte Interaktion mit natürlichen Personen**
bestimmt sind, so gestalten, dass die Person erfährt, dass sie mit einer KI interagiert.
Ausnahme nur, wenn das für eine „angemessen informierte, aufmerksame und verständige
Person" offensichtlich ist.

Die Kommissions-Leitlinien (20.7.2026) legen diese Ausnahme **eng** aus: allgemeine
Vertrautheit mit Chatbots genügt nicht. **Bei Kindern und anderen schutzbedürftigen
Gruppen gelten strengere Anforderungen** — der Hinweis muss für Laien verständlich sein.
Für eine Grundschul-/Sekundarstufen-App ist die Ausnahme also praktisch nicht verfügbar.

### K2 · Art. 50 Abs. 2 — maschinenlesbare Kennzeichnung erzeugter Inhalte

Anbieter von KI-Systemen, die **synthetische Audio-, Bild-, Video- oder Textinhalte**
erzeugen, müssen sicherstellen, dass die Ausgaben **in einem maschinenlesbaren Format**
als künstlich erzeugt oder manipuliert gekennzeichnet und erkennbar sind. Die Technik ist
nicht vorgeschrieben: Wasserzeichen, Metadaten, Provenance-/Signaturverfahren,
Fingerprinting, Protokollierung.

Ausnahme: soweit das System nur eine **Hilfsfunktion für die Standardbearbeitung**
erfüllt oder die Eingabedaten **nicht wesentlich verändert** (Rechtschreibkorrektur,
Formatierung).

Offene Auslegungsfrage, die für uns zählt: ob rein **interne, nicht verbreitete** Inhalte
erfasst sind. Ein Teil der Literatur nimmt sie aus, eindeutig geklärt ist es nicht. Für
lernassi ist die Lage gemischt:

- **Klar synthetisch:** Zusammenfassungen, Fragen, Rückmeldungen, Plan-Aufträge,
  Kapitel-/Themen-Titel, interne Beurteilung.
- **Eher Abschrift als Erzeugung:** das Transkript des Hefts — es gibt die Eingabe wieder,
  statt Neues zu erfinden. Argumentierbar unter der Ausnahme, aber nicht sicher.

Die pragmatische Linie: alles, was aus einem Modellaufruf stammt, an der Quelle als
KI-erzeugt markieren und die Markierung mitspeichern. Das ist billiger als die
Abgrenzung im Einzelfall und trägt auch, wenn später exportiert wird.

Ein **freiwilliger Verhaltenskodex** („Code of Practice on Transparency of AI-generated
Content", final am 10.6.2026) beschreibt anerkannte Verfahren und ist der naheliegende
Bezugspunkt, um die Umsetzung zu begründen.

### K3 · Art. 50 Abs. 5 — Zeitpunkt und Form

Die Information nach Abs. 1–4 muss **spätestens bei der ersten Interaktion** vorliegen,
**klar und unterscheidbar**, und die Barrierefreiheitsanforderungen erfüllen.

Konkret heißt das:

- Nicht erst im Impressum, in den Nutzungsbedingungen oder in einem Untermenü.
- An der Stelle, an der die Interaktion stattfindet, in normaler Sprache und lesbarer Größe.
- Für Screenreader zugänglich — ein Bild ohne Textalternative genügt nicht.
- Gilt für **jede** erste Interaktion einer Person, nicht nur für die allererste überhaupt.

### Nicht einschlägig

- **Art. 50 Abs. 3** (Emotionserkennung, biometrische Kategorisierung) — machen wir nicht,
  und in Bildungseinrichtungen wäre es ohnehin nach Art. 5 verboten.
- **Art. 50 Abs. 4** (Deepfakes; KI-Texte zu Themen von öffentlichem Interesse) — lernassi
  veröffentlicht nichts.

## Später (ab 2.12.2027, wenn Hochrisiko)

Kein Handlungsbedarf morgen, aber es bestimmt, wohin die Architektur wachsen muss:

- **Art. 16 Buchst. b** — Name/Handelsname und Anschrift des Anbieters am System oder in
  der Begleitdokumentation.
- **Art. 48** — CE-Kennzeichnung; bei rein digital bereitgestellten Systemen als
  **digitale CE-Kennzeichnung**, leicht erreichbar über die Oberfläche oder einen
  maschinenlesbaren Code.
- **Art. 47** — EU-Konformitätserklärung. **Art. 49** — Registrierung in der EU-Datenbank
  vor Inbetriebnahme.
- **Art. 13** — Transparenz gegenüber der Lehrkraft und Betriebsanleitung mit
  vorgeschriebenem Inhalt.
- **Art. 14** — menschliche Aufsicht. Die Lehrkraft muss eingreifen können; das
  Fortschrittsbild ist dafür der Ansatzpunkt.
- **Art. 26 Abs. 11** — der **Betreiber** (Schule) muss die betroffenen Personen
  informieren, dass ein Hochrisiko-KI-System auf sie angewendet wird. Das Produkt muss
  das ermöglichen, nicht die Lehrkraft improvisieren lassen.
- **Art. 27** — Grundrechte-Folgenabschätzung (FRIA) für Betreiber, die öffentliche
  Stellen sind. Eine staatliche Schule ist das.
- **Art. 86** — Recht auf Erläuterung der Einzelfallentscheidung. Kind bzw. Eltern können
  verlangen zu erfahren, wie ein Ergebnis zustande kam.

## Stellen im Code

Die Zuordnung der Pflichten zu konkreten Dateien steht in [`AI-ACT-STELLEN.md`](AI-ACT-STELLEN.md).

## Quellen

- [Digital Omnibus on AI tritt in Kraft (Lewis Silkin, 27.7.2026)](https://www.lewissilkin.com/insights/2026/07/27/the-digital-omnibus-on-ai-enters-into-force-today-102nedo)
- [Verordnung (EU) 2026/1744 im Amtsblatt (NicFab)](https://www.nicfab.eu/en/posts/digital-omnibus-ai-official-journal/)
- [Art. 50 gilt unverändert ab August — verschoben wurde eine andere Frist (KI-Lagebild)](https://talmeier.de/blog/2026/07/09/die-anforderung-des-art-50-eu-ai-act-gelten-unveraendert-ab-august-verschoben-wurde-eine-andere-frist/)
- [Article 50 transparency deadline 2 August 2026 (aiactblog.nl)](https://www.aiactblog.nl/en/posts/article-50-transparency-deadline-2-august-2026)
- [2. August oder 2. Dezember? Die Frist hängt am KI-System (adsimple)](https://www.adsimple.at/ai-act-frist-ki-kennzeichnung-august-dezember-oesterreich/)
- [KI-VO: neue Übergangsfristen und deutsche Marktaufsicht (CMS)](https://cms.law/de/deu/publication/2026-themen-die-sie-bewegen-werden/ki-vo-neue-uebergangsfristen-und-deutsche-marktaufsicht)
- [Digital Omnibus on AI: Neue Fristen (TÜV Rheinland Consulting)](https://consulting.tuv.com/aktuelles/ki-im-fokus/digital-omnibus-ki-verordnung-fristen)
- [EU AI Act: KI-Omnibus justiert Artikel 4 neu (KI-Campus)](https://ki-campus.org/blog/eu-ai-act-ki-omnibus-justiert-artikel-4-neu-ki-kompetenz-bleibt-pflicht)
- [Transparenzpflichten Art. 50 (RTR KI-Servicestelle)](https://www.rtr.at/rtr/service/ki-servicestelle/ai-act/Transparenzpflichten.de.html)
- [Kommission veröffentlicht finalen Code of Practice zu KI-Kennzeichnung (Jones Day, 6/2026)](https://www.jonesday.com/en/insights/2026/06/european-commission-publishes-final-code-of-practice-on-marking-and-labelling-aigenerated-content)
- [Leitlinien der Kommission zu Art. 50 (Greenberg Traurig)](https://www.gtlaw.com/en/insights/2026/6/deepfakes-chatbots-ai-generated-text-european-commission-details-transparency-obligations-under-the-ai-act)
- [Verbotene Praktiken, Art. 5 (Bundesnetzagentur)](https://www.bundesnetzagentur.de/DE/Fachthemen/Digitales/KI/8_VerbotenePraktiken/start.html)
- [Anhang III KI-VO (buzer.de)](https://www.buzer.de/III_KI-VO.htm)
- [Hochrisiko-KI im Bildungskontext (datenschutz-schule.info, 17.7.2026)](https://datenschutz-schule.info/2026/07/17/was-genau-sind-eigentlich-hochrisiko-ki-systeme-im-bildungskontext/)
