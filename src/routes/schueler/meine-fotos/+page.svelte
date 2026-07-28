<script lang="ts">
	let { data } = $props();
	const an = $derived(data.behalten);
</script>

<h1 style="margin:0 0 18px">Meine Fotos</h1>

<div class="card">
	<div class="zeile">
		<div style="flex:1">
			<p class="frage">Meine Fotos behalten</p>
			<p class="small" style="margin:5px 0 0">
				{#if data.aenderbar}
					Wenn das an ist, kannst du deine Heftseiten später noch einmal ansehen.
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
				aria-label="Meine Fotos behalten"
			>
				<span class="knopf"></span>
			</button>
		</form>
	</div>
</div>

{#if an}
	<div class="card card--tint" style="margin-top:12px">
		<p style="margin:0;font-size:16px;line-height:1.55">
			An: Deine Heftseiten bleiben in deinem Heft. Nur du siehst sie.
		</p>
	</div>
{:else}
	<div class="card card--tint" style="margin-top:12px">
		<p style="margin:0;font-size:16px;line-height:1.55">
			Aus: Deine Fotos werden nur gelesen und danach nicht behalten. Was in deinem
			Inhaltsverzeichnis steht, bleibt dir.
		</p>
	</div>
{/if}

<p class="small" style="margin:18px 2px 0">
	Deine Lehrerin sieht nie das Bild aus deinem Heft – nur, an welchem Thema du arbeitest.
</p>

<style>
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
</style>
