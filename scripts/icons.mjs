// Aus den SVGs in static/ die PNGs daneben erzeugen.
//
// Die SVGs sind die Vorlage, die PNGs sind abgeleitet — sie liegen trotzdem im Repo,
// weil iOS und Android beim Einrichten auf dem Startbildschirm PNG verlangen und weil
// der Bau im Docker sonst einen Rasterer bräuchte, den er nur dafür bräuchte.
//
// Deshalb hängt `sharp` auch nicht in package.json. Einmal, wenn sich ein Zeichen
// ändert:
//
//   npm i --no-save sharp && node scripts/icons.mjs
//
// Ausgeführt wird das von Hand, das Ergebnis wird eingecheckt. Wer es vergisst, sieht
// es sofort: das SVG ist neu, das PNG nicht.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const STATIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static');

// Der Hintergrund, auf den die undurchsichtigen Zeichen gelegt werden. Android setzt
// unter ein PNG mit Alpha sonst Weiß — und der helle Lavendel ist Teil des Zeichens.
const GRUND = '#ccccf8';

// [Vorlage, Ziel, Kantenlänge, durchsichtig?]
const zeichen = [
	['icon.svg', 'icon-192.png', 192, false],
	['icon.svg', 'icon-512.png', 512, false],
	['icon.svg', 'apple-touch-icon.png', 180, false],
	['icon-maskable.svg', 'icon-maskable-192.png', 192, false],
	['icon-maskable.svg', 'icon-maskable-512.png', 512, false],
	['favicon.svg', 'favicon-32.png', 32, true],

	// Dieselben noch einmal mit der Binde — sie gehen auf die Dev-Instanz.
	['icon-staging.svg', 'icon-192-staging.png', 192, false],
	['icon-staging.svg', 'icon-512-staging.png', 512, false],
	['icon-staging.svg', 'apple-touch-icon-staging.png', 180, false],
	['icon-maskable-staging.svg', 'icon-maskable-192-staging.png', 192, false],
	['icon-maskable-staging.svg', 'icon-maskable-512-staging.png', 512, false],
	['favicon-staging.svg', 'favicon-32-staging.png', 32, true]
];

for (const [vorlage, ziel, groesse, durchsichtig] of zeichen) {
	// Erst groß rastern, dann verkleinern: rastert man direkt auf 32 px, werden die
	// Schrägen der Karten stufig, weil librsvg dann auf dem groben Raster zeichnet.
	let bild = sharp(readFileSync(path.join(STATIC, vorlage)), { density: 512 }).resize(
		groesse,
		groesse
	);
	if (!durchsichtig) bild = bild.flatten({ background: GRUND });

	await bild.png({ compressionLevel: 9 }).toFile(path.join(STATIC, ziel));
	console.log(`${vorlage} -> ${ziel} (${groesse}px)`);
}
