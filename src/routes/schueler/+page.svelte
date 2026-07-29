<script lang="ts">
	import { page } from '$app/state';
	import { fachTon, vorZeit } from '$lib/heft';
	import type { Fach, Kapitel, Thema } from '$lib/server/heft';

	let { data, form } = $props();

	const heute = new Intl.DateTimeFormat('de-DE', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).format(new Date());

	const leer = $derived(data.faecher.length === 0);
	const gewaehlt = $derived(page.url.searchParams.get('fach'));
	const bearbeiten = $derived(page.url.searchParams.get('bearbeiten') === '1');
	// Ein Inhaltsverzeichnis zeigt immer genau EIN Fach — am Rechner das aus der Spalte
	// gewählte, am Handy erst die Übersicht und nach dem Antippen ebenfalls nur dieses.
	const fachIndex = $derived(
		Math.max(
			0,
			data.faecher.findIndex((f: Fach) => f.id === gewaehlt)
		)
	);
	const fach = $derived(data.faecher[fachIndex]);
	const link = (an: boolean) => `/schueler?fach=${fach.id}${an ? '&bearbeiten=1' : ''}`;
	// Ein Formular ersetzt den Query-String — ohne Fach und Bearbeiten-Modus landet man
	// nach jeder Änderung woanders. Also beides mitschicken.
	const aktion = (name: string) => `?/${name}&fach=${fach.id}&bearbeiten=1`;

	// Das Verzeichnis ist eine Liste, keine Kachelwand: offen ist das Kapitel, an dem
	// zuletzt etwas passiert ist. Die anderen sind zugeklappt und einen Tipp entfernt.
	let zugeklappt = $state<Record<string, boolean>>({});
	const jüngstes = $derived(
		[...(fach?.kapitel ?? [])].sort((a, b) => neuestesThema(b) - neuestesThema(a))[0]?.id
	);
	const offen = (k: Kapitel) =>
		bearbeiten || (zugeklappt[k.id] === undefined ? k.id === jüngstes : !zugeklappt[k.id]);

	function neuestesThema(k: Kapitel): number {
		return k.themen.reduce((s, t) => Math.max(s, t.zuletzt ?? 0), 0);
	}

	const themenLabel = (n: number) => `${n} ${n === 1 ? 'Thema' : 'Themen'}`;

	/** Was am Kapitel steht: erst der Lernstand, sonst wie viel drinsteckt. */
	function kapitelStand(k: Kapitel): string {
		if (k.zuletztEingeordnet && k.gefragt)
			return `${k.sassen} von ${k.gefragt} saßen · ${vorZeit(k.zuletztEingeordnet)}`;
		return themenLabel(k.themen.length);
	}

	// Welches Thema gerade woanders eingeordnet wird.
	let einordnen = $state<string | null>(null);
	let neuesKapitel = $state('');
</script>

{#snippet verzeichnis(f: Fach, ton: string)}
	<div class="card baum">
		{#each f.kapitel as kapitel (kapitel.id)}
			{#if kapitel.themen.length}
				{@const auf = offen(kapitel)}
				<div class="kapitel">
					<button
						type="button"
						class="klapper"
						aria-expanded={auf}
						aria-label="{kapitel.title} {auf ? 'zuklappen' : 'aufklappen'}"
						onclick={() => (zugeklappt[kapitel.id] = auf)}
					>
						{auf ? '▾' : '▸'}
					</button>
					<!-- Der Kapitel-Kopf ist der Einstieg in eine Runde. Themen sind Anzeige. -->
					<a href="/schueler/kapitel/{kapitel.id}" class="zeile zeile--kapitel">
						<span class="marke" style="background:var(--{ton}-ink)"></span>
						<span class="titel">{kapitel.title}</span>
						<span class="small stand">{kapitelStand(kapitel)}</span>
						<span class="pfeil" aria-hidden="true">›</span>
					</a>
				</div>

				{#if auf}
					{#each kapitel.themen as thema (thema.id)}
						<a href="/schueler/thema/{thema.id}" class="zeile zeile--thema">
							<span class="punkt" style="background:var(--{ton}-ink)"></span>
							<span class="titel">{thema.title}</span>
							<span class="small stand">
								{thema.zuletzt ? vorZeit(thema.zuletzt) : 'kein Aufschrieb'}
							</span>
							<span class="pfeil" aria-hidden="true">›</span>
						</a>
					{/each}
				{/if}
			{/if}
		{/each}
	</div>
	<p class="small hinweis">Tipp ein Kapitel an – dann gehen wir es zusammen durch.</p>
{/snippet}

{#snippet ordnen(id: string, was: string)}
	<span class="ordnen">
		<form method="POST" action={aktion('sortieren')}>
			<input type="hidden" name="id" value={id} />
			<input type="hidden" name="richtung" value="auf" />
			<button class="pfeilknopf" aria-label="{was} nach oben">▲</button>
		</form>
		<form method="POST" action={aktion('sortieren')}>
			<input type="hidden" name="id" value={id} />
			<input type="hidden" name="richtung" value="ab" />
			<button class="pfeilknopf" aria-label="{was} nach unten">▼</button>
		</form>
	</span>
{/snippet}

{#snippet namensfeld(id: string, titel: string, gross: boolean)}
	<form method="POST" action={aktion('umbenennen')} class="namensform">
		<input type="hidden" name="id" value={id} />
		<input
			name="titel"
			value={titel}
			class="namensfeld"
			class:namensfeld--gross={gross}
			aria-label="Name von {titel}"
		/>
		<button class="pfeilknopf" aria-label="Name von {titel} speichern">✓</button>
	</form>
{/snippet}

{#snippet bearbeitenListe(f: Fach, ton: string)}
	<p class="small hinweis" style="margin-top:0">
		Namen antippen und überschreiben, dann auf ✓. Mit ▲ und ▼ verschiebst du eine Zeile.
	</p>

	<div class="card baum">
		{#each f.kapitel as kapitel (kapitel.id)}
			<div class="zeile zeile--bearbeiten">
				{@render ordnen(kapitel.id, kapitel.title)}
				<span class="marke" style="background:var(--{ton}-ink)"></span>
				{@render namensfeld(kapitel.id, kapitel.title, true)}
				{#if !kapitel.themen.length}
					<form method="POST" action={aktion('kapitelLoeschen')}>
						<input type="hidden" name="id" value={kapitel.id} />
						<button class="btn btn--plain klein">Löschen</button>
					</form>
				{:else}
					<span class="small stand">{themenLabel(kapitel.themen.length)}</span>
				{/if}
			</div>

			{#each kapitel.themen as thema (thema.id)}
				<div class="zeile zeile--bearbeiten zeile--eingerueckt">
					{@render ordnen(thema.id, thema.title)}
					<span class="punkt" style="background:var(--{ton}-ink)"></span>
					{@render namensfeld(thema.id, thema.title, false)}
					<span class="knoepfe">
						<button
							type="button"
							class="btn btn--plain klein"
							onclick={() => {
								einordnen = einordnen === thema.id ? null : thema.id;
								neuesKapitel = '';
							}}
						>
							Einordnen
						</button>
						{#if !thema.aufschriebe}
							<form method="POST" action={aktion('themaLoeschen')}>
								<input type="hidden" name="id" value={thema.id} />
								<button class="btn btn--plain klein">Löschen</button>
							</form>
						{/if}
					</span>
				</div>

				{#if einordnen === thema.id}
					{@render einordnenBlock(f, thema, kapitel.id)}
				{/if}
			{/each}
		{/each}
	</div>

	<form method="POST" action={aktion('kapitelAnlegen')} class="card neu">
		<input type="hidden" name="fachId" value={f.id} />
		<label class="field">
			<span class="field__label">Neues Kapitel</span>
			<input name="titel" placeholder="z. B. Absolutismus" required />
		</label>
		<button class="btn btn--quiet">Kapitel anlegen</button>
	</form>
{/snippet}

{#snippet einordnenBlock(f: Fach, thema: Thema, jetzigesKapitel: string)}
	<div class="card card--tint auswahl">
		<p style="margin:0 0 12px;font-size:16px">„{thema.title}" – wohin gehört es?</p>
		<form method="POST" action={aktion('themaVerschieben')} class="stapel">
			<input type="hidden" name="themaId" value={thema.id} />
			{#each f.kapitel.filter((k) => k.id !== jetzigesKapitel) as ziel (ziel.id)}
				<button class="btn btn--quiet btn--block links" name="kapitelId" value={ziel.id}>
					{ziel.title}
				</button>
			{/each}
		</form>
		<form method="POST" action={aktion('themaVerschieben')} class="neuesziel">
			<input type="hidden" name="themaId" value={thema.id} />
			<label class="field">
				<span class="field__label">Oder in ein neues Kapitel</span>
				<input name="neuesKapitel" bind:value={neuesKapitel} placeholder="Name des Kapitels" />
			</label>
			<button class="btn btn--plain klein" disabled={!neuesKapitel.trim()}>
				Anlegen und hierhin legen
			</button>
		</form>
	</div>
{/snippet}

{#snippet kameraKnopf()}
	<a href="/schueler/aufnehmen" class="btn btn--lg btn--block gross">
		<svg
			width="26"
			height="26"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path
				d="M4 8.5h2.6l1.3-2h8.2l1.3 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
			/>
			<circle cx="12" cy="13.5" r="3.4" />
		</svg>
		Aufschrieb fotografieren
	</a>
{/snippet}

{#snippet kopf(f: Fach, zeile2: string)}
	<div class="row kopfzeile2">
		<div>
			<p class="eyebrow" style="margin:0 0 6px">Mein Inhaltsverzeichnis</p>
			<h1 style="margin:0">{f.title}</h1>
			<p class="muted" style="margin:5px 0 0;font-size:16px">{zeile2}</p>
		</div>
		{#if bearbeiten}
			<a class="btn btn--go" href={link(false)}>Fertig</a>
		{:else}
			<a class="btn btn--quiet" href={link(true)}>Verzeichnis bearbeiten</a>
		{/if}
	</div>
{/snippet}

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}
{#if form?.ok}<div class="meldung meldung--ok">{form.ok}</div>{/if}

{#if leer}
	<p class="eyebrow" style="margin:0 0 6px">{heute}</p>
	<h1 style="margin:0 0 5px">Mein Inhaltsverzeichnis</h1>
	<p class="muted" style="margin:0 0 18px;font-size:16px">Wächst mit jedem Aufschrieb.</p>
	<div class="nurHandy">{@render kameraKnopf()}</div>
	<div class="card card--tint" style="margin-top:26px">
		<p style="margin:0;font-size:16px;line-height:1.55">
			Hier ist noch nichts. Fotografiere deinen ersten Aufschrieb – daraus baue ich dein
			Inhaltsverzeichnis auf.
		</p>
	</div>
{:else}
	<!-- Rechner: ein Fach. Die Fächer stehen in der Spalte links, die Kamera auch. -->
	<div class="nurRechner">
		{@render kopf(
			fach,
			`${themenLabel(fach.anzahlThemen)} in ${fach.kapitel.length} ${fach.kapitel.length === 1 ? 'Kapitel' : 'Kapiteln'}`
		)}
		{#if bearbeiten}
			{@render bearbeitenListe(fach, fachTon(fachIndex))}
		{:else}
			{@render verzeichnis(fach, fachTon(fachIndex))}
		{/if}
	</div>

	<!-- Handy: erst die Übersicht über alle Fächer, dann eines im Ganzen. -->
	<div class="nurHandy">
		{#if gewaehlt}
			<a href="/schueler" class="btn btn--plain zurueck">Alle Fächer</a>
			{@render kopf(fach, themenLabel(fach.anzahlThemen))}
			{#if bearbeiten}
				{@render bearbeitenListe(fach, fachTon(fachIndex))}
			{:else}
				{@render verzeichnis(fach, fachTon(fachIndex))}
			{/if}
		{:else}
			<p class="eyebrow" style="margin:0 0 6px">{heute}</p>
			<h1 style="margin:0 0 5px">Mein Inhaltsverzeichnis</h1>
			<p class="muted" style="margin:0 0 18px;font-size:16px">Wächst mit jedem Aufschrieb.</p>
			{@render kameraKnopf()}
			<p class="small" style="margin:9px 2px 0;text-align:center">
				Heft aufschlagen, abfotografieren – die Einordnung mache ich.
			</p>

			{#each data.faecher as f, i (f.id)}
				{@const ton = fachTon(i)}
				<section style="margin-top:26px">
					<div class="row" style="margin-bottom:8px">
						<h3 style="display:flex;align-items:center;gap:9px">
							<span class="marke" style="background:var(--{ton}-ink)"></span>{f.title}
						</h3>
						<span class="small" style="font-size:13px">{themenLabel(f.anzahlThemen)}</span>
					</div>
					<div class="card baum">
						{#each f.kapitel.filter((k) => k.themen.length) as kapitel (kapitel.id)}
							<a href="/schueler/kapitel/{kapitel.id}" class="zeile zeile--kapitel eingerueckt">
								<span class="marke" style="background:var(--{ton}-ink)"></span>
								<span class="titel">{kapitel.title}</span>
								<span class="small stand">{kapitelStand(kapitel)}</span>
								<span class="pfeil" aria-hidden="true">›</span>
							</a>
						{/each}
						<a href="/schueler?fach={f.id}" class="btn btn--plain alle">
							Alle {themenLabel(f.anzahlThemen)} ansehen
						</a>
					</div>
				</section>
			{/each}
		{/if}
	</div>
{/if}

<style>
	.nurRechner {
		display: none;
	}
	.gross {
		min-height: 66px;
		gap: 12px;
		font-size: 20px;
	}
	.zurueck {
		margin: 0 0 10px;
		padding-inline: 0;
		min-height: 44px;
	}
	.kopfzeile2 {
		align-items: flex-end;
		margin-bottom: 18px;
	}
	.kopfzeile2 :global(.btn) {
		min-height: 48px;
		white-space: nowrap;
	}

	/* Eine Karte, eine eingerückte Liste — wie ein echtes Inhaltsverzeichnis. */
	.baum {
		padding: 6px 8px;
	}
	.kapitel {
		display: grid;
		grid-template-columns: 26px 1fr;
		align-items: center;
	}
	.klapper {
		width: 26px;
		height: 44px;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		font-size: 13px;
		cursor: pointer;
	}
	.klapper:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
	.zeile {
		display: grid;
		align-items: center;
		gap: 10px;
		border-radius: var(--r);
		color: var(--ink);
		text-decoration: none;
	}
	.zeile--kapitel {
		grid-template-columns: 12px 1fr auto 14px;
		min-height: 52px;
		padding: 8px 10px;
	}
	.zeile--kapitel:hover,
	.zeile--thema:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
	.zeile--kapitel .titel {
		font-family: var(--display);
		font-weight: 700;
		font-size: 17px;
	}
	.eingerueckt {
		margin-left: 26px;
	}
	/* Themen hängen unter ihrem Kapitel. */
	.zeile--thema {
		grid-template-columns: 10px 1fr auto 14px;
		min-height: 46px;
		padding: 6px 10px 6px 46px;
		color: var(--ink-2);
	}
	.marke {
		width: 11px;
		height: 11px;
		border-radius: 3px;
	}
	.punkt {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		opacity: 0.55;
	}
	.titel {
		font-size: 16px;
		line-height: 1.35;
	}
	.stand {
		font-size: 13px;
		white-space: nowrap;
	}
	.pfeil {
		color: var(--ink-3);
		font-size: 15px;
		text-align: right;
	}
	.hinweis {
		margin: 10px 2px 0;
	}
	.alle {
		width: 100%;
		justify-content: flex-start;
		min-height: 48px;
		font-size: 15px;
	}

	/* ---------- Bearbeiten ---------- */
	.zeile--bearbeiten {
		grid-template-columns: 26px 12px minmax(0, 1fr) auto;
		min-height: 58px;
		padding: 6px 8px;
	}
	.zeile--eingerueckt {
		padding-left: 34px;
	}
	.ordnen {
		display: flex;
		flex-direction: column;
	}
	.pfeilknopf {
		width: 26px;
		height: 24px;
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		font-size: 11px;
		cursor: pointer;
	}
	.pfeilknopf:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
	.namensform {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.namensfeld {
		flex: 1;
		min-width: 0;
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		padding: 9px 10px;
		background: var(--paper-2);
		font-family: var(--text);
		font-size: 15px;
		color: var(--ink);
	}
	.namensfeld:focus {
		outline: none;
		border-color: var(--lavender-ink);
		background: var(--surface);
	}
	.namensfeld--gross {
		font-family: var(--display);
		font-weight: 700;
		font-size: 16px;
	}
	.namensform .pfeilknopf {
		height: 34px;
		font-size: 13px;
	}
	.knoepfe {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.klein {
		min-height: 40px;
		font-size: 14px;
		white-space: nowrap;
	}
	.auswahl {
		margin: 4px 8px 10px 34px;
	}
	.stapel {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.links {
		justify-content: flex-start;
		min-height: 50px;
	}
	.neuesziel {
		margin-top: 12px;
	}
	.neu {
		margin-top: 12px;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}
	.neu .field {
		flex: 1;
		min-width: 12rem;
	}
	.neu :global(.btn) {
		min-height: 50px;
	}

	@media (min-width: 860px) {
		.nurRechner {
			display: block;
		}
		.nurHandy {
			display: none;
		}
	}
</style>
