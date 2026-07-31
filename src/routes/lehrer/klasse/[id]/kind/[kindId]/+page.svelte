<script lang="ts">
	import type { Rueckschau } from '$lib/server/uebung';

	let { data } = $props();
	const rueckschau = (wert: string) => data.rueckschauen[wert as Rueckschau] ?? '–';
</script>

<p class="eyebrow" style="margin:0 0 6px">{data.cls.name}</p>
<h1 style="margin:0 0 6px">{data.kind.name}</h1>
<p class="muted" style="margin:0 0 26px">
	{data.kind.plan.offen} offen · {data.kind.plan.erledigt} abgehakt
</p>

{#if data.kind.themen.length}
	<h2 style="margin:0 0 12px">Wo es steht</h2>
	<div class="chips" style="margin-bottom:28px">
		{#each data.kind.themen as t (t.topicId)}
			<span class="chip chip--{data.kategorien[t.kategorie].farbe}">
				<span class="chip__dot"></span>{t.titel} – {data.kategorien[t.kategorie].wort}
			</span>
		{/each}
	</div>
{/if}

<h2 style="margin:0 0 12px">Selbsteinschätzung und Ergebnis</h2>
{#if data.kind.uebungen.length}
	<div class="card">
		<table class="verlauf">
			<thead>
				<tr><th>Wann</th><th>Vorher</th><th>Hinterher</th><th>Ergebnis</th></tr>
			</thead>
			<tbody>
				{#each data.kind.uebungen as u (u.wann)}
					<tr>
						<td>{new Date(u.wann).toLocaleDateString('de-DE')}</td>
						<td>{u.vorher ? data.sicherheiten[u.vorher - 1] : '–'}</td>
						<td>{u.nachher ? rueckschau(u.nachher) : '–'}</td>
						<td>{u.kategorie ? data.kategorien[u.kategorie].wort : '–'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted" style="margin:0">Noch keine Übung abgeschlossen.</p>
{/if}

<p class="small zugang">Zugang {data.kind.pseudonym}</p>

<style>
	.verlauf {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}
	.verlauf th,
	.verlauf td {
		text-align: left;
		padding: 7px 10px 7px 0;
		border-bottom: 1px solid var(--line);
	}
	.verlauf tr:last-child td {
		border-bottom: 0;
	}
	.verlauf th {
		font-family: var(--display);
		font-weight: 600;
		font-size: 13px;
		color: var(--ink-3);
	}
	.zugang {
		margin: 32px 0 0;
		font-family: var(--mono, monospace);
	}
</style>
