import { env } from '$env/dynamic/private';

// Welche der beiden Instanzen läuft hier? Gebraucht wird das bisher nur für das Zeichen
// der App: auf dem Startbildschirm eines Beta-Tablets stehen Dev und Produktion
// nebeneinander, und ohne Unterschied tippt irgendwann jemand auf die falsche.
//
// Abgelesen wird es an der Adresse, unter der die Instanz von außen heißt. Die steht auf
// dem Server ohnehin schon richtig — ohne sie scheitert jede Formularabsendung an der
// Origin-Prüfung (siehe DEPLOY.md) —, also gibt es keinen zweiten Wert, den man
// vergessen kann. Wer es doch ausdrücklich sagen will, setzt LERNASSI_UMGEBUNG auf
// `staging` oder `produktion`; das schlägt die Adresse.
//
// Im Zweifel gilt Produktion: ein Produktions-Zeichen auf Dev ist ärgerlich, ein
// Staging-Zeichen bei den Kindern wäre peinlich.
export function istStaging(): boolean {
	const gesagt = env.LERNASSI_UMGEBUNG?.trim().toLowerCase();
	if (gesagt) return gesagt !== 'produktion' && gesagt !== 'production';

	const adresse = env.ORIGIN || env.BETTER_AUTH_URL;
	if (!adresse) return false;
	try {
		return new URL(adresse).hostname.startsWith('dev.');
	} catch {
		return false;
	}
}
