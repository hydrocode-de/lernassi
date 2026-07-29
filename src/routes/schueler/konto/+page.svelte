<script lang="ts">
	import { initialen } from '$lib/heft';
	import {
		alleLesen,
		alleLoeschen,
		einstellungLesen,
		einstellungSchreiben,
		TAGE_OPTIONEN,
		type Einstellung
	} from '$lib/mitschrieb';

	let { data } = $props();
	const an = $derived(data.behalten);

	// Was bei einer Runde überlegt wurde, liegt auf diesem Gerät — nicht bei uns.
	let mitschrieb = $state<Einstellung>({ an: true, tage: 7 });
	let runden = $state(0);

	$effect(() => {
		mitschrieb = einstellungLesen();
		runden = alleLesen().length;
	});

	function mitschriebSetzen(neu: Einstellung) {
		mitschrieb = neu;
		einstellungSchreiben(neu);
		runden = alleLesen().length;
	}

	const fristLabel = (tage: number) =>
		tage === 0 ? 'bis ich es lösche' : tage === 1 ? '1 Tag' : tage === 7 ? '1 Woche' : '1 Monat';
	const zugehoerigkeit = $derived(
		[data.klasse && `Klasse ${data.klasse}`, data.lehrkraft && `bei ${data.lehrkraft}`]
			.filter(Boolean)
			.join(' ')
	);
</script>

<a href="/schueler" class="btn btn--plain zurueck nurHandy">Zurück</a>

<div class="kennung">
	<span class="avatar">{initialen(data.pseudonym)}</span>
	<span>
		<span class="name">{data.pseudonym}</span>
		{#if zugehoerigkeit}
			<span class="small zeile2">{zugehoerigkeit}</span>
		{/if}
	</span>
</div>

<div class="card">
	<div class="zeile">
		<div style="flex:1">
			<p class="frage">Meine Fotos für mich behalten</p>
			<p class="small" style="margin:5px 0 0">
				{#if data.aenderbar}
					Deine Lehrerin sieht dann nur das Thema, nie das Bild aus deinem Heft.
				{:else}
					Das können wir noch nicht anbieten.
				{/if}
			</p>
		</div>
		<form method="POST" action="?/umstellen">
			<input type="hidden" name="behalten" value={(!an).toString()} />
			<button
				class="schalter"
				class:an
				aria-pressed={an}
				disabled={!data.aenderbar}
				aria-label="Meine Fotos für mich behalten"
			>
				<span class="knopf"></span>
			</button>
		</form>
	</div>

	{#if an}
		<p class="small" style="margin:14px 0 0">
			An: Die Bilder bleiben in deinem Heft. Nur du siehst sie.
		</p>
	{:else}
		<p class="small" style="margin:14px 0 0">
			Aus: Deine Fotos werden nur gelesen und danach nicht behalten. Was in deinem
			Inhaltsverzeichnis steht, bleibt dir.
		</p>
	{/if}
</div>

<div class="card" style="margin-top:12px">
	<div class="zeile">
		<div style="flex:1">
			<p class="frage">Meine Runden auf diesem Gerät liegen lassen</p>
			<p class="small" style="margin:5px 0 0">
				Was ich mir bei deinen Runden überlegt habe, bleibt dann hier auf deinem Gerät – nicht bei
				uns. Du kannst es jederzeit wegwerfen.
			</p>
		</div>
		<button
			class="schalter"
			class:an={mitschrieb.an}
			aria-pressed={mitschrieb.an}
			aria-label="Meine Runden auf diesem Gerät liegen lassen"
			onclick={() => mitschriebSetzen({ ...mitschrieb, an: !mitschrieb.an })}
		>
			<span class="knopf"></span>
		</button>
	</div>

	{#if mitschrieb.an}
		<p class="small" style="margin:14px 0 8px">Wie lange soll es liegen bleiben?</p>
		<div class="chips">
			{#each TAGE_OPTIONEN as tage (tage)}
				<button
					type="button"
					class="chip"
					aria-pressed={mitschrieb.tage === tage}
					onclick={() => mitschriebSetzen({ ...mitschrieb, tage })}
				>
					{fristLabel(tage)}
				</button>
			{/each}
		</div>
		{#if runden}
			<div class="zeile" style="margin-top:14px">
				<p class="small" style="margin:0;flex:1">
					{runden}
					{runden === 1 ? 'Runde liegt' : 'Runden liegen'} hier.
				</p>
				<button
					class="btn btn--plain"
					onclick={() => {
						alleLoeschen();
						runden = 0;
					}}
				>
					Wegwerfen
				</button>
			</div>
		{/if}
	{/if}
</div>

<div class="card card--knoepfe">
	<form method="POST" action="/abmelden">
		<button class="btn btn--plain abmelden">Abmelden</button>
	</form>
</div>

<style>
	.zurueck {
		margin: 0 0 12px;
		padding-inline: 0;
		min-height: 48px;
	}
	.kennung {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 22px;
	}
	.avatar {
		flex: none;
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--lavender);
		color: var(--lavender-ink);
		font-family: var(--display);
		font-weight: 700;
		font-size: 20px;
	}
	.name {
		display: block;
		font-family: var(--display);
		font-weight: 700;
		font-size: 22px;
	}
	.zeile2 {
		display: block;
	}
	.zeile {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.frage {
		margin: 0;
		font-family: var(--display);
		font-weight: 700;
		font-size: 18px;
	}
	.schalter {
		flex: none;
		width: 66px;
		height: 40px;
		border-radius: var(--r-pill);
		border: 1px solid var(--line-2);
		background: var(--paper-2);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding: 0 4px;
	}
	.schalter.an {
		border-color: var(--mint-2);
		background: var(--mint);
		justify-content: flex-end;
	}
	.schalter:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
	.knopf {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--surface);
		box-shadow: var(--shadow-lift);
	}
	.card--knoepfe {
		margin-top: 12px;
		padding: 8px 10px;
	}
	.abmelden {
		width: 100%;
		justify-content: flex-start;
		min-height: 54px;
		font-size: 16px;
		color: var(--rose-ink);
	}

	@media (min-width: 860px) {
		.nurHandy {
			display: none;
		}
		.card--knoepfe {
			max-width: 420px;
		}
	}
</style>
