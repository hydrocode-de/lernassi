<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { KI_MARKE, KI_SCHREIBEN } from '$lib/ki';

	let { data, form } = $props();

	// Der Anfangsstand, und nur der: nach einem Fehlschlag steht der Text im Formular-Ergebnis
	// (sonst käme das Feld leer zurück und die Arbeit des Kindes wäre weg), danach gehört das
	// Feld dem Kind. `untrack`, weil hier bewusst der Startwert gelesen wird.
	let titel = $state(untrack(() => form?.titel ?? data.note?.titel ?? ''));
	let text = $state(untrack(() => form?.text ?? data.note?.text ?? ''));
	let laeuft = $state(false);

	const bereit = $derived(text.trim().length >= data.mindestens);
	const stelle = $derived(
		data.davor ? `hinter „${data.davor}"` : data.stelle === 'anfang' ? 'ganz oben' : 'am Ende'
	);
	const zurueck = $derived(
		data.note ? `/schueler/thema/${data.note.id}` : `/schueler?fach=${data.fach.id}&bearbeiten=1`
	);
</script>

{#if laeuft}
	<div class="warten">
		<div class="blatt"><div class="sweep"></div></div>
		<div>
			<h1 style="margin:0 0 8px">Ich lese, was du geschrieben hast</h1>
			<p class="muted" style="margin:0;font-size:16px">Dauert meist keine Minute.</p>
		</div>
		<div class="punkte"><span></span><span></span><span></span></div>
	</div>
{:else}
	<a href={zurueck} class="btn btn--plain zurueckknopf">
		{data.note ? 'Abbrechen' : 'Zurück zum Verzeichnis'}
	</a>

	<p class="eyebrow" style="margin:0 0 6px">{data.fach.title} · {data.kapitel.title}</p>
	<h1 style="margin:0 0 5px">{data.note ? 'Text bearbeiten' : 'Seite selbst schreiben'}</h1>
	<p class="muted" style="margin:0 0 14px;font-size:16px">
		{#if data.note}
			Deine Zusammenfassung schreibe ich danach neu.
		{:else}
			Kommt in „{data.kapitel.title}", {stelle}.
		{/if}
	</p>

	<p class="ki-hinweis" style="margin:0 0 20px">
		<span class="ki-hinweis__marke">{KI_MARKE}</span>
		<span>{KI_SCHREIBEN}</span>
	</p>

	{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}

	<form
		method="POST"
		use:enhance={() => {
			laeuft = true;
			return async ({ update }) => {
				laeuft = false;
				await update({ reset: false });
			};
		}}
	>
		{#if data.note}<input type="hidden" name="note" value={data.note.id} />{/if}
		<input type="hidden" name="kapitel" value={data.kapitel.id} />
		<input type="hidden" name="nach" value={data.stelle} />

		<label class="field" style="margin-bottom:12px">
			<span class="field__label">Titel</span>
			<input
				name="titel"
				bind:value={titel}
				maxlength="120"
				placeholder={data.note ? '' : 'Lass es leer – dann schlage ich einen vor'}
			/>
		</label>

		<label class="field feld">
			<span class="field__label">Dein Text</span>
			<textarea
				name="text"
				bind:value={text}
				rows="14"
				maxlength="20000"
				placeholder="Schreib auf, was im Unterricht dran war – so, wie du es im Heft stehen hättest."
			></textarea>
		</label>

		<div class="fuss">
			<p class="small" style="margin:0">
				{#if bereit}
					{text.trim().length} Zeichen
				{:else}
					Noch {Math.max(0, data.mindestens - text.trim().length)} Zeichen bis es losgehen kann
				{/if}
			</p>
			<button class="btn btn--go btn--lg" disabled={!bereit}>
				{data.note ? 'Speichern und neu zusammenfassen' : 'Fertig – zusammenfassen'}
			</button>
		</div>
	</form>
{/if}

<style>
	.zurueckknopf {
		margin: 0 0 10px;
		padding-inline: 0;
		min-height: 44px;
	}
	/* Das Textfeld ist die Seite. Es darf so hoch werden, wie der Bildschirm hergibt. */
	.feld textarea {
		min-height: 40dvh;
		font-size: 17px;
		line-height: 1.65;
		resize: vertical;
	}
	.fuss {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 14px;
	}
	.fuss :global(.btn) {
		min-height: 54px;
	}

	/* Warten: dasselbe Blatt mit dem Lichtstreifen wie beim Lesen der Fotos — es ist dieselbe
	   Arbeit, nur mit anderer Eingabe. */
	.warten {
		display: grid;
		place-items: center;
		gap: 20px;
		text-align: center;
		padding: 8dvh 0;
	}
	.blatt {
		position: relative;
		width: 108px;
		aspect-ratio: 3 / 4;
		border-radius: var(--r);
		border: 1px solid var(--line-2);
		background: repeating-linear-gradient(
			180deg,
			var(--paper-2) 0 11px,
			var(--surface) 11px 22px
		);
		overflow: hidden;
	}
	.sweep {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent, var(--sky), transparent);
		opacity: 0.75;
		animation: sweep 1.5s ease-in-out infinite;
	}
	@keyframes sweep {
		0% {
			transform: translateY(-100%);
		}
		100% {
			transform: translateY(100%);
		}
	}
	.punkte {
		display: inline-flex;
		gap: 7px;
	}
	.punkte span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ink-3);
		animation: hupf 1.1s ease-in-out infinite;
	}
	.punkte span:nth-child(2) {
		animation-delay: 0.15s;
	}
	.punkte span:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes hupf {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.5;
		}
		50% {
			transform: translateY(-5px);
			opacity: 1;
		}
	}
</style>
