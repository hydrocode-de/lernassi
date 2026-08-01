<script lang="ts">
	import { kiErzeugt } from '$lib/ki';
	let { data, form } = $props();

	const wann = (dueAt: number | null) =>
		dueAt
			? `bis ${new Date(dueAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
			: 'ohne Termin';

	const tag = (ms: number) =>
		new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
</script>

<p class="eyebrow" style="margin:0 0 6px">Mein Lernplan</p>
<h1 style="margin:0">
	{data.offene ? `${data.offene} ${data.offene === 1 ? 'Punkt' : 'Punkte'} offen` : 'Alles abgehakt'}
</h1>
<p class="muted" style="margin:5px 0 0;font-size:16px">
	Was du dir selbst vorgenommen hast. Abhaken kannst du auch, wenn du es woanders geübt hast.
</p>

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}
{#if form?.ok}<div class="meldung meldung--ok">{form.ok}</div>{/if}

{#if data.naechste}
	<a class="btn btn--lg" href="/schueler/ueben/neu" style="margin-top:18px">Üben</a>
{/if}

{#if data.vorschlag}
	<div class="card card--tint" style="margin-top:18px">
		<p style="margin:0 0 4px;font-size:16px;line-height:1.55">
			Am {tag(data.vorschlag.dueAt)} ist es soweit.
			{data.vorschlag.karten.length === 1 ? 'Ein Punkt dafür steht' : `${data.vorschlag.karten.length} Punkte dafür stehen`}
			weit hinten.
		</p>
		<ul class="vorschlagsliste">
			{#each data.vorschlag.karten as k (k.id)}
				<li {...kiErzeugt}>{k.auftrag}</li>
			{/each}
		</ul>
		<form method="POST" action="?/vorziehen">
			{#each data.vorschlag.karten as k (k.id)}
				<input type="hidden" name="id" value={k.id} />
			{/each}
			<button class="btn">Nach vorne holen</button>
		</form>
	</div>
{/if}

{#if !data.faecher.length}
	<div class="card card--tint" style="margin-top:26px">
		<p style="margin:0;font-size:16px;line-height:1.55">
			Hier ist noch nichts. Geh in deinem Inhaltsverzeichnis ein Kapitel durch – am Ende suchst du
			dir selbst aus, was auf deinen Plan kommt.
		</p>
		<a class="btn btn--quiet" href="/schueler" style="margin-top:14px">Zum Inhaltsverzeichnis</a>
	</div>
{:else}
	{#each data.faecher as fach (fach.id)}
		<section style="margin-top:26px">
			<div class="row" style="margin-bottom:10px">
				<h3>{fach.title}</h3>
				<a class="btn btn--plain klein" href="/schueler?fach={fach.id}">Verzeichnis</a>
			</div>
			<div class="stapel">
				{#each fach.punkte as p (p.id)}
					<div class="card punkt" class:erledigt={p.status === 'erledigt'} class:weg={p.status === 'verworfen'}>
						<div class="punkt__text">
							<span class="auftrag" {...kiErzeugt}>{p.auftrag}</span>
							<span class="small">
								{p.minutes ? `etwa ${p.minutes} Minuten` : 'kurz'}
								{#if p.kapitel}· {p.kapitel}{/if}
								· {wann(p.dueAt)}
							</span>
						</div>
						<div class="punkt__knoepfe">
							{#if p.status === 'offen'}
								<a class="btn klein" href="/schueler/ueben/karte/{p.id}">Üben</a>
							{#if data.gespraech}
								<a class="btn klein" href="/schueler/gespraech/karte/{p.id}">Im Gespräch</a>
							{/if}
								<form method="POST" action="?/abhaken">
									<input type="hidden" name="id" value={p.id} />
									<button class="btn btn--go klein">Abgehakt</button>
								</form>
								<form method="POST" action="?/verwerfen">
									<input type="hidden" name="id" value={p.id} />
									<button class="btn btn--plain klein">Weglegen</button>
								</form>
							{:else}
								<span class="tag" class:tag--mint={p.status === 'erledigt'}>
									{p.status === 'erledigt' ? 'erledigt' : 'weggelegt'}
								</span>
								<form method="POST" action="?/zurueckholen">
									<input type="hidden" name="id" value={p.id} />
									<button class="btn btn--plain klein">Wieder offen</button>
								</form>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/each}
{/if}

<style>
	.stapel {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.punkt {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 16px;
	}
	.punkt.erledigt {
		background: var(--paper-2);
		border-color: transparent;
	}
	.punkt.weg {
		background: var(--paper-2);
		border-color: transparent;
		opacity: 0.7;
	}
	.punkt.erledigt .auftrag {
		text-decoration: line-through;
		text-decoration-color: var(--line-2);
	}
	.punkt__text {
		min-width: 12rem;
		flex: 1;
	}
	.auftrag {
		display: block;
		font-size: 16px;
		line-height: 1.4;
	}
	.punkt__text .small {
		display: block;
		font-size: 13px;
	}
	.punkt__knoepfe {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.klein {
		min-height: 44px;
		font-size: 14px;
	}
	.vorschlagsliste {
		margin: 8px 0 14px;
		padding-left: 20px;
		font-size: 15px;
		line-height: 1.5;
	}
</style>
