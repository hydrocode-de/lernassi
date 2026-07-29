<script lang="ts">
	let { data } = $props();
	let offen = $state<string | null>(null);

	const anzahl = $derived(data.themen.length);
	const seitenText = $derived(
		`${data.seitenGesamt} ${data.seitenGesamt === 1 ? 'Seite' : 'Seiten'}`
	);
</script>

<span class="tag tag--mint" style="font-size:13px">Fertig</span>
<h1 style="margin:12px 0 5px">
	{#if anzahl === 1}Erkannt &amp; eingeordnet{:else}{anzahl} Themen gefunden{/if}
</h1>
<p class="muted" style="margin:0 0 24px;font-size:16px">
	{seitenText} aus deinem Heft · {data.fach}
</p>

{#each data.themen as thema (thema.id)}
	<div class="raster">
		<div class="card">
			<p class="eyebrow" style="margin:0 0 10px">Darum geht es</p>
			<p class="text">{thema.zusammenfassung}</p>

			{#if thema.begriffe.length}
				<div class="chips">
					{#each thema.begriffe as begriff (begriff)}
						<span class="chip" style="cursor:default">{begriff}</span>
					{/each}
				</div>
			{/if}

			{#if thema.seiten.length}
				<div class="blaetter">
					{#each thema.seiten as nummer (nummer)}
						{@const seite = data.seiten.find((s) => s.nummer === nummer)}
						<span class="blatt">
							{#if seite?.hatBild}
								<img src="/schueler/seite/{seite.id}" alt="Seite {nummer}" loading="lazy" />
							{/if}
							<span class="nummer">{nummer}</span>
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<div class="ablage">
			<div class="card">
				<p class="eyebrow" style="margin:0 0 12px">Hier hab ich es abgelegt</p>
				<div class="pfad">
					<span class="small">{data.fach}</span>
					<span class="pfad__kapitel">↳ {thema.kapitel}</span>
					<span class="pfad__thema">↳ {thema.thema}</span>
				</div>
			</div>

			<button
				type="button"
				class="btn btn--quiet btn--block woanders"
				onclick={() => (offen = offen === thema.id ? null : thema.id)}
			>
				Woanders einordnen
			</button>

			{#if offen === thema.id}
				<div class="huelle">
					<div class="auswahl">
						<div class="row auswahl__kopf">
							<h3>Wohin gehört es?</h3>
							<button type="button" class="btn btn--plain" onclick={() => (offen = null)}>
								Zurück
							</button>
						</div>
						<p class="small" style="margin:0 0 14px">Fach {data.fach} · Kapitel wählen</p>
						<form method="POST" action="?/verschieben" class="stack">
							<input type="hidden" name="noteId" value={thema.id} />
							{#each data.kapitelAuswahl as kapitel (kapitel.id)}
								<button
									class="btn btn--quiet btn--block kapitel"
									name="kapitelId"
									value={kapitel.id}
									disabled={kapitel.title === thema.kapitel}
								>
									{kapitel.title}
								</button>
							{/each}
						</form>

						<form method="POST" action="?/neuesKapitel" class="neues">
							<input type="hidden" name="noteId" value={thema.id} />
							<label class="field">
								<span class="field__label">Neues Kapitel anfangen</span>
								<input name="titel" placeholder="z. B. Absolutismus" required />
							</label>
							<button class="btn btn--plain anlegen">Kapitel anlegen und hierhin legen</button>
						</form>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/each}

<div class="abschluss">
	{#if data.weiter}
		<a href={data.weiter} class="btn btn--go btn--lg btn--block speichern">
			Passt so – zurück zum Kapitel
		</a>
	{:else}
		<a href="/schueler" class="btn btn--go btn--lg btn--block speichern">Passt so – speichern</a>
	{/if}
	<form method="POST" action="?/verwerfen">
		<button class="btn btn--plain verwerfen">
			{anzahl === 1 ? 'Doch nicht behalten – wieder löschen' : 'Alles wieder löschen'}
		</button>
	</form>
</div>

<style>
	.raster {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-bottom: 18px;
	}
	.text {
		margin: 0 0 14px;
		font-size: 17px;
		line-height: 1.6;
	}
	.blaetter {
		display: flex;
		gap: 10px;
		margin-top: 18px;
	}
	.blatt {
		position: relative;
		width: 52px;
		height: 68px;
		border-radius: 7px;
		border: 1px solid var(--line-2);
		overflow: hidden;
		background: repeating-linear-gradient(
			180deg,
			var(--paper-2) 0 8px,
			var(--surface) 8px 16px
		);
	}
	.blatt img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.nummer {
		position: absolute;
		bottom: -2px;
		right: -4px;
		width: 19px;
		height: 19px;
		border-radius: 50%;
		background: var(--mint);
		color: var(--mint-ink);
		font-family: var(--display);
		font-weight: 700;
		font-size: 11px;
		display: grid;
		place-items: center;
	}
	.ablage {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.pfad {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.pfad__kapitel {
		font-size: 16px;
		color: var(--ink-2);
	}
	.pfad__thema {
		font-family: var(--display);
		font-weight: 700;
		font-size: 20px;
		margin-left: 18px;
	}
	.woanders {
		min-height: 56px;
	}
	.speichern {
		min-height: 62px;
	}
	.abschluss {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 4px;
	}
	.verwerfen {
		width: 100%;
		min-height: 52px;
		font-size: 15px;
		color: var(--rose-ink);
	}
	.neues {
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px solid var(--line);
	}
	.anlegen {
		width: 100%;
		justify-content: flex-start;
		min-height: 48px;
		font-size: 15px;
		padding-inline: 0;
	}

	/* Am Handy schiebt sich die Kapitelwahl von unten herein, am Rechner steht sie als Karte. */
	.huelle {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: flex;
		align-items: flex-end;
		background: oklch(0.3 0.02 60 / 0.28);
	}
	.auswahl {
		width: 100%;
		background: var(--surface);
		border-radius: var(--r-lg) var(--r-lg) 0 0;
		padding: 22px 20px calc(40px + env(safe-area-inset-bottom));
		animation: la-rise 0.22s ease;
	}
	.auswahl__kopf {
		margin-bottom: 14px;
	}
	.kapitel {
		justify-content: flex-start;
		min-height: 60px;
	}

	@media (min-width: 860px) {
		.raster {
			display: grid;
			grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
			gap: 18px;
			align-items: start;
			margin-bottom: 22px;
		}
		.huelle {
			position: static;
			display: block;
			background: none;
		}
		.auswahl {
			border: 1px solid var(--line);
			border-radius: var(--r-lg);
			padding: 18px 20px;
		}
		.kapitel {
			min-height: 52px;
		}
		.speichern {
			min-height: 56px;
		}
		.abschluss {
			max-width: 320px;
		}
	}
</style>
