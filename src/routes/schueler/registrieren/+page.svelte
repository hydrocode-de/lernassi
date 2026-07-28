<script lang="ts">
	let { form } = $props();
</script>

<h1 style="margin:0 0 6px">Willkommen</h1>
<p class="muted" style="margin:0 0 18px;font-size:16px">
	Deine Lehrkraft gibt dir einen Klassencode und ein Pseudonym. Ein Passwort denkst du dir selbst
	aus – merk es dir gut.
</p>

{#if form?.message}
	<div class="meldung meldung--fehler">{form.message}</div>
{/if}

<form method="POST" class="stack" style="max-width:420px">
	<label class="field">
		<span class="field__label">Klassencode</span>
		<input
			name="code"
			value={form?.code ?? ''}
			class="mono"
			autocapitalize="characters"
			autocomplete="off"
			required
		/>
	</label>
	<label class="field">
		<span class="field__label">Pseudonym</span>
		<input name="pseudonym" value={form?.pseudonym ?? ''} autocapitalize="none" required />
	</label>
	<div>
		<label class="field">
			<span class="field__label">Passwort</span>
			<input name="password" type="password" required />
		</label>
		<p class="field__hint">Mindestens 6 Zeichen.</p>
	</div>
	<button class="btn btn--go btn--lg btn--block">Los geht's</button>
</form>

<p class="small" style="margin:18px 2px 0">
	Schon dabei? <a href="/schueler/anmelden">Anmelden</a>
</p>
