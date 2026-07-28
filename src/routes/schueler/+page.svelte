<script lang="ts">
	import { fachTon, vorZeit } from '$lib/heft';

	let { data } = $props();

	const heute = new Intl.DateTimeFormat('de-DE', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).format(new Date());

	const leer = $derived(data.faecher.length === 0);
</script>

<p class="eyebrow" style="margin:0 0 6px">{heute}</p>
<h1 style="margin:0 0 5px">Mein Inhaltsverzeichnis</h1>
<p class="muted" style="margin:0 0 18px;font-size:16px">Wächst mit jedem Aufschrieb.</p>

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
		<path d="M4 8.5h2.6l1.3-2h8.2l1.3 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
		<circle cx="12" cy="13.5" r="3.4" />
	</svg>
	Aufschrieb fotografieren
</a>
<p class="small" style="margin:9px 2px 0;text-align:center">
	Heft aufschlagen, abfotografieren – die Einordnung mache ich.
</p>

{#if leer}
	<div class="card card--tint" style="margin-top:26px">
		<p style="margin:0;font-size:16px;line-height:1.55">
			Hier ist noch nichts. Fotografiere deinen ersten Aufschrieb – daraus baue ich dein
			Inhaltsverzeichnis auf.
		</p>
	</div>
{:else}
	{#each data.faecher as fach, i (fach.id)}
		{@const ton = fachTon(i)}
		<section style="margin-top:26px">
			<div class="row" style="margin-bottom:8px">
				<h3 style="display:flex;align-items:center;gap:9px">
					<span class="marke" style="background:var(--{ton}-ink)"></span>{fach.title}
				</h3>
				<span class="small" style="font-size:13px">
					{fach.anzahlThemen}
					{fach.anzahlThemen === 1 ? 'Thema' : 'Themen'}
				</span>
			</div>

			{#each fach.kapitel as kapitel (kapitel.id)}
				{#if kapitel.themen.length}
					<p class="eyebrow" style="margin:14px 0 6px">{kapitel.title}</p>
					<div class="card liste">
						{#each kapitel.themen as thema (thema.id)}
							<div class="zeile">
								<span class="punkt" style="background:var(--{ton}-ink)"></span>
								<span class="titel">{thema.title}</span>
								<span class="small wann">
									{thema.zuletzt ? vorZeit(thema.zuletzt) : 'noch kein Aufschrieb'}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			{/each}
		</section>
	{/each}
{/if}

<style>
	.gross {
		min-height: 66px;
		gap: 12px;
		font-size: 20px;
	}
	.marke {
		width: 9px;
		height: 9px;
		border-radius: 3px;
	}
	.liste {
		padding: 5px 6px;
	}
	.zeile {
		display: grid;
		grid-template-columns: 10px 1fr auto;
		gap: 12px;
		align-items: center;
		min-height: 58px;
		padding: 10px 12px;
		border-radius: var(--r);
	}
	.punkt {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.titel {
		font-size: 16px;
	}
	.wann {
		font-size: 13px;
		white-space: nowrap;
	}

	@media (min-width: 860px) {
		.gross {
			max-width: 420px;
		}
		.liste {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 4px;
		}
	}
</style>
