<script lang="ts">
	import { untrack } from 'svelte';

	let { data, form } = $props();

	// Klick schlägt die Ansicht aus der URL bzw. aus einer fehlgeschlagenen Eingabe.
	let gewaehlt = $state<string | null>(null);
	const ansicht = $derived(gewaehlt ?? form?.ansicht ?? data.ansicht);
	const istSchueler = $derived(ansicht.startsWith('schueler'));

	// Die Meldung gehört zu dem Versuch, der sie ausgelöst hat: wer die Ansicht
	// wechselt, fängt neu an und soll keinen alten Fehler mehr vor sich haben.
	const meldung = $derived(gewaehlt === null ? form?.message : null);

	// Nur der Startwert: nach einer abgelehnten Eingabe stehen die Kästchen wieder gefüllt da.
	const code = $state<string[]>(
		untrack(() =>
			((form?.code ?? '') as string)
				.padEnd(6, ' ')
				.slice(0, 6)
				.split('')
				.map((z) => z.trim())
		)
	);

	function zeichen(event: Event, i: number) {
		const feld = event.target as HTMLInputElement;
		code[i] = feld.value.slice(-1).toUpperCase();
		feld.value = code[i];
		if (code[i] && i < 5) feld.parentElement?.querySelectorAll('input')[i + 1]?.focus();
	}

	function zurueck(event: KeyboardEvent, i: number) {
		if (event.key !== 'Backspace' || code[i] || i === 0) return;
		const felder = (event.target as HTMLInputElement).parentElement?.querySelectorAll('input');
		felder?.[i - 1]?.focus();
	}

	function einfuegen(event: ClipboardEvent) {
		const text = event.clipboardData?.getData('text')?.toUpperCase().replace(/\s/g, '') ?? '';
		if (!text) return;
		event.preventDefault();
		const felder = (event.target as HTMLInputElement).parentElement?.querySelectorAll('input');
		for (let i = 0; i < 6; i++) {
			code[i] = text[i] ?? '';
			if (felder?.[i]) felder[i].value = code[i];
		}
		felder?.[Math.min(text.length, 5)]?.focus();
	}
</script>

<svelte:head><title>Anmelden – lernassi</title></svelte:head>

<div class="anmeldung">
	<aside class="willkommen">
		<p class="marke">lernassi</p>
		<div>
			<h1 class="schlagzeile">Dein Heft, geordnet.</h1>
			<p class="muted versprechen">
				Aufschrieb fotografieren – Thema, Kapitel und Lernstand entstehen von allein.
			</p>
			<div class="blaetter" aria-hidden="true">
				<span class="blatt"></span>
				<span class="blatt"></span>
				<span class="blatt blatt--code">1923</span>
			</div>
		</div>
		<p class="small">Fotos bleiben bei dir, solange du das so willst.</p>
	</aside>

	<main class="formular">
		<div class="formular__inhalt">
			<p class="marke marke--mobil">lernassi</p>

			<div class="rollen" role="group" aria-label="Rolle">
				<button
					type="button"
					class="rollen__schalter"
					aria-pressed={istSchueler}
					onclick={() => (gewaehlt = 'schueler-anmelden')}>Schüler:in</button
				>
				<button
					type="button"
					class="rollen__schalter"
					aria-pressed={!istSchueler}
					onclick={() => (gewaehlt = 'lehrer-anmelden')}>Lehrkraft</button
				>
			</div>

			{#if meldung}
				<div class="meldung meldung--fehler">{meldung}</div>
			{/if}

			{#if ansicht === 'schueler-anmelden'}
				<div class="ansicht">
					<h2 class="titel">Willkommen zurück</h2>
					<p class="muted unterzeile">Mit dem Pseudonym von deiner Lehrkraft.</p>
					<form method="POST" action="?/schueler-anmelden" class="stack">
						<label class="field">
							<span class="field__label">Pseudonym</span>
							<input
								name="pseudonym"
								value={form?.pseudonym ?? ''}
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
					<button
						type="button"
						class="btn btn--plain wechsel"
						onclick={() => (gewaehlt = 'schueler-start')}>Zum ersten Mal hier</button
					>
				</div>
			{:else if ansicht === 'schueler-start'}
				<div class="ansicht">
					<h2 class="titel">Schön, dass du da bist</h2>
					<p class="muted unterzeile">
						Klassencode und Pseudonym bekommst du von deiner Lehrkraft. Das Passwort denkst du dir
						selbst aus.
					</p>
					<form method="POST" action="?/schueler-start" class="stack">
						<div>
							<p class="field__label kastenlabel">Klassencode</p>
							<div class="codeinput">
								{#each code as zeichenWert, i}
									<input
										name="code"
										value={zeichenWert}
										data-filled={zeichenWert ? '' : undefined}
										maxlength="1"
										inputmode="text"
										autocapitalize="characters"
										autocomplete="off"
										aria-label="Klassencode, Zeichen {i + 1} von 6"
										oninput={(e) => zeichen(e, i)}
										onkeydown={(e) => zurueck(e, i)}
										onpaste={einfuegen}
									/>
								{/each}
							</div>
						</div>
						<label class="field">
							<span class="field__label">Pseudonym</span>
							<input
								name="pseudonym"
								value={form?.pseudonym ?? ''}
								placeholder="blaufuchs42"
								autocapitalize="none"
								required
							/>
						</label>
						<div>
							<label class="field">
								<span class="field__label">Passwort</span>
								<input name="password" type="password" autocomplete="new-password" required />
							</label>
							<p class="field__hint">
								Mindestens 6 Zeichen – am besten etwas, das du dir gut merkst.
							</p>
						</div>
						<button class="btn btn--go btn--lg btn--block gross">Los geht's</button>
					</form>
					<button
						type="button"
						class="btn btn--plain wechsel"
						onclick={() => (gewaehlt = 'schueler-anmelden')}>Ich war schon mal hier</button
					>
				</div>
			{:else if ansicht === 'lehrer-anmelden'}
				<div class="ansicht">
					<h2 class="titel">Anmelden</h2>
					<p class="muted unterzeile">Für Lehrkräfte mit E-Mail-Adresse.</p>
					<form method="POST" action="?/lehrer-anmelden" class="stack">
						<label class="field">
							<span class="field__label">E-Mail</span>
							<input
								name="email"
								type="email"
								value={form?.email ?? ''}
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
					<button
						type="button"
						class="btn btn--plain wechsel"
						onclick={() => (gewaehlt = 'lehrer-konto')}>Konto anlegen</button
					>
				</div>
			{:else}
				<div class="ansicht">
					<h2 class="titel">Konto anlegen</h2>
					<p class="muted unterzeile">
						Danach legst du deine erste Klasse an und verteilst Pseudonyme.
					</p>
					<form method="POST" action="?/lehrer-konto" class="stack">
						<label class="field">
							<span class="field__label">Name</span>
							<input name="name" value={form?.name ?? ''} placeholder="Frau Brandt" required />
						</label>
						<label class="field">
							<span class="field__label">E-Mail</span>
							<input
								name="email"
								type="email"
								value={form?.email ?? ''}
								placeholder="name@schule.de"
								autocomplete="email"
								required
							/>
						</label>
						<div>
							<label class="field">
								<span class="field__label">Passwort</span>
								<input name="password" type="password" autocomplete="new-password" required />
							</label>
							<p class="field__hint">Mindestens 6 Zeichen.</p>
						</div>
						<button class="btn btn--go btn--lg btn--block gross">Konto anlegen</button>
					</form>
					<button
						type="button"
						class="btn btn--plain wechsel"
						onclick={() => (gewaehlt = 'lehrer-anmelden')}>Ich habe schon ein Konto</button
					>
				</div>
			{/if}
		</div>

		<div class="fuss">
			<div class="row">
				{#if istSchueler}
					<button
						type="button"
						class="btn btn--plain"
						onclick={() => (gewaehlt = ansicht === 'schueler-anmelden' ? 'schueler-start' : 'schueler-anmelden')}
						>{ansicht === 'schueler-anmelden' ? 'Zum ersten Mal hier' : 'Ich war schon mal hier'}</button
					>
					<button type="button" class="btn btn--plain" onclick={() => (gewaehlt = 'lehrer-anmelden')}
						>Lehrkraft</button
					>
				{:else}
					<button
						type="button"
						class="btn btn--plain"
						onclick={() => (gewaehlt = ansicht === 'lehrer-anmelden' ? 'lehrer-konto' : 'lehrer-anmelden')}
						>{ansicht === 'lehrer-anmelden' ? 'Konto anlegen' : 'Ich habe schon ein Konto'}</button
					>
					<button
						type="button"
						class="btn btn--plain"
						onclick={() => (gewaehlt = 'schueler-anmelden')}>Schüler:in</button
					>
				{/if}
			</div>
		</div>
	</main>
</div>

<style>
	.anmeldung {
		min-height: 100dvh;
		display: flex;
		background: var(--surface);
	}

	/* ---------- Ruhige Spalte, nur am Rechner ---------- */
	.willkommen {
		display: none;
		flex: none;
		width: 46%;
		max-width: 620px;
		padding: 44px 48px;
		background: var(--paper-2);
		flex-direction: column;
		justify-content: space-between;
		gap: 32px;
	}
	.marke {
		margin: 0;
		font-family: var(--display);
		font-weight: 700;
		font-size: 23px;
		letter-spacing: -0.01em;
	}
	.schlagzeile {
		margin: 0 0 12px;
		font-size: 38px;
		max-width: 15ch;
	}
	.versprechen {
		margin: 0;
		font-size: 19px;
		max-width: 34ch;
		line-height: 1.55;
	}
	.blaetter {
		display: flex;
		gap: 12px;
		margin-top: 34px;
	}
	.blatt {
		width: 78px;
		height: 104px;
		border-radius: var(--r);
		border: 1px solid var(--line-2);
		background: repeating-linear-gradient(
			180deg,
			var(--paper) 0 11px,
			var(--surface) 11px 22px
		);
	}
	.blatt:nth-child(1) {
		transform: rotate(-3deg);
	}
	.blatt:nth-child(2) {
		transform: rotate(1.5deg);
	}
	.blatt--code {
		display: grid;
		place-items: end start;
		padding: 10px;
		background: var(--lavender);
		border-color: var(--lavender-2);
		color: var(--lavender-ink);
		font-family: var(--display);
		font-weight: 700;
		font-size: 13px;
		transform: rotate(4deg);
	}

	/* ---------- Formularspalte ---------- */
	.formular {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--paper);
		padding: 34px 22px 24px;
	}
	.formular__inhalt {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: 100%;
		max-width: 396px;
		margin: 0 auto;
	}
	.marke--mobil {
		margin: 0 0 24px;
		font-size: 20px;
	}

	/* Am Handy führt der Fuß durch die Rollen, darum oben kein zweiter Umschalter. */
	.rollen {
		display: none;
		gap: 6px;
		padding: 4px;
		border-radius: var(--r-pill);
		background: var(--paper-2);
		margin-bottom: 26px;
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
	.unterzeile {
		margin: 0 0 22px;
		font-size: 17px;
	}
	.kastenlabel {
		margin: 0 0 8px 2px;
	}
	.gross {
		min-height: 62px;
	}
	.wechsel {
		display: none;
		margin-top: 12px;
		min-height: 48px;
		font-size: 15px;
	}

	/* Am Handy steckt der Rollenwechsel im Fuß, nicht über dem Formular. */
	.fuss {
		margin-top: auto;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.fuss .btn {
		min-height: 52px;
		font-size: 15px;
	}

	@media (min-width: 900px) {
		.willkommen {
			display: flex;
		}
		.formular {
			background: var(--surface);
			padding: 44px;
		}
		.marke--mobil,
		.fuss {
			display: none;
		}
		.rollen {
			display: flex;
		}
		.wechsel {
			display: block;
		}
		.unterzeile {
			font-size: 16px;
		}
		.gross {
			min-height: 56px;
		}
	}
</style>
