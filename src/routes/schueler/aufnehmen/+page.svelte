<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { seitenLabel } from '$lib/heft';

	let { data, form } = $props();

	let gewaehlt = $state<string | null>(null);
	let neuesFach = $state('');
	let seiten = $state<File[]>([]);
	let liest = $state(false);
	let zieht = $state(false);
	let kamera = $state<HTMLInputElement | null>(null);
	let dateien = $state<HTMLInputElement | null>(null);
	let sendefeld = $state<HTMLInputElement | null>(null);

	const fach = $derived(gewaehlt ?? data.faecher[0]?.title ?? '__neu');
	const gewaehltesFach = $derived(fach === '__neu' ? neuesFach.trim() : fach);
	const bereit = $derived(seiten.length > 0 && gewaehltesFach.length > 0);
	const adresse = $derived(`${page.url.host}/schueler/aufnehmen`);
	const doppelt = $derived(Boolean(form?.doppelt));

	// Vorschau der ausgewählten Seiten. Die Adressen werden wieder freigegeben,
	// sobald eine Seite verschwindet — sonst hält der Browser die Bilder fest.
	let vorschauen = $state<string[]>([]);
	$effect(() => {
		const neu = seiten.map((datei) => URL.createObjectURL(datei));
		vorschauen = neu;
		return () => neu.forEach((url) => URL.revokeObjectURL(url));
	});

	// Abgeschickt wird immer dieses eine Feld. Die beiden Auswahlfelder sammeln nur ein —
	// sonst wirft jede neue Aufnahme die vorherigen Seiten weg.
	$effect(() => {
		if (!sendefeld) return;
		const dt = new DataTransfer();
		for (const datei of seiten) dt.items.add(datei);
		sendefeld.files = dt.files;
	});

	function dazu(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		if (el.files) seiten = [...seiten, ...Array.from(el.files)];
		el.value = '';
	}

	function abgelegt(e: DragEvent) {
		e.preventDefault();
		zieht = false;
		const neue = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
		if (neue.length) seiten = [...seiten, ...neue];
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
			<p class="muted wartetext nurHandy">
				Dauert meist keine Minute. Du kannst das Handy ruhig weglegen.
			</p>
			<p class="muted wartetext nurRechner">
				Dauert meist keine Minute. Du kannst in der Zwischenzeit weiterarbeiten.
			</p>
		</div>
		<div class="punkte">
			<span></span><span></span><span></span>
		</div>
	</div>
{:else}
	<div class="kopf nurHandy">
		<a href="/schueler" class="btn btn--plain">Abbrechen</a>
		<span class="tag">{gewaehltesFach || 'Fach wählen'}</span>
		<span></span>
	</div>
	<h1 class="titel nurHandy">Aufschrieb fotografieren</h1>
	<p class="muted hinweistext nurHandy">Ganze Heftseite ins Bild, möglichst gerade.</p>

	<div class="nurRechner">
		<a href="/schueler" class="btn btn--plain zurueck">Zurück</a>
		<h1 style="margin:0 0 5px">Aufschrieb hinzufügen</h1>
		<p class="muted" style="margin:0 0 24px;font-size:16px">
			{gewaehltesFach ? `Fach: ${gewaehltesFach} · ` : ''}eine Seite pro Bild, Reihenfolge egal.
		</p>
	</div>

	{#if form?.message}
		<div class="hinweis" class:hinweis--frage={doppelt}>
			<p style="margin:0">{form.message}</p>
			{#if doppelt}
				<p class="small" style="margin:8px 0 0">
					Wenn du sie nur schärfer fotografiert hast, lies sie ruhig noch einmal ein. Sonst nimm
					die Seite unten wieder heraus.
				</p>
			{/if}
		</div>
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
		<label class="field fachwahl">
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

		<div class="raster">
			<div class="links">
				<!-- Handy: Sucher, direkt in die Kamera. -->
				<button type="button" class="rahmen nurHandy" onclick={() => kamera?.click()}>
					<span class="ecke tl"></span><span class="ecke tr"></span>
					<span class="ecke bl"></span><span class="ecke br"></span>
					<span class="small" style="max-width:220px;text-align:center;line-height:1.55">
						Tippen, um eine Seite aufzunehmen
					</span>
				</button>

				<!-- Rechner: Bilder hierher ziehen oder auswählen. -->
				<div
					class="ablage nurRechner"
					class:zieht
					role="group"
					aria-label="Bilder ablegen"
					ondragover={(e) => {
						e.preventDefault();
						zieht = true;
					}}
					ondragleave={() => (zieht = false)}
					ondrop={abgelegt}
				>
					<p class="ablage__titel">Bilder hierher ziehen</p>
					<p class="small" style="margin:0;max-width:280px">Fotos oder Scans deiner Heftseiten.</p>
					<button type="button" class="btn waehlen" onclick={() => dateien?.click()}>
						Dateien auswählen
					</button>
				</div>

				<div class="seitenreihe">
					{#each seiten as seite, i (seite.name + seite.lastModified + i)}
						<button
							type="button"
							class="blaettchen"
							onclick={() => weg(i)}
							title="Seite {i + 1} entfernen"
						>
							{#if vorschauen[i]}
								<img src={vorschauen[i]} alt="Seite {i + 1}" />
							{/if}
							<span class="nummer">{i + 1}</span>
						</button>
					{/each}
					<span class="small" style="font-size:13px;margin-left:2px">
						{seitenLabel(seiten.length)}
					</span>
				</div>

				<div class="aktionen">
					<button
						type="button"
						class="btn btn--lg btn--block nurHandy"
						onclick={() => kamera?.click()}
					>
						Seite aufnehmen
					</button>
					{#if bereit}
						<input type="hidden" name="trotzdem" value={doppelt ? '1' : ''} />
						<button class="btn btn--go btn--lg btn--block fertig">
							{doppelt ? 'Trotzdem lesen' : 'Fertig – einordnen'}
						</button>
					{:else}
						<p class="small nurHandy" style="margin:0;text-align:center">
							Du kannst mehrere Seiten nacheinander aufnehmen.
						</p>
					{/if}
				</div>
			</div>

			<aside class="card card--tint handykarte nurRechner">
				<p class="eyebrow" style="margin:0 0 10px">Lieber mit dem Handy?</p>
				<p style="margin:0 0 14px;font-size:16px;line-height:1.55">
					Öffne lernassi am Handy und fotografiere direkt – die Seiten landen hier im selben Heft.
				</p>
				<p class="adresse">{adresse}</p>
			</aside>
		</div>

		<input
			bind:this={kamera}
			type="file"
			accept="image/*"
			capture="environment"
			hidden
			onchange={dazu}
		/>
		<input bind:this={dateien} type="file" accept="image/*" multiple hidden onchange={dazu} />
		<input bind:this={sendefeld} name="seiten" type="file" multiple hidden />
	</form>
{/if}

<style>
	.nurRechner {
		display: none;
	}
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 6px;
	}
	.zurueck {
		margin: 0 0 10px;
		padding-inline: 0;
		min-height: 44px;
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
	.hinweis--frage {
		background: var(--sky);
		border-color: var(--sky-2);
		color: var(--sky-ink);
	}
	.fachwahl {
		margin-bottom: 10px;
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
	.raster {
		display: flex;
		flex-direction: column;
	}
	.links {
		display: flex;
		flex-direction: column;
		min-width: 0;
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

	.ablage {
		border: 1.5px dashed var(--line-2);
		border-radius: var(--r-lg);
		background: repeating-linear-gradient(
			180deg,
			var(--paper-2) 0 11px,
			var(--paper) 11px 22px
		);
		min-height: 290px;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		padding: 32px;
		text-align: center;
		transition:
			border-color 0.15s,
			background-color 0.15s;
	}
	.ablage.zieht {
		border-color: var(--lavender-ink);
		background: var(--lavender);
	}
	.ablage__titel {
		margin: 0;
		font-family: var(--display);
		font-weight: 700;
		font-size: 21px;
	}
	.waehlen {
		min-height: 48px;
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
		padding: 0;
		overflow: hidden;
		border-radius: 7px;
		border: 1px solid var(--line-2);
		background: var(--paper-2);
		cursor: pointer;
		animation: la-rise 0.25s ease;
	}
	.blaettchen img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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

	.handykarte {
		display: none;
	}
	.adresse {
		margin: 0;
		padding: 10px 12px;
		border-radius: var(--r-sm);
		background: var(--surface);
		border: 1px solid var(--line-2);
		font-family: var(--display);
		font-weight: 600;
		font-size: 14px;
		color: var(--ink-2);
		overflow-wrap: anywhere;
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
	.wartetext {
		margin: 0;
		font-size: 17px;
		max-width: 290px;
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
		.nurRechner {
			display: block;
		}
		.nurHandy {
			display: none;
		}
		.blatt + div .wartetext {
			max-width: 340px;
		}
		.fachwahl {
			max-width: 420px;
			margin-bottom: 18px;
		}
		.raster {
			display: grid;
			grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
			gap: 18px;
			align-items: start;
		}
		.ablage {
			display: flex;
		}
		.handykarte {
			display: block;
		}
		.fertig {
			max-width: 320px;
			min-height: 56px;
		}
		.aktionen {
			margin-top: 0;
		}
	}
</style>
