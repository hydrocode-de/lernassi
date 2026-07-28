<script lang="ts">
	let { form } = $props();
</script>

<h1>Anmeldung fürs Lernen</h1>
<p class="muted">Deine Lehrkraft gibt dir einen <strong>Klassencode</strong> und ein <strong>Pseudonym</strong>. Ein Passwort denkst du dir selbst aus.</p>
{#if form?.message}<div class="msg error">{form.message}</div>{/if}

<div class="card">
	<form method="POST">
		<label for="code">Klassencode</label>
		<input id="code" name="code" value={form?.code ?? ''} placeholder="z. B. K7M2PQ" required />
		<label for="pseudonym">Pseudonym</label>
		<input id="pseudonym" name="pseudonym" value={form?.pseudonym ?? ''} placeholder="z. B. mutig_tiger_42" required />
		<label for="password">Passwort (min. 6 Zeichen)</label>
		<input id="password" name="password" type="password" required />
		<button>Los geht's</button>
	</form>
</div>
<p class="muted">Schon registriert? <a href="/schueler/anmelden">Anmelden</a></p>
