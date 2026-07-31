<script lang="ts">
	let { data, form } = $props();
</script>

<h1 style="margin:0 0 18px">Meine Klassen</h1>

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}
{#if form?.ok}<div class="meldung meldung--ok">{form.ok}</div>{/if}

{#if data.classes.length === 0}
	<p class="muted" style="margin:0 0 22px">Noch keine Klasse angelegt.</p>
{:else}
	<ul class="liste" style="margin:0 0 28px">
		{#each data.classes as klasse (klasse.id)}
			<li>
				<a href="/lehrer/klasse/{klasse.id}" style="font-size:17px">{klasse.name}</a>
				<span class="tag mono">{klasse.joinCode}</span>
			</li>
		{/each}
	</ul>
{/if}

<div class="card">
	<h3 style="margin:0 0 12px">Neue Klasse</h3>
	<form method="POST" action="?/createClass" class="stack">
		<label class="field">
			<span class="field__label">Name</span>
			<input name="name" placeholder="z. B. Geschichte 9b" value={form?.name ?? ''} required />
		</label>
		<div class="zweispaltig">
			<label class="field">
				<span class="field__label">Klasse</span>
				<input name="grade" placeholder="z. B. 9b" value={form?.grade ?? ''} />
			</label>
			<label class="field">
				<span class="field__label">Fach</span>
				<input name="subject" placeholder="z. B. Geschichte" value={form?.subject ?? ''} required />
			</label>
		</div>
		<button class="btn">Anlegen</button>
	</form>
</div>

<style>
	.zweispaltig {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.zweispaltig .field {
		flex: 1;
		min-width: 10rem;
	}
</style>
