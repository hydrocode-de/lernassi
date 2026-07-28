<script lang="ts">
	import { enhance } from '$app/forms';
	import { seitenLabel } from '$lib/heft';

	let { data, form } = $props();

	let gewaehlt = $state<string | null>(null);
	let neuesFach = $state('');
	let seiten = $state<File[]>([]);
	let liest = $state(false);
	let eingabe = $state<HTMLInputElement | null>(null);

	const fach = $derived(gewaehlt ?? data.faecher[0]?.title ?? '__neu');
	const gewaehltesFach = $derived(fach === '__neu' ? neuesFach.trim() : fach);
	const bereit = $derived(seiten.length > 0 && gewaehltesFach.length > 0);

	function dazu(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		if (el.files) seiten = [...seiten, ...Array.from(el.files)];
		el.value = '';
	}

	function weg(i: number) {
		seiten = seiten.filter((_, j) => j !== i);
	}
</script>

{#if liest}
	<div class="warten">
		<div class="blatt"><div class="sweep"></div></div>
		<div>
			<h1 style="margin:0 0 8px">Ich lese deine Seiten</h1>
			<p class="muted" style="margin:0;font-size:17px;max-width:290px">
				Dauert meist keine Minute. Du kannst das Handy ruhig weglegen.
			</p>
		</div>
		<div class="punkte">
			<span></span><span></span><span></span>
		</div>
	</div>
{:else}
	<div class="kopf">
		<a href="/schueler" class="btn btn--plain">Abbrechen</a>
		<span class="tag">{gewaehltesFach || 'Fach wählen'}</span>
		<span></span>
	</div>

	<h1 class="titel">Aufschrieb fotografieren</h1>
	<p class="muted hinweistext">Ganze Heftseite ins Bild, möglichst gerade.</p>

	{#if form?.message}
		<div class="hinweis">{form.message}</div>
	{/if}

	<form
		class="kamera"
		method="POST"
		enctype="multipart/form-data"
		use:enhance={() => {
			liest = true;
			return async ({ update }) => {
				liest = false;
				await update();
			};
		}}
	>
		<label class="field" style="margin-bottom:10px">
			<span class="field__label">Fach</span>
			<select value={fach} onchange={(e) => (gewaehlt = e.currentTarget.value)}>
				{#each data.faecher as f (f.id)}
					<option value={f.title}>{f.title}</option>
				{/each}
				<option value="__neu">Neues Fach …</option>
			</select>
		</label>

		{#if fach === '__neu'}
			<label class="field" style="margin-bottom:10px">
				<span class="field__label">Neues Fach</span>
				<input bind:value={neuesFach} placeholder="z. B. Geschichte" />
			</label>
		{/if}
		<input type="hidden" name="fach" value={gewaehltesFach} />

		<button type="button" class="rahmen" onclick={() => eingabe?.click()}>
			<span class="ecke tl"></span><span class="ecke tr"></span>
			<span class="ecke bl"></span><span class="ecke br"></span>
			<span class="small" style="max-width:220px;text-align:center;line-height:1.55">
				Tippen, um eine Seite aufzunehmen
			</span>
		</button>

		<input
			bind:this={eingabe}
			name="seiten"
			type="file"
			accept="image/*"
			capture="environment"
			multiple
			hidden
			onchange={dazu}
		/>

		<div class="seitenreihe">
			{#each seiten as _seite, i (i)}
				<button type="button" class="blaettchen" onclick={() => weg(i)} title="Seite entfernen">
					<span class="nummer">{i + 1}</span>
				</button>
			{/each}
			<span class="small" style="font-size:13px;margin-left:2px">{seitenLabel(seiten.length)}</span>
		</div>

		<div class="aktionen">
			<button type="button" class="btn btn--lg btn--block" onclick={() => eingabe?.click()}>
				Seite aufnehmen
			</button>
			{#if bereit}
				<button class="btn btn--go btn--lg btn--block">Fertig – einordnen</button>
			{:else}
				<p class="small" style="margin:0;text-align:center">
					Du kannst mehrere Seiten nacheinander aufnehmen.
				</p>
			{/if}
		</div>
	</form>
{/if}

<style>
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 6px;
	}
	.hinweis {
		background: var(--apricot);
		border: 1px solid var(--apricot-2);
		color: var(--apricot-ink);
		border-radius: var(--r);
		padding: 13px 15px;
		margin-bottom: 14px;
		font-size: 16px;
	}
	select {
		width: 100%;
		border: 0;
		padding: 0;
		background: transparent;
		font-family: var(--text);
		font-size: 18px;
		color: var(--ink);
	}
	select:focus {
		outline: none;
	}

	.titel {
		font-size: 24px;
		margin: 6px 0 4px;
	}
	.hinweistext {
		margin: 0 0 14px;
		font-size: 16px;
	}

	/* Alles ohne Scrollen erreichbar: Rahmen gibt nach, Aktionen bleiben sichtbar. */
	.kamera {
		display: flex;
		flex-direction: column;
	}
	.rahmen {
		position: relative;
		flex: 1;
		min-height: 150px;
		max-height: 38dvh;
		width: 100%;
		border: 0;
		border-radius: var(--r-lg);
		background: repeating-linear-gradient(
			180deg,
			var(--paper-2) 0 11px,
			var(--paper) 11px 22px
		);
		display: grid;
		place-items: center;
		cursor: pointer;
		margin: 4px 0 0;
	}
	.ecke {
		position: absolute;
		width: 30px;
		height: 30px;
		border: 2px solid var(--lavender-ink);
		opacity: 0.55;
	}
	.tl {
		top: 14px;
		left: 14px;
		border-right: 0;
		border-bottom: 0;
		border-radius: 8px 0 0 0;
	}
	.tr {
		top: 14px;
		right: 14px;
		border-left: 0;
		border-bottom: 0;
		border-radius: 0 8px 0 0;
	}
	.bl {
		bottom: 14px;
		left: 14px;
		border-right: 0;
		border-top: 0;
		border-radius: 0 0 0 8px;
	}
	.br {
		bottom: 14px;
		right: 14px;
		border-left: 0;
		border-top: 0;
		border-radius: 0 0 8px 0;
	}

	.seitenreihe {
		flex: none;
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 54px;
		margin-top: 14px;
		flex-wrap: wrap;
	}
	.blaettchen {
		position: relative;
		width: 40px;
		height: 52px;
		flex: none;
		border-radius: 7px;
		border: 1px solid var(--line-2);
		background: repeating-linear-gradient(
			180deg,
			var(--paper-2) 0 7px,
			var(--surface) 7px 14px
		);
		cursor: pointer;
		animation: la-rise 0.25s ease;
	}
	.nummer {
		position: absolute;
		bottom: -2px;
		right: -4px;
		width: 19px;
		height: 19px;
		border-radius: 50%;
		background: var(--mint);
		color: var(--mint-ink);
		font-family: var(--display);
		font-weight: 700;
		font-size: 11px;
		display: grid;
		place-items: center;
	}
	.aktionen {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 8px;
		padding-bottom: env(safe-area-inset-bottom);
	}

	.warten {
		min-height: 70vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 26px;
		text-align: center;
	}
	.blatt {
		position: relative;
		width: 132px;
		height: 170px;
		border-radius: var(--r);
		border: 1px solid var(--line-2);
		background: repeating-linear-gradient(
			180deg,
			var(--paper-2) 0 13px,
			var(--surface) 13px 26px
		);
		overflow: hidden;
	}
	.sweep {
		position: absolute;
		inset: 0;
		height: 36%;
		background: linear-gradient(180deg, transparent, var(--lavender), transparent);
		animation: la-sweep 1.9s ease-in-out infinite;
	}
	.punkte {
		display: flex;
		gap: 8px;
	}
	.punkte span {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--lavender-ink);
		animation: la-breathe 1.2s ease-in-out infinite;
	}
	.punkte span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.punkte span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@media (min-width: 860px) {
		.rahmen {
			max-width: 520px;
		}
		.aktionen {
			max-width: 520px;
		}
	}
</style>
