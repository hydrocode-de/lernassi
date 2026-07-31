<script lang="ts">
	// Eine durchscrollbare Startseite: Hero, Anmelden, dann drei Abschnitte,
	// die je zur Hälfte Bild und zur Hälfte Text sind. Jeder Abschnitt rastet ein.
	let bahn = $state<HTMLDivElement | null>(null);
	let istSchueler = $state(true);

	function zu(nr: number) {
		return () => {
			if (!bahn) return;
			const ziel = nr * bahn.clientHeight;
			const vorher = bahn.scrollTop;
			bahn.scrollTo({ top: ziel, behavior: 'smooth' });
			// Manche Browser lassen ein weiches Scrollen in einer rastenden Bahn liegen.
			// Dann springt die Seite eben – ankommen ist wichtiger als der Weg dorthin.
			setTimeout(() => {
				if (bahn && bahn.scrollTop === vorher) bahn.scrollTop = ziel;
			}, 240);
		};
	}
</script>

<svelte:head><title>lernassi – dein Heft, geordnet</title></svelte:head>

<div class="kopf">
	<button type="button" class="marke" onclick={zu(0)}>lernassi</button>
	<div class="kopf__wege">
		<button type="button" class="btn btn--plain klein" onclick={zu(2)}>So läuft das</button>
		<button type="button" class="btn klein" onclick={zu(1)}>Anmelden</button>
	</div>
</div>

<div class="bahn" bind:this={bahn}>
	<!-- ---------- Hero ---------- -->
	<section class="seiteVoll hero">
		<h1 class="schlagzeile">Dein Heft, geordnet.</h1>
		<p class="muted versprechen">
			Aufschrieb fotografieren – Thema, Kapitel und Lernstand entstehen von allein. Kein Abtippen,
			direkt Los-Lernen.
		</p>
		<div class="hero__wege">
			<button type="button" class="btn btn--go btn--lg" onclick={zu(1)}>Loslegen</button>
			<button type="button" class="btn btn--quiet btn--lg" onclick={zu(2)}
				>Wie es funktioniert</button
			>
		</div>
		<div class="blaetter" aria-hidden="true">
			<span class="blatt"></span>
			<span class="blatt"></span>
			<span class="blatt blatt--code">1923</span>
		</div>
		<button type="button" class="weiter weiter--beschriftet" onclick={zu(1)}>
			<span class="weiter__wort">Anmelden</span>
			<span class="weiter__kreis" aria-hidden="true"><span class="weiter__pfeil"></span></span>
		</button>
	</section>

	<!-- ---------- Anmelden ---------- -->
	<section class="seiteVoll anmelden">
		<div class="anmelden__wort">
			<span class="eyebrow">Anmelden</span>
			<h2 class="titel titel--gross">Schön, dass du da bist.</h2>
			<p class="muted absatz">
				Schüler:innen melden sich mit dem Pseudonym von der Lehrkraft an. Lehrkräfte mit ihrer
				E-Mail.
			</p>
			<p class="small hinweis">
				<a href="/datenschutz">Datenschutz ist für uns zentral, lerne mehr</a>
			</p>
		</div>

		<div class="anmelden__formular">
			<div class="formularbreite">
				<div class="rollen" role="group" aria-label="Rolle">
					<button
						type="button"
						class="rollen__schalter"
						aria-pressed={istSchueler}
						onclick={() => (istSchueler = true)}>Schüler:in</button
					>
					<button
						type="button"
						class="rollen__schalter"
						aria-pressed={!istSchueler}
						onclick={() => (istSchueler = false)}>Lehrkraft</button
					>
				</div>

				{#if istSchueler}
					<div class="ansicht">
						<h2 class="titel titel--allein">Willkommen zurück</h2>
						<form method="POST" action="/anmelden?/schueler-anmelden" class="stack">
							<label class="field">
								<span class="field__label">Pseudonym</span>
								<input
									name="pseudonym"
									placeholder="blaufuchs42"
									autocapitalize="none"
									autocomplete="username"
									required
								/>
							</label>
							<label class="field">
								<span class="field__label">Passwort</span>
								<input name="password" type="password" autocomplete="current-password" required />
							</label>
							<button class="btn btn--lg btn--block gross">Anmelden</button>
						</form>
						<div class="row nachtrag">
							<a class="btn btn--plain" href="/anmelden?ansicht=schueler-start"
								>Zum ersten Mal hier</a
							>
							<span class="small nachtrag__wort"
								>Passwort weg? Deine Lehrkraft gibt dir ein neues.</span
							>
						</div>
					</div>
				{:else}
					<div class="ansicht">
						<h2 class="titel titel--allein">Anmelden</h2>
						<form method="POST" action="/anmelden?/lehrer-anmelden" class="stack">
							<label class="field">
								<span class="field__label">E-Mail</span>
								<input
									name="email"
									type="email"
									placeholder="name@schule.de"
									autocomplete="email"
									required
								/>
							</label>
							<label class="field">
								<span class="field__label">Passwort</span>
								<input name="password" type="password" autocomplete="current-password" required />
							</label>
							<button class="btn btn--lg btn--block gross">Anmelden</button>
						</form>
						<div class="row nachtrag">
							<a class="btn btn--plain" href="/anmelden?ansicht=lehrer-konto">Konto anlegen</a>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<button type="button" class="weiter" onclick={zu(2)} aria-label="Weiter">
			<span class="weiter__kreis"><span class="weiter__pfeil"></span></span>
		</button>
	</section>

	<!-- ---------- Schritt 1 ---------- -->
	<section class="seiteVoll schritt">
		<div class="bild">
			<div class="heft" aria-hidden="true">
				<span class="heft__blatt"></span>
				<span class="heft__seite">
					<span class="zeile" style="width:62%"></span>
					<span class="zeile" style="width:88%"></span>
					<span class="zeile" style="width:74%"></span>
					<span class="zeile" style="width:40%"></span>
				</span>
				<span class="fahne fahne--apricot">Foto gelesen</span>
			</div>
		</div>
		<div class="wort">
			<span class="eyebrow">Schritt 1</span>
			<h2 class="titel titel--gross">Foto rein, Rest passiert.</h2>
			<p class="muted absatz">
				Du fotografierst die Seite aus deinem Heft. Dein Assistent liest mit, erkennt das Thema und
				legt den Aufschrieb an die richtige Stelle.
			</p>
		</div>
		<button type="button" class="weiter" onclick={zu(3)} aria-label="Weiter">
			<span class="weiter__kreis"><span class="weiter__pfeil"></span></span>
		</button>
	</section>

	<!-- ---------- Schritt 2 ---------- -->
	<section class="seiteVoll schritt schritt--getauscht">
		<div class="wort">
			<span class="eyebrow">Schritt 2</span>
			<h2 class="titel titel--gross">Ein Inhaltsverzeichnis, das sich selbst schreibt.</h2>
			<p class="muted absatz">
				Kapitel, Themen und Datum stehen da, ohne dass du sie tippst. Du siehst auf einen Blick, was
				schon sitzt und was noch offen ist.
			</p>
		</div>
		<div class="bild">
			<div class="card verzeichnis" aria-hidden="true">
				<p class="eyebrow">Geschichte · Klasse 9</p>
				<div class="stack" style="gap:10px">
					<div class="row zeileTrenner">
						<span class="eintrag">Weimarer Republik</span><span class="tag tag--mint">verstanden</span
						>
					</div>
					<div class="row zeileTrenner">
						<span class="eintrag">Inflation 1923</span><span class="tag tag--apricot">üben</span>
					</div>
					<div class="row zeileTrenner">
						<span class="eintrag">Ruhrbesetzung</span><span class="tag tag--rose">neu</span>
					</div>
					<div class="row">
						<span class="eintrag">Goldene Zwanziger</span><span class="tag tag--sky"
							>wiederholen</span
						>
					</div>
				</div>
			</div>
		</div>
		<button type="button" class="weiter" onclick={zu(4)} aria-label="Weiter">
			<span class="weiter__kreis"><span class="weiter__pfeil"></span></span>
		</button>
	</section>

	<!-- ---------- Schritt 3 ---------- -->
	<section class="seiteVoll schritt schritt--letzte">
		<div class="bild">
			<div class="karten" aria-hidden="true">
				<div class="card karte karte--frage">
					<p class="karte__quelle">Dein Assistent fragt</p>
					<p>Warum stieg 1923 der Brotpreis?</p>
				</div>
				<div class="card karte karte--wahl">
					<span class="wahl">Die Ernte fiel aus</span>
					<span class="wahl wahl--richtig">Das Geld verlor an Wert</span>
					<span class="wahl">Brot wurde knapp gehalten</span>
				</div>
				<span class="fahne fahne--mint">Stimmt – Lernstand aktualisiert</span>
			</div>
		</div>
		<div class="wort">
			<span class="eyebrow">Schritt 3</span>
			<h2 class="titel titel--gross">Fragen von deinem Assistenten.</h2>
			<p class="muted absatz">
				Dein Assistent macht aus deinem Aufschrieb Fragen. Du kreuzt an, er sagt dir sofort, ob es
				stimmt – und zeigt die Stelle aus deinem eigenen Heft dazu.
			</p>
			<div class="hero__wege schluss">
				<button type="button" class="btn btn--go btn--lg" onclick={zu(1)}>Jetzt anmelden</button>
				<button type="button" class="btn btn--quiet btn--lg" onclick={zu(0)}>Nach oben</button>
			</div>
		</div>
		<div class="fuss">
			<span class="marke marke--fuss">lernassi</span>
			<span class="small">Datenschutz · Für Schulen · Kontakt</span>
		</div>
	</section>
</div>

<style>
	/* ---------- Bahn und Abschnitte ---------- */
	.bahn {
		height: 100dvh;
		overflow-y: auto;
		scroll-snap-type: y mandatory;
		scrollbar-width: none;
		background: var(--paper);
		color: var(--ink);
	}
	.bahn::-webkit-scrollbar {
		width: 0;
	}
	.seiteVoll {
		position: relative;
		min-height: 100dvh;
		scroll-snap-align: start;
		box-sizing: border-box;
	}

	/* ---------- Kopfzeile ---------- */
	.kopf {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px 12px;
		background: linear-gradient(var(--paper) 65%, transparent);
	}
	.marke {
		border: 0;
		background: transparent;
		padding: 0;
		cursor: pointer;
		font-family: var(--display);
		font-weight: 700;
		font-size: 19px;
		letter-spacing: -0.01em;
		color: var(--ink);
	}
	.kopf__wege {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.kopf__wege .btn--plain {
		display: none;
	}
	.klein {
		min-height: 40px;
		padding: 9px 16px;
		font-size: 14px;
	}

	/* ---------- Hero ---------- */
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 106px 24px 92px;
	}
	.schlagzeile {
		margin: 18px 0 0;
		font-size: 42px;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}
	.versprechen {
		margin: 16px 0 0;
		font-size: 17px;
		line-height: 1.5;
		max-width: 48ch;
	}
	.hero__wege {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		max-width: 396px;
		margin-top: 28px;
	}
	.hero__wege .btn {
		min-height: 52px;
		width: 100%;
	}
	.blaetter {
		display: flex;
		gap: 12px;
		margin-top: 40px;
	}
	.blatt {
		width: 74px;
		height: 100px;
		border-radius: var(--r);
		border: 1px solid var(--line-2);
		background: repeating-linear-gradient(180deg, var(--surface) 0 11px, var(--paper) 11px 22px);
	}
	.blatt:nth-child(1) {
		transform: rotate(-4deg);
	}
	.blatt:nth-child(2) {
		transform: rotate(1deg);
	}
	.blatt--code {
		display: grid;
		place-items: end start;
		padding: 9px;
		background: var(--lavender);
		border-color: var(--lavender-2);
		color: var(--lavender-ink);
		font-family: var(--display);
		font-weight: 700;
		font-size: 13px;
		transform: rotate(5deg);
	}

	/* ---------- Pfeil nach unten ---------- */
	.weiter {
		position: absolute;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		display: grid;
		place-items: center;
		gap: 8px;
		border: 0;
		background: transparent;
		padding: 0;
		cursor: pointer;
		color: var(--ink-3);
		font-family: var(--display);
		font-weight: 600;
		font-size: 12px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	/* Am Handy trägt der Pfeil allein, die Beschriftung wäre nur Gedränge. */
	.weiter__wort {
		display: none;
	}
	.weiter__kreis {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 1px solid var(--line-2);
		background: var(--surface);
		animation: la-nudge 2.2s ease-in-out infinite;
	}
	.weiter__pfeil {
		display: block;
		width: 9px;
		height: 9px;
		border-right: 2px solid var(--ink-3);
		border-bottom: 2px solid var(--ink-3);
		transform: translateY(-2px) rotate(45deg);
	}
	@keyframes la-nudge {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(5px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.weiter__kreis {
			animation: none;
		}
	}

	/* ---------- Anmelden ---------- */
	.anmelden {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 22px;
		padding: 106px 24px 92px;
		background: var(--surface);
		border-top: 1px solid var(--line);
	}
	.anmelden__wort .titel--gross {
		margin: 10px 0 0;
	}
	.absatz {
		margin: 12px 0 0;
		font-size: 17px;
		line-height: 1.55;
		max-width: 40ch;
	}
	.hinweis {
		margin: 14px 0 0;
		max-width: 36ch;
	}
	.anmelden__formular {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.formularbreite {
		width: 100%;
		max-width: 400px;
	}
	.rollen {
		display: flex;
		gap: 6px;
		padding: 4px;
		border-radius: var(--r-pill);
		background: var(--paper-2);
		margin-bottom: 22px;
	}
	.rollen__schalter {
		flex: 1;
		min-height: 44px;
		border: 0;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--ink-3);
		font-family: var(--display);
		font-weight: 600;
		font-size: 15px;
		cursor: pointer;
	}
	.rollen__schalter[aria-pressed='true'] {
		background: var(--surface);
		color: var(--ink);
	}
	.ansicht {
		animation: la-rise 0.22s ease;
	}
	.titel {
		margin: 0 0 6px;
	}
	/* Ohne Unterzeile trägt der Titel den Abstand zum Formular selbst. */
	.titel--allein {
		margin-bottom: 22px;
	}
	.gross {
		min-height: 56px;
	}
	.nachtrag {
		margin-top: 16px;
	}
	.nachtrag .btn {
		min-height: 44px;
		font-size: 15px;
	}
	.nachtrag__wort {
		display: none;
		font-size: 13px;
		text-align: right;
		max-width: 17ch;
	}

	/* ---------- Schritte ---------- */
	.schritt {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 34px;
		padding: 106px 24px 92px;
		border-top: 1px solid var(--line);
	}
	.schritt--getauscht {
		background: var(--surface);
	}
	.schritt--getauscht .wort {
		order: 2;
	}
	.schritt--getauscht .bild {
		order: 1;
	}
	.bild {
		display: grid;
		place-items: center;
	}

	/* Heft mit Fahne */
	.heft {
		position: relative;
		width: 250px;
		height: 210px;
	}
	.heft__blatt {
		position: absolute;
		inset: 26px 0 0 0;
		border-radius: var(--r-lg);
		border: 1px solid var(--line-2);
		background: repeating-linear-gradient(180deg, var(--surface) 0 13px, var(--paper) 13px 26px);
		transform: rotate(-3deg);
	}
	.heft__seite {
		position: absolute;
		inset: 38px 16px 14px 18px;
		border-radius: var(--r-lg);
		border: 1px solid var(--line-2);
		background: var(--surface);
		transform: rotate(2deg);
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.zeile {
		display: block;
		height: 9px;
		border-radius: var(--r-pill);
		background: var(--paper-2);
	}
	.fahne {
		position: absolute;
		padding: 8px 12px;
		border-radius: var(--r-pill);
		font-family: var(--display);
		font-weight: 600;
		font-size: 13px;
		white-space: nowrap;
	}
	.fahne--apricot {
		right: -4px;
		bottom: 2px;
		background: var(--apricot);
		border: 1px solid var(--apricot-2);
		color: var(--apricot-ink);
	}
	.fahne--mint {
		left: 8px;
		bottom: 0;
		background: var(--mint);
		border: 1px solid var(--mint-2);
		color: var(--mint-ink);
	}

	/* Inhaltsverzeichnis-Karte */
	.verzeichnis {
		width: 100%;
		max-width: 360px;
		padding: 20px;
		box-shadow: var(--shadow-lift);
	}
	.verzeichnis .eyebrow {
		margin: 0 0 12px;
	}
	.zeileTrenner {
		padding-bottom: 10px;
		border-bottom: 1px solid var(--line);
	}
	.eintrag {
		font-family: var(--display);
		font-weight: 600;
		font-size: 15px;
	}

	/* Frage des Assistenten und die Antworten zum Ankreuzen */
	.karten {
		position: relative;
		width: 264px;
		height: 300px;
	}
	.karte {
		position: absolute;
	}
	.karte p {
		margin: 0;
	}
	.karte--frage {
		left: 0;
		top: 0;
		width: 208px;
		background: var(--lavender);
		border-color: var(--lavender-2);
		transform: rotate(-2deg);
	}
	.karte .karte__quelle {
		font-family: var(--display);
		font-weight: 600;
		font-size: 11px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--lavender-ink);
		opacity: 0.75;
		margin-bottom: 6px;
	}
	.karte--frage p:last-child {
		font-family: var(--display);
		font-weight: 700;
		font-size: 15px;
		color: var(--lavender-ink);
	}
	.karte--wahl {
		right: 0;
		top: 106px;
		width: 208px;
		padding: 12px;
		box-shadow: var(--shadow-lift);
		display: flex;
		flex-direction: column;
		gap: 6px;
		transform: rotate(1.5deg);
	}
	.wahl {
		padding: 8px 10px;
		border-radius: var(--r-sm);
		border: 1px solid var(--line);
		background: var(--paper-2);
		color: var(--ink-2);
		font-size: 13px;
	}
	.wahl--richtig {
		border-color: var(--mint-2);
		background: var(--mint);
		color: var(--mint-ink);
		font-family: var(--display);
		font-weight: 600;
	}
	.schluss {
		margin-top: 24px;
	}

	/* ---------- Fuß ---------- */
	.schritt--letzte {
		padding-bottom: 120px;
	}
	.fuss {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 18px 24px;
		border-top: 1px solid var(--line);
		background: var(--paper-2);
	}
	.marke--fuss {
		font-family: var(--display);
		font-weight: 700;
		font-size: 16px;
	}

	/* ---------- Am Rechner: zwei Spalten ---------- */
	@media (min-width: 900px) {
		.kopf {
			padding: 20px 40px;
		}
		.marke {
			font-size: 21px;
		}
		.kopf__wege .btn--plain {
			display: inline-flex;
		}
		.kopf__wege .klein {
			font-size: 15px;
		}

		.hero {
			padding: 120px 40px 96px;
		}
		.schlagzeile {
			font-size: 78px;
			line-height: 1.02;
			letter-spacing: -0.03em;
			max-width: 16ch;
			margin-top: 22px;
		}
		.versprechen {
			margin-top: 22px;
			font-size: 22px;
		}
		.hero__wege {
			flex-direction: row;
			justify-content: center;
			gap: 12px;
			max-width: none;
			width: auto;
			margin-top: 36px;
		}
		.hero__wege .btn {
			width: auto;
		}
		.blaetter {
			gap: 16px;
			margin-top: 64px;
		}
		.blatt {
			width: 112px;
			height: 150px;
		}
		.blatt:not(.blatt--code) {
			background: repeating-linear-gradient(
				180deg,
				var(--surface) 0 13px,
				var(--paper) 13px 26px
			);
		}
		.blatt--code {
			padding: 12px;
			font-size: 15px;
		}
		.weiter--beschriftet {
			bottom: 28px;
		}
		.weiter__wort {
			display: block;
		}

		.anmelden {
			flex-direction: row;
			gap: 0;
			padding: 0;
		}
		.anmelden__wort {
			flex: none;
			width: 44%;
			background: var(--paper-2);
			padding: 120px 56px 72px;
			display: flex;
			flex-direction: column;
			justify-content: center;
		}
		.anmelden__wort .titel--gross {
			margin: 12px 0 12px;
			max-width: 15ch;
		}
		.anmelden__wort .absatz {
			margin: 0;
			font-size: 19px;
			max-width: 34ch;
		}
		.hinweis {
			margin-top: 28px;
		}
		.nachtrag__wort {
			display: block;
		}
		.anmelden__formular {
			flex: 1;
			min-width: 0;
			padding: 120px 44px 72px;
		}

		.schritt {
			display: grid;
			grid-template-columns: 1fr 1fr;
			align-items: center;
			gap: 72px;
			padding: 120px 72px;
		}
		/* Nebeneinander steht das Wort links, das Bild rechts – wie im Fluss geschrieben. */
		.schritt--getauscht .wort,
		.schritt--getauscht .bild {
			order: 0;
		}
		.titel--gross {
			font-size: 42px;
			max-width: 14ch;
		}
		.absatz {
			font-size: 19px;
			line-height: 1.6;
		}
		.heft {
			width: 340px;
			height: 300px;
		}
		.heft__blatt {
			inset: 36px 0 0 0;
			background: repeating-linear-gradient(
				180deg,
				var(--surface) 0 15px,
				var(--paper) 15px 30px
			);
		}
		.heft__seite {
			inset: 52px 22px 18px 26px;
			padding: 24px;
			gap: 12px;
		}
		.heft__seite .zeile {
			height: 11px;
		}
		.fahne {
			padding: 10px 14px;
			font-size: 14px;
		}
		.fahne--apricot {
			right: -6px;
			bottom: 6px;
		}
		.fahne--mint {
			left: 16px;
		}
		.verzeichnis {
			width: 360px;
			padding: 24px 24px 20px;
		}
		.verzeichnis .eyebrow {
			margin: 0 0 14px;
		}
		.eintrag {
			font-size: 16px;
		}
		.karten {
			width: 344px;
			height: 344px;
		}
		.karte--frage {
			width: 250px;
		}
		.karte--frage p:last-child {
			font-size: 16px;
		}
		.karte--wahl {
			width: 262px;
			top: 124px;
			padding: 14px;
			gap: 8px;
		}
		.wahl {
			padding: 9px 12px;
			font-size: 14px;
		}
		.schritt--letzte {
			padding: 120px 72px 140px;
		}
		.schluss {
			margin-top: 32px;
		}
		.fuss {
			padding: 22px 72px;
		}
	}
</style>
