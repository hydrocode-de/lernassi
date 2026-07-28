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
<p class="muted" style="margin:0 0 20px;font-size:16px">
	{seitenText} aus deinem Heft · {data.fach}
</p>

<div class="stack" style="gap:14px">
	{#each data.themen as thema (thema.id)}
		<div class="card">
			<div class="kopf">
				<div>
					<h3 style="margin:0 0 2px">{thema.thema}</h3>
					<p class="small" style="margin:0">
						{thema.kapitel}
						{#if thema.seiten.length}
							· Seite {thema.seiten.join(' und ')}
						{/if}
					</p>
				</div>
			</div>

			<p style="margin:12px 0;font-size:17px;line-height:1.55">{thema.zusammenfassung}</p>

			{#if thema.begriffe.length}
				<div class="chips">
					{#each thema.begriffe as begriff (begriff)}
						<span class="chip" style="cursor:default">{begriff}</span>
					{/each}
				</div>
			{/if}

			{#if data.kapitelAuswahl.length > 1}
				<button
					class="btn btn--plain"
					style="margin-top:12px;padding-inline:0"
					onclick={() => (offen = offen === thema.id ? null : thema.id)}
				>
					{offen === thema.id ? 'Abbrechen' : 'Woanders einordnen'}
				</button>

				{#if offen === thema.id}
					<form method="POST" action="?/verschieben" class="stack" style="margin-top:8px">
						<input type="hidden" name="noteId" value={thema.id} />
						{#each data.kapitelAuswahl as kapitel (kapitel.id)}
							<button
								class="btn btn--quiet btn--block"
								name="kapitelId"
								value={kapitel.id}
								style="justify-content:flex-start;min-height:52px"
								disabled={kapitel.title === thema.kapitel}
							>
								{kapitel.title}
							</button>
						{/each}
					</form>
				{/if}
			{/if}
		</div>
	{/each}
</div>

<a href="/schueler" class="btn btn--go btn--lg btn--block" style="margin-top:18px">
	Passt so – speichern
</a>

<style>
	.kopf {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	@media (min-width: 860px) {
		:global(.stack) {
			gap: 14px;
		}
	}
</style>
