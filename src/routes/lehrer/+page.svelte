<script lang="ts">
	let { data, form } = $props();
</script>

<h1>Meine Klassen</h1>
{#if form?.message}<div class="msg error">{form.message}</div>{/if}
{#if form?.ok}<div class="msg ok">{form.ok}</div>{/if}

<div class="card">
	<h2 style="margin-top:0">Neue Klasse</h2>
	<form method="POST" action="?/createClass" class="row">
		<div style="flex:1">
			<label for="name">Klassenname</label>
			<input id="name" name="name" placeholder="z. B. 7b Geschichte" required />
		</div>
		<button>Anlegen</button>
	</form>
</div>

{#if data.classes.length === 0}
	<p class="muted">Noch keine Klassen. Leg oben deine erste an.</p>
{:else}
	<ul class="clean">
		{#each data.classes as c (c.id)}
			<li>
				<a href="/lehrer/klasse/{c.id}">{c.name}</a>
				<span class="pill code">{c.joinCode}</span>
			</li>
		{/each}
	</ul>
{/if}
