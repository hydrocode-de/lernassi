/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

// Der Service Worker sitzt zwischen App und Netz. Er hat hier genau zwei Aufgaben:
// die App soll sofort starten, und sie soll bei wackligem Netz nicht wegbrechen.
//
// Was er NICHT tut: Seiteninhalte speichern. Auf einem Familien- oder Klassen-Tablet
// hätte sonst der Nächste die Namen und Lernstände des Vorherigen auf der Platte.
// Gecacht wird ausschließlich, was ohnehin für alle gleich ist: das Gerüst.

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Pro Version ein eigener Cache. Beim Aktivieren fliegen alle anderen raus —
// so kann niemand nach einem Deploy auf einer alten Fassung sitzen bleiben.
const CACHE = `lernassi-${version}`;
const OFFLINE = '/offline.html';

// build = die gehashten Dateien aus dem Bau, files = alles aus static/.
// Beide ändern bei jeder Änderung ihren Namen bzw. die Version, sind also
// unveränderlich und dürfen bedenkenlos von der Platte kommen.
//
// Ausgenommen sind die Zeichen mit der „staging"-Binde: in static/ liegen beide
// Fassungen, gebraucht wird je Instanz nur eine, und welche das ist, weiß hier im
// Browser niemand. Sie fehlen im Vorrat nicht — das Betriebssystem holt sie beim
// Einrichten auf dem Startbildschirm ohnehin frisch, und dabei ist man online.
const vorrat = [...build, ...files.filter((pfad) => !pfad.includes('-staging.'))];
const imVorrat = new Set(vorrat);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(vorrat);
			// Nicht warten, bis alle Tabs zu sind — die neue Fassung soll sofort gelten.
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const name of await caches.keys()) {
				if (name !== CACHE) await caches.delete(name);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;

	// Alles, was etwas verändert, geht uns nichts an.
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	// Gerüst, Schriften, Bilder: von der Platte. Das ist der Sofortstart.
	if (imVorrat.has(url.pathname)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE);
				return (await cache.match(url.pathname)) ?? fetch(request);
			})()
		);
		return;
	}

	// Seitenaufrufe: immer frisch aus dem Netz, nichts davon wird gespeichert.
	// Nur wenn gar keine Verbindung da ist, kommt die Offline-Seite.
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					return await fetch(request);
				} catch {
					const cache = await caches.open(CACHE);
					return (await cache.match(OFFLINE)) ?? Response.error();
				}
			})()
		);
		return;
	}

	// Alles Übrige — Daten beim Weiterklicken, die Antworten des Tutors —
	// läuft unberührt am Worker vorbei.
});

export {};
