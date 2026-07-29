<script lang="ts">
	import { page } from '$app/state';
	import { fachTon, vorZeit } from '$lib/heft';
	import type { Fach } from '$lib/server/heft';

	let { data } = $props();

	const heute = new Intl.DateTimeFormat('de-DE', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).format(new Date());

	const leer = $derived(data.faecher.length === 0);
	const gewaehlt = $derived(page.url.searchParams.get('fach'));
	// Ein Inhaltsverzeichnis zeigt immer genau EIN Fach — am Rechner das aus der Spalte
	// gewählte, am Handy erst die Übersicht und nach dem Antippen ebenfalls nur dieses.
	const fachIndex = $derived(
		Math.max(
			0,
			data.faecher.findIndex((f: Fach) => f.id === gewaehlt)
		)
	);
	const fach = $derived(data.faecher[fachIndex]);
</script>

{#snippet kapitelListe(f: Fach, ton: string)}
	{#each f.kapitel as kapitel (kapitel.id)}
		{#if kapitel.themen.length}
			<section class="kapitel">
				<div class="row kapitel__kopf">
					<h3>{kapitel.title}</h3>
					<span class="small">
						{kapitel.themen.length}
						{kapitel.themen.length === 1 ? 'Thema' : 'Themen'}
					</span>
				</div>
				<div class="themen">
					{#each kapitel.themen as thema (thema.id)}
						<div class="card thema">
							<span class="punkt" style="background:var(--{ton}-ink)"></span>
							<span class="titel">{thema.title}</span>
							<span class="small wann">
								{thema.zuletzt ? vorZeit(thema.zuletzt) : 'noch kein Aufschrieb'}
							</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/each}
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
		<p class="eyebrow" style="margin:0 0 6px">Mein Inhaltsverzeichnis</p>
		<h1 style="margin:0">{fach.title}</h1>
		<p class="muted" style="margin:5px 0 0;font-size:16px">
			{fach.anzahlThemen}
			{fach.anzahlThemen === 1 ? 'Thema' : 'Themen'} in {fach.kapitel.length}
			{fach.kapitel.length === 1 ? 'Kapitel' : 'Kapiteln'}
		</p>
		{@render kapitelListe(fach, fachTon(fachIndex))}
	</div>

	<!-- Handy: erst die Übersicht über alle Fächer, dann eines im Ganzen. -->
	<div class="nurHandy">
		{#if gewaehlt}
			<a href="/schueler" class="btn btn--plain zurueck">Alle Fächer</a>
			<h1 style="margin:0">{fach.title}</h1>
			<p class="muted" style="margin:5px 0 0;font-size:16px">
				{fach.anzahlThemen}
				{fach.anzahlThemen === 1 ? 'Thema' : 'Themen'}
			</p>
			{@render kapitelListe(fach, fachTon(fachIndex))}
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
							<span class="fachpunkt" style="background:var(--{ton}-ink)"></span>{f.title}
						</h3>
						<span class="small" style="font-size:13px">
							{f.anzahlThemen}
							{f.anzahlThemen === 1 ? 'Thema' : 'Themen'}
						</span>
					</div>
					<div class="card liste">
						{#each f.kapitel.flatMap((k) => k.themen).slice(0, 3) as thema (thema.id)}
							<div class="zeile">
								<span class="punkt" style="background:var(--{ton}-ink)"></span>
								<span class="titel">{thema.title}</span>
								<span class="small wann">
									{thema.zuletzt ? vorZeit(thema.zuletzt) : 'noch kein Aufschrieb'}
								</span>
							</div>
						{/each}
						{#if f.anzahlThemen > 3}
							<a href="/schueler?fach={f.id}" class="btn btn--plain alle">
								Alle {f.anzahlThemen} in {f.title}
							</a>
						{/if}
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
	.fachpunkt {
		width: 9px;
		height: 9px;
		border-radius: 3px;
	}
	/* Das Kapitel ist die Klammer: eigene Überschrift, eingerückter Block, eigene Karten. */
	.kapitel {
		margin-top: 26px;
		padding-left: 14px;
		border-left: 2px solid var(--line);
	}
	.kapitel__kopf {
		margin-bottom: 10px;
		margin-left: -14px;
		padding-left: 14px;
	}
	.themen {
		display: grid;
		gap: 8px;
	}
	.thema {
		display: grid;
		grid-template-columns: 10px 1fr auto;
		gap: 13px;
		align-items: center;
		min-height: 64px;
		padding: 12px 16px;
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
	.alle {
		width: 100%;
		justify-content: flex-start;
		min-height: 50px;
		font-size: 15px;
	}

	@media (min-width: 860px) {
		.nurRechner {
			display: block;
		}
		.nurHandy {
			display: none;
		}
		.liste {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 4px;
		}
		.themen {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}
	}
</style>
