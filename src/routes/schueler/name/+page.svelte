<script lang="ts">
	import { RUFNAME_MAX } from '$lib/rufname';

	let { data, form } = $props();
</script>

<div class="mitte">
	<h1 style="margin:0 0 10px">Wie sollen wir dich nennen?</h1>
	<p class="muted" style="margin:0 0 22px">
		Dein Vorname reicht. Deine Lehrerin sieht ihn, damit sie weiß, wer du bist. Du kannst ihn
		jederzeit ändern.
	</p>

	{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}

	<form method="POST" class="stack">
		<label class="field">
			<span class="field__label">Vorname</span>
			<input name="rufname" maxlength={RUFNAME_MAX} autocomplete="given-name" />
		</label>
		<button class="btn">Weiter</button>
	</form>

	<a href="/schueler" class="btn btn--plain ueberspringen">Lieber nicht</a>

	<p class="small" style="margin:24px 0 0">
		Ohne Vornamen heißt du hier {data.pseudonym}.
	</p>
</div>

<style>
	.mitte {
		max-width: 420px;
		margin: 24px auto 0;
	}
	.ueberspringen {
		margin-top: 8px;
		width: 100%;
		min-height: 50px;
	}
</style>
