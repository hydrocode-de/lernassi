<script lang="ts">
	let { form } = $props();
</script>

<h1 style="margin:0 0 18px">Konto anlegen</h1>

{#if form?.message}
	<div class="meldung meldung--fehler">{form.message}</div>
{/if}

<form method="POST" class="stack" style="max-width:420px">
	<label class="field">
		<span class="field__label">Name</span>
		<input name="name" value={form?.name ?? ''} required />
	</label>
	<label class="field">
		<span class="field__label">E-Mail</span>
		<input name="email" type="email" value={form?.email ?? ''} required />
	</label>
	<div>
		<label class="field">
			<span class="field__label">Passwort</span>
			<input name="password" type="password" required />
		</label>
		<p class="field__hint">Mindestens 6 Zeichen.</p>
	</div>
	<button class="btn btn--go btn--lg btn--block">Konto anlegen</button>
</form>

<p class="small" style="margin:18px 2px 0">
	Schon ein Konto? <a href="/lehrer/anmelden">Anmelden</a>
</p>
