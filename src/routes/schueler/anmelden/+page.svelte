<script lang="ts">
	let { form } = $props();
</script>

<h1 style="margin:0 0 18px">Anmelden</h1>

{#if form?.message}
	<div class="meldung meldung--fehler">{form.message}</div>
{/if}

<form method="POST" class="stack" style="max-width:420px">
	<label class="field">
		<span class="field__label">Pseudonym</span>
		<input name="pseudonym" value={form?.pseudonym ?? ''} autocapitalize="none" required />
	</label>
	<label class="field">
		<span class="field__label">Passwort</span>
		<input name="password" type="password" required />
	</label>
	<button class="btn btn--lg btn--block">Anmelden</button>
</form>

<p class="small" style="margin:18px 2px 0">
	Zum ersten Mal hier? <a href="/schueler/registrieren">Mit Klassencode starten</a>
</p>
