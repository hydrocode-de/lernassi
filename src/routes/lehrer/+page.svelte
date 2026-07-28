<script lang="ts">
	let { data, form } = $props();
</script>

<h1 style="margin:0 0 18px">Meine Klassen</h1>

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}
{#if form?.ok}<div class="meldung meldung--ok">{form.ok}</div>{/if}

<div class="card">
	<h3 style="margin:0 0 4px">Neue Klasse</h3>
	<p class="small" style="margin:0 0 12px">Ein Klassencode entsteht automatisch.</p>
	<form method="POST" action="?/createClass" class="stack">
		<label class="field">
			<span class="field__label">Name der Klasse</span>
			<input name="name" placeholder="z. B. 9b Geschichte" required />
		</label>
		<button class="btn">Anlegen</button>
	</form>
</div>

{#if data.classes.length === 0}
	<p class="muted" style="margin-top:20px">Noch keine Klasse angelegt.</p>
{:else}
	<ul class="liste" style="margin-top:22px">
		{#each data.classes as klasse (klasse.id)}
			<li>
				<a href="/lehrer/klasse/{klasse.id}" style="font-size:17px">{klasse.name}</a>
				<span class="tag mono">{klasse.joinCode}</span>
			</li>
		{/each}
	</ul>
{/if}
