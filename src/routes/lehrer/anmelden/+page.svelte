<script lang="ts">
	let { form } = $props();
</script>

<h1>Lehrkraft anmelden</h1>
{#if form?.message}<div class="msg error">{form.message}</div>{/if}

<div class="card">
	<form method="POST">
		<label for="email">E-Mail</label>
		<input id="email" name="email" type="email" value={form?.email ?? ''} required />
		<label for="password">Passwort</label>
		<input id="password" name="password" type="password" required />
		<button>Anmelden</button>
	</form>
</div>
<p class="muted">Kein Konto? <a href="/lehrer/registrieren">Registrieren</a></p>
