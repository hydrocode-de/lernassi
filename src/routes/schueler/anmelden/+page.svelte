<script lang="ts">
	let { form } = $props();
</script>

<h1>Anmelden</h1>
{#if form?.message}<div class="msg error">{form.message}</div>{/if}

<div class="card">
	<form method="POST">
		<label for="pseudonym">Pseudonym</label>
		<input id="pseudonym" name="pseudonym" value={form?.pseudonym ?? ''} required />
		<label for="password">Passwort</label>
		<input id="password" name="password" type="password" required />
		<button>Anmelden</button>
	</form>
</div>
<p class="muted">Noch nicht dabei? <a href="/schueler/registrieren">Hier registrieren</a></p>
