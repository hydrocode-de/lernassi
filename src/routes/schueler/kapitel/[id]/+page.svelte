<script lang="ts">
	import { vorZeit } from '$lib/heft';

	let { data } = $props();

	const themenLabel = (n: number) => `${n} ${n === 1 ? 'Thema' : 'Themen'}`;
	// Nichts Neues da: nachfragen, ob wirklich nochmal — und das Abhaken gleich mitanbieten.
	const nochmal = $derived(data.schonEingeordnet && !data.nurNeues);
</script>

<p style="margin:0 0 10px">
	<a href="/schueler?fach={data.fachId}" class="btn btn--plain zurueck">Zurück zum Verzeichnis</a>
</p>

<p class="eyebrow" style="margin:0 0 6px">{data.fach}</p>
<h1 style="margin:0">{data.kapitel}</h1>
<p class="muted" style="margin:5px 0 0;font-size:16px">
	{themenLabel(data.themen.length)} in deinem Heft{data.zuletzt
		? ` · zuletzt eingeordnet ${vorZeit(data.zuletzt)}`
		: ''}
</p>

{#if data.fortsetzen}
	<div class="card card--tint" style="margin-top:22px">
		<p style="margin:0 0 12px;font-size:17px;line-height:1.55">
			Du warst heute schon mitten in dieser Runde. Willst du da weitermachen?
		</p>
		<div class="knoepfe">
			<a class="btn btn--go" href="/schueler/runde/{data.fortsetzen}">Weitermachen</a>
			<form method="POST" action="?/start">
				<button class="btn btn--quiet">Neu anfangen</button>
			</form>
		</div>
	</div>
{/if}

<!-- Was ich zu diesem Kapitel habe und was nicht. Einmal gesagt, bevor es losgeht. -->
<div class="card" style="margin-top:22px">
	<p class="eyebrow" style="margin:0 0 10px">Das habe ich von dir</p>
	{#if data.themen.length}
		<div class="chips" style="margin-bottom:14px">
			<!-- Nach Position schlüsseln, nicht nach Titel: zwei Themen dürfen gleich heißen. -->
			{#each data.themen as thema, i (i)}
				<span class="chip" style="cursor:default">{thema}</span>
			{/each}
		</div>
	{/if}

	<!-- „Neu" gibt es erst, wenn schon einmal eingeordnet wurde — beim ersten Mal ist alles neu,
	     und dann ist „neu" keine Information, sondern eine Verwirrung. -->
	{#if data.schonEingeordnet && data.nurNeues}
		<p style="margin:0;font-size:17px;line-height:1.55">
			Neu seit dem letzten Mal: {data.neueThemen.join(', ')}. Genau darum geht es diesmal – das
			andere hast du schon eingeordnet.
		</p>
	{:else if nochmal}
		<p style="margin:0;font-size:17px;line-height:1.55">
			Neu ist hier nichts dazugekommen. Wir können das Kapitel trotzdem nochmal durchgehen.
		</p>
	{:else}
		<p style="margin:0;font-size:17px;line-height:1.55">
			Ich gehe mit dir {themenLabel(data.nimmtSichVor.length)} durch – alles aus deinem eigenen Heft.
		</p>
	{/if}

	{#if data.ohneAufschrieb.length}
		<p class="small" style="margin:12px 0 0">
			Zu {data.ohneAufschrieb.join(', ')} habe ich noch keinen Aufschrieb. Danach frage ich nicht.
		</p>
	{/if}
</div>

{#if nochmal}
	<div class="card" style="margin-top:14px">
		<p style="margin:0 0 12px;font-size:17px;line-height:1.55">
			Vielleicht willst du lieber etwas aus deinem Lernplan abhaken?
		</p>
		<a class="btn btn--quiet" href="/schueler/plan">Zu meinem Lernplan</a>
	</div>
{/if}

<!-- Steuer-Frage: „ja" bricht ab, „nein" macht weiter. Wird nicht bewertet. -->
<div class="card" style="margin-top:14px">
	<p style="margin:0 0 14px;font-size:17px;line-height:1.55">
		Hast du zu diesem Kapitel vielleicht noch eine Heftseite, die ich nicht kenne?
	</p>
	<div class="stapel">
		<a
			class="btn btn--quiet btn--block links"
			href="/schueler/aufnehmen?weiter=/schueler/kapitel/{data.kapitelId}"
		>
			Ja, die fotografiere ich erst
		</a>
		<form method="POST" action="?/start">
			<button class="btn btn--lg btn--block" disabled={!data.themen.length}>
				{nochmal ? 'Nein, nochmal durchgehen' : 'Nein, los geht’s'}
			</button>
		</form>
	</div>
	{#if !data.themen.length}
		<p class="small" style="margin:12px 0 0">
			Zu diesem Kapitel habe ich noch keinen einzigen Aufschrieb. Fotografiere ihn zuerst.
		</p>
	{/if}
</div>

<style>
	.zurueck {
		padding-inline: 0;
		min-height: 44px;
	}
	.stapel {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.links {
		justify-content: flex-start;
		min-height: 54px;
	}
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.knoepfe :global(.btn) {
		min-height: 52px;
	}
</style>
