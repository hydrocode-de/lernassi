// Die Sätze, mit denen lernassi sagt, dass es eine KI ist — an einer Stelle, damit an
// allen Einstiegen dasselbe steht. Dieselbe Überlegung wie bei den Lernstands-Wörtern in
// `kategorie.ts`: der Text gehört ins lib, das Rendern auf die Seite.
//
// Warum es sie überhaupt gibt: Art. 50 Abs. 1 KI-VO verlangt, dass eine Person erfährt,
// dass sie mit einer KI interagiert; Abs. 5 verlangt das SPÄTESTENS bei der ersten
// Interaktion, klar und laienverständlich. Die Ausnahme „ist doch offensichtlich" legen
// die Kommissions-Leitlinien eng aus und bei Kindern besonders eng — für uns also nicht
// verfügbar. Siehe AI-ACT.md.
//
// Ton: lernassi spricht mit dem Kind in der Ich-Form („Ich lese deine Seiten"). Der
// Hinweis bricht das nicht — er sagt in derselben Stimme, wer da spricht.

/** Vor dem Fotografieren. Die früheste Stelle: hier verlässt eine Heftseite das Gerät. */
export const KI_AUFNEHMEN =
	'Ich bin eine KI – ein Computerprogramm. Ich lese deine Seiten und schreibe auf, worum es geht.';

/** Im Vorspann vor einer Einordnungsrunde. */
export const KI_EINORDNUNG =
	'Die Fragen denke ich mir als KI aus – ein Computerprogramm, aus deinem eigenen Heft. Manchmal liege ich daneben.';

/** Oben in der Übung. Üben hat keinen Vorspann, darum steht es auf der Seite selbst. */
export const KI_UEBEN =
	'Die Fragen kommen von mir als KI – einem Computerprogramm. Manchmal liege ich daneben.';

/** Oben im Gespräch. Hier ist der Hinweis am wenigsten verzichtbar: ein Gespräch ist genau
 *  die Form, bei der die Ausnahme „ist doch offensichtlich" am ehesten versucht würde — und
 *  bei Kindern legen die Kommissions-Leitlinien sie besonders eng aus. */
export const KI_GESPRAECH =
	'Ich bin eine KI – ein Computerprogramm. Ich stelle dir Fragen und gehe auf deine Antworten ein. Manchmal liege ich daneben.';

/** Über den Ergebnissen einer Fotosession und auf der Seite eines Aufschriebs. */
export const KI_AUFSCHRIEB =
	'Diesen Text hat eine KI aus deinen Seiten gelesen und geschrieben. Die Fotos sind deine.';

/** Im Editor, in dem das Kind eine Seite selbst tippt. Der Text ist seiner — die
 *  Zusammenfassung nicht, und genau diese Grenze muss vorher klar sein. */
export const KI_SCHREIBEN =
	'Ich bin eine KI – ein Computerprogramm. Was du schreibst, bleibt genau so stehen; ich fasse es nur zusammen und suche die wichtigen Begriffe.';

/** Auf der Recherche-Seite. Sagt zwei Dinge: dass hier eine KI arbeitet, und dass sie es
 *  nicht aus sich selbst tut — sie liest in Seiten nach, die die Lehrkraft freigegeben hat. */
export const KI_RECHERCHE =
	'Ich bin eine KI – ein Computerprogramm. Ich lese in geprüften Lernseiten nach und schreibe dir einen Entwurf. Was davon in dein Heft kommt, entscheidest du.';

/** Auf der Seite eines selbst getippten Aufschriebs. Gegenstück zu `KI_AUFSCHRIEB`: hier ist
 *  nur die Zusammenfassung erzeugt, die Abschrift stammt vom Kind. */
export const KI_ZUSAMMENFASSUNG =
	'Die Zusammenfassung und die Begriffe hat eine KI aus deinem Text gemacht. Der Text ist deiner.';

/** Was am einzelnen Stück steht, wo ein ganzer Abschnitt zu viel wäre — etwa an der Frage. */
export const KI_MARKE = 'KI';

// Maschinenlesbare Kennzeichnung nach Art. 50 Abs. 2: die Ausgabe muss in einem
// maschinenlesbaren Format als künstlich erzeugt erkennbar sein. Ein sichtbares Abzeichen
// allein genügt dafür nicht. Das Attribut kostet nichts und trägt beides.
//
// Ob Abs. 2 für Inhalte gilt, die nie verbreitet werden, ist ungeklärt (AI-ACT.md). Zu
// diesem Preis wird darauf nicht gewettet.
export const kiErzeugt = { 'data-ki-erzeugt': 'true' } as const;
