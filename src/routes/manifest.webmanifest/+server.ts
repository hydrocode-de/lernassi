import { istStaging } from '$lib/server/umgebung';
import type { RequestHandler } from './$types';

// Das Manifest lag früher als feste Datei in static/. Es kommt jetzt von hier, weil erst
// zur Laufzeit feststeht, ob diese Instanz die Produktion oder Dev ist — und beide
// bauen aus demselben Stand dasselbe Abbild. Ein Bau-Schalter würde also verlangen, dass
// man auf dem Server zwei verschiedene Images auseinanderhält.

const zeichen = (staging: boolean) => {
	const s = staging ? '-staging' : '';
	return [
		{ src: `/icon-192${s}.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
		{ src: `/icon-512${s}.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
		{
			src: `/icon-maskable-192${s}.png`,
			sizes: '192x192',
			type: 'image/png',
			purpose: 'maskable'
		},
		{
			src: `/icon-maskable-512${s}.png`,
			sizes: '512x512',
			type: 'image/png',
			purpose: 'maskable'
		},
		{ src: staging ? '/icon-staging.svg' : '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
	];
};

export const GET: RequestHandler = async () => {
	const staging = istStaging();

	const manifest = {
		name: staging ? 'lernassi staging' : 'lernassi',
		// Unter dem Zeichen auf dem Startbildschirm ist nach gut zwölf Zeichen Schluss.
		// „lernassi staging" würde dort abgeschnitten und sähe wieder aus wie lernassi.
		short_name: staging ? 'staging' : 'lernassi',
		description: 'KI-Lernassistent für selbstwirksames Lernen',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: '#fbfaf7',
		theme_color: '#fbfaf7',
		lang: 'de',
		icons: zeichen(staging)
	};

	return new Response(JSON.stringify(manifest, null, '\t'), {
		headers: {
			'content-type': 'application/manifest+json',
			// Nicht auf Vorrat behalten: sonst hinge nach einem Umzug zwischen den
			// Instanzen tagelang das falsche Zeichen im Browser.
			'cache-control': 'no-cache'
		}
	});
};
