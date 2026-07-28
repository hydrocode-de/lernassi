<script lang="ts">
	let { form } = $props();
</script>

<h1>Lehrkraft registrieren</h1>
{#if form?.message}<div class="msg error">{form.message}</div>{/if}

<div class="card">
	<form method="POST">
		<label for="name">Name</label>
		<input id="name" name="name" value={form?.name ?? ''} required />
		<label for="email">E-Mail</label>
		<input id="email" name="email" type="email" value={form?.email ?? ''} required />
		<label for="password">Passwort (min. 6 Zeichen)</label>
		<input id="password" name="password" type="password" required />
		<button>Registrieren</button>
	</form>
</div>
<p class="muted">Schon ein Konto? <a href="/lehrer/anmelden">Anmelden</a></p>
