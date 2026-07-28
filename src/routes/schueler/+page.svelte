<script lang="ts">
	let { data } = $props();
</script>

<h1>Hallo {data.pseudonym}!</h1>
<p class="muted">Deine Klasse: {data.className}</p>

<h2>Deine Lernziele</h2>
{#if data.goals.length === 0}
	<p class="muted">Noch keine Lernziele. Deine Lehrkraft legt sie an.</p>
{:else}
	<ul class="clean">
		{#each data.goals as g (g.id)}
			<li>
				<div>
					<strong>{g.title}</strong>
					{#if g.description}<div class="muted">{g.description}</div>{/if}
				</div>
				{#if g.subject}<span class="pill">{g.subject}</span>{/if}
			</li>
		{/each}
	</ul>
	<div class="card">
		<p class="muted">Das gemeinsame Lernen mit der KI (Foto deiner Aufschriebe, Einordnung, dein Lernplan) kommt im nächsten Schritt (M2).</p>
	</div>
{/if}
