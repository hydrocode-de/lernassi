<script lang="ts">
	import { seitenLabel, vorZeit } from '$lib/heft';
	import { KI_AUFSCHRIEB, KI_MARKE, kiErzeugt } from '$lib/ki';

	let { data, form } = $props();

	let einordnen = $state(false);
	let neuesKapitel = $state('');

	const datum = (wann: number) =>
		new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(wann));
</script>

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}
{#if form?.ok}<div class="meldung meldung--ok">{form.ok}</div>{/if}

<p class="eyebrow" style="margin:0 0 6px">{data.fach.title} · {data.kapitel.title}</p>
<h1 style="margin:0">{data.thema.title}</h1>
<p class="muted" style="margin:5px 0 0;font-size:16px">
	{#if data.aufschriebe.length === 1}
		Aufschrieb vom {datum(data.aufschriebe[0].wann)} · {seitenLabel(data.seitenGesamt)}
	{:else}
		{data.aufschriebe.length} Aufschriebe · {seitenLabel(data.seitenGesamt)}
	{/if}
</p>

<p class="ki-hinweis" style="margin:16px 0 0">
	<span class="ki-hinweis__marke">{KI_MARKE}</span>
	<span>{KI_AUFSCHRIEB}</span>
</p>

<div class="raster">
	<div class="stapel">
		{#each data.aufschriebe as a (a.id)}
			<div class="card">
				<div class="row" style="margin-bottom:10px">
					<p class="eyebrow" style="margin:0">Darum geht es</p>
					<span class="small">{vorZeit(a.geaendert ?? a.wann)}</span>
				</div>
				<p class="text" {...kiErzeugt}>{a.zusammenfassung}</p>
				{#if a.begriffe.length}
					<div class="chips" {...kiErzeugt}>
						{#each a.begriffe as begriff (begriff)}
							<span class="chip" style="cursor:default">{begriff}</span>
						{/each}
					</div>
				{/if}
			</div>

			{#if a.abschrift}
				<div class="card">
					<div class="row" style="margin-bottom:10px">
						<p class="eyebrow" style="margin:0">Abschrift deiner Seiten</p>
						<span class="small">
							{a.seiten.length ? `Seite ${a.seiten.map((s) => s.nummer).join(', ')}` : ''}
						</span>
					</div>
					<p class="text abschrift" {...kiErzeugt}>{a.abschrift}</p>
				</div>
			{/if}
		{/each}
	</div>

	<div class="stapel">
		{#if data.fotosBehalten}
			<div class="card">
				<div class="row" style="margin-bottom:12px">
					<p class="eyebrow" style="margin:0">Deine Heftseiten</p>
					<span class="tag klein">nur für dich</span>
				</div>
				<div class="blaetter">
					<!-- Seiten in Heft-Reihenfolge, nicht in der Reihenfolge der Aufschriebe. -->
					{#each data.aufschriebe
						.flatMap((a) => a.seiten)
						.sort((a, b) => a.nummer - b.nummer) as seite (seite.nummer)}
						<span class="blatt">
							{#if seite.hatBild && seite.id}
								<img src="/schueler/seite/{seite.id}" alt="Seite {seite.nummer}" loading="lazy" />
							{/if}
							<span class="nummer">{seite.nummer}</span>
						</span>
					{/each}
				</div>
			</div>
		{:else}
			<div class="card card--tint">
				<p class="eyebrow" style="margin:0 0 8px">Deine Heftseiten</p>
				<p style="margin:0;font-size:16px;line-height:1.55">
					Die Fotos hast du nicht behalten. Zusammenfassung und Abschrift bleiben.
				</p>
				<a class="btn btn--plain" href="/schueler/konto" style="margin-top:8px;padding-inline:0">
					Einstellung ändern
				</a>
			</div>
		{/if}

		<a class="btn btn--lg btn--block" href="/schueler/kapitel/{data.kapitel.id}">
			{data.kapitel.title} durchgehen
		</a>
		<button
			type="button"
			class="btn btn--quiet btn--block"
			style="min-height:52px"
			onclick={() => (einordnen = !einordnen)}
		>
			Woanders einordnen
		</button>

		{#if einordnen}
			<div class="card card--tint">
				<p style="margin:0 0 12px;font-size:16px">
					„{data.thema.title}" – wohin gehört es?
				</p>
				{#if data.kapitelAuswahl.length}
					<form method="POST" action="?/verschieben" class="stapel">
						{#each data.kapitelAuswahl as ziel (ziel.id)}
							<button class="btn btn--quiet btn--block links" name="kapitelId" value={ziel.id}>
								{ziel.title}
							</button>
						{/each}
					</form>
				{/if}
				<form method="POST" action="?/verschieben" style="margin-top:12px">
					<label class="field">
						<span class="field__label">Oder in ein neues Kapitel</span>
						<input name="neuesKapitel" bind:value={neuesKapitel} placeholder="Name des Kapitels" />
					</label>
					<button class="btn btn--plain" style="margin-top:8px" disabled={!neuesKapitel.trim()}>
						Anlegen und hierhin legen
					</button>
				</form>
			</div>
		{/if}
	</div>
</div>

<style>
	.raster {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 20px;
	}
	.stapel {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.text {
		margin: 0 0 14px;
		font-size: 17px;
		line-height: 1.6;
	}
	.abschrift {
		margin: 0;
		font-size: 16px;
		line-height: 1.7;
		color: var(--ink-2);
		white-space: pre-wrap;
	}
	.klein {
		font-size: 12px;
	}
	.blaetter {
		display: flex;
		gap: 10px;
	}
	.blatt {
		position: relative;
		flex: 1;
		aspect-ratio: 3 / 4;
		border-radius: var(--r);
		border: 1px solid var(--line-2);
		background: repeating-linear-gradient(
			180deg,
			var(--paper-2) 0 10px,
			var(--surface) 10px 20px
		);
		overflow: hidden;
	}
	.blatt img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.nummer {
		position: absolute;
		left: 6px;
		bottom: 6px;
		padding: 2px 7px;
		border-radius: var(--r-pill);
		background: var(--surface);
		color: var(--ink-2);
		font-family: var(--display);
		font-weight: 600;
		font-size: 12px;
	}
	.links {
		justify-content: flex-start;
		min-height: 50px;
	}

	@media (min-width: 860px) {
		.raster {
			display: grid;
			grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
			align-items: start;
			gap: 18px;
		}
	}
</style>
