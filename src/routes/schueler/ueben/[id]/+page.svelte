<script lang="ts">
	import { enhance } from '$app/forms';
	import { rundeAblegen } from '$lib/mitschrieb';

	let { data, form } = $props();

	let laeuft = $state(false);

	// Reihenfolge und Zuordnung brauchen einen Zwischenstand im Browser. Alles andere kommt
	// ohne aus: ein Knopf ist eine Antwort.
	let reihenfolge = $state<string[]>([]);
	let paare = $state<Record<string, string>>({});
	let offenesLinks = $state<string | null>(null);
	let fragenId = $state<string | null>(null);

	const frage = $derived(data.phase === 'fragen' ? data.frage : null);

	$effect(() => {
		if (frage && frage.id !== fragenId) {
			fragenId = frage.id;
			reihenfolge = [];
			paare = {};
			offenesLinks = null;
		}
	});

	// Nach dem Ende wandert der Roh-Mitschrieb auf dieses Gerät.
	$effect(() => {
		if (data.phase === 'fertig' && data.mitschrieb?.length) {
			rundeAblegen({
				roundId: data.roundId,
				kapitel: data.kapitel ?? data.auftrag,
				wann: Date.now(),
				aufrufe: data.mitschrieb
			});
		}
	});

	const rueckmeldung = $derived(form && 'bewertung' in form ? form.bewertung : null);
	const entwurf = $derived((form && 'entwurf' in form ? form.entwurf : null) ?? '');

	const alsListe = (art: string, teile: string[] | null) =>
		(teile ?? []).join(art === 'order' || art === 'match' ? ' → ' : ', ');

	function reihenfolgeToggle(option: string) {
		reihenfolge = reihenfolge.includes(option)
			? reihenfolge.filter((o) => o !== option)
			: [...reihenfolge, option];
	}

	function paarSetzen(rechts: string) {
		const schonBei = Object.keys(paare).find((l) => paare[l] === rechts);
		if (schonBei) {
			const { [schonBei]: _weg, ...rest } = paare;
			paare = rest;
			return;
		}
		if (!offenesLinks) return;
		paare = { ...paare, [offenesLinks]: rechts };
		offenesLinks = null;
	}

	const alleZugeordnet = $derived(
		frage?.art === 'match' ? frage.optionen.auswahl.every((l) => paare[l]) : false
	);

	// Zwei Schritte: üben, dann abhaken.
	const schritt = $derived(data.phase === 'fertig' ? 2 : 1);
	const stufe = (n: number) => (schritt === n ? 'jetzt' : schritt > n ? 'durch' : 'spaeter');
</script>

<div class="kopf">
	<div class="row" style="align-items:flex-start">
		<div>
			<p class="eyebrow" style="margin:0 0 4px">Aus meinem Lernplan</p>
			<h1 style="margin:0;font-size:24px">{data.auftrag}</h1>
			<p class="muted" style="margin:5px 0 0;font-size:16px">
				{#if data.fach}{data.fach}{/if}{#if data.kapitel} · {data.kapitel}{/if}{#if data.minuten}
					· etwa {data.minuten} Minuten{/if}
			</p>
		</div>
		{#if data.phase !== 'fertig'}
			<form method="POST" action="?/abbrechen">
				<button class="btn btn--plain" style="min-height:44px;white-space:nowrap">
					Übung beenden
				</button>
			</form>
		{/if}
	</div>
	<div class="stufen">
		<span class="tag {stufe(1)}">1 Machen</span>
		<span class="tag {stufe(2)}">2 Abhaken</span>
		{#if data.phase === 'fragen'}
			<span class="small punkte">{data.erreicht} von {data.moeglich} Punkten</span>
		{/if}
	</div>

	<!-- Der Balken IST die untere Kante des Kopfs. Außerhalb der Fragen bleibt eine Linie. -->
	<div class="balken">
		{#if data.phase === 'fragen'}
			<span style="width:{data.moeglich ? (data.erreicht / data.moeglich) * 100 : 0}%"></span>
		{/if}
	</div>
</div>

{#if form && 'message' in form && form.message}
	<div class="meldung meldung--fehler">{form.message}</div>
{/if}

<div class="spalte">
	<!-- ─────────── Selbsteinschätzung vorher ─────────── -->
	{#if data.phase === 'selbst'}
		<form
			method="POST"
			action="?/selbst"
			class="card steigt"
			use:enhance={() => {
				laeuft = true;
				return async ({ update }) => {
					await update();
					laeuft = false;
				};
			}}
		>
			<p style="margin:0 0 14px;font-size:17px">Wie sicher fühlst du dich bei diesem Punkt?</p>
			<div class="stapel">
				{#each data.sicherheiten as wort, i (wort)}
					<button class="btn btn--quiet btn--block links" name="wert" value={i + 1} disabled={laeuft}>
						{wort}
					</button>
				{/each}
			</div>
		</form>
		{#if laeuft}
			<div class="card card--tint lade">
				<span class="spinner" aria-label="lädt"></span>
			</div>
		{/if}

		<!-- ─────────── Fragen ─────────── -->
	{:else if data.phase === 'fragen' && frage}
		<!-- Was schon lief, bleibt stehen: die Übung ist ein Verlauf, keine Frage, die die
		     vorige wegwischt. -->
		{#each data.verlauf as e (e.id)}
			<div class="card frueher">
				<p class="frage" style="margin:0 0 10px">{e.prompt}</p>
				{#each e.antworten as a, i (i)}
					<div class="blase" class:blase--daneben={!a.getroffen}>
						{a.given.join(e.art === 'order' || e.art === 'match' ? ' → ' : ', ')}
					</div>
				{/each}
				<p class="small" style="margin:10px 0 0">
					{e.erreicht} von {e.punkte}
					{e.punkte === 1 ? 'Punkt' : 'Punkten'}
				</p>
			</div>
		{/each}

		{#if rueckmeldung}
			<div class="card" class:gut={rueckmeldung.perfekt} class:daneben={!rueckmeldung.perfekt}>
				<p style="margin:0;font-size:17px;line-height:1.55">
					{#if rueckmeldung.satz}
						{rueckmeldung.satz}
					{:else if rueckmeldung.outcome === 'richtig'}
						Stimmt.
					{:else if rueckmeldung.nochEinVersuch}
						Noch nicht ganz. {rueckmeldung.hinweis}
					{:else if rueckmeldung.perfekt}
						Richtig.
					{:else}
						Das war es nicht. Richtig wäre: {alsListe(rueckmeldung.art, rueckmeldung.loesung)}
					{/if}
				</p>
			</div>
		{/if}

		<form
			method="POST"
			action="?/antworten"
			class="card steigt"
			use:enhance={() => {
				laeuft = true;
				return async ({ update }) => {
					await update();
					laeuft = false;
				};
			}}
		>
			<input type="hidden" name="questionId" value={frage.id} />
			<p class="eyebrow" style="margin:0 0 8px">
				Frage {frage.nummer} von {frage.von}{data.nachgefasst ? ' · noch ein Versuch' : ''} ·
				{frage.nochWert}
				{frage.nochWert === 1 ? 'Punkt' : 'Punkte'}
			</p>
			<p style="margin:0 0 14px;font-size:17px;line-height:1.55">{frage.prompt}</p>

			{#if data.nachgefasst && data.hinweis && !rueckmeldung}
				<p class="card card--tint hinweis">{data.hinweis}</p>
			{/if}

			{#if frage.art === 'text'}
				<!-- Nach einem Fehlversuch steht der eigene Satz wieder da: verbessern statt neu tippen. -->
				<textarea
					name="antwort"
					rows="4"
					maxlength={data.freitextMax}
					placeholder="In eigenen Worten – ein paar Sätze reichen."
					value={entwurf}
				></textarea>
				<button class="btn btn--go btn--block absenden" disabled={laeuft}>Antwort abgeben</button>
			{:else if frage.art === 'single' || frage.art === 'yesno'}
				<div class="stapel">
					{#each frage.optionen.auswahl as option (option)}
						<button
							class="btn btn--quiet btn--block links"
							name="antwort"
							value={option}
							disabled={laeuft}
						>
							{option}
						</button>
					{/each}
				</div>
			{:else if frage.art === 'multi'}
				<p class="small" style="margin:0 0 10px">Alles antippen, was stimmt.</p>
				<div class="stapel">
					{#each frage.optionen.auswahl as option (option)}
						<label class="wahl">
							<input type="checkbox" name="antwort" value={option} />
							<span>{option}</span>
						</label>
					{/each}
				</div>
				<button class="btn btn--go btn--block absenden" disabled={laeuft}>Antwort abgeben</button>
			{:else if frage.art === 'order'}
				<p class="small" style="margin:0 0 10px">
					In der richtigen Reihenfolge antippen. Nochmal antippen nimmt es wieder raus.
				</p>
				<div class="stapel">
					{#each frage.optionen.auswahl as option (option)}
						{@const platz = reihenfolge.indexOf(option)}
						<button
							type="button"
							class="btn btn--quiet btn--block links"
							class:gewaehlt={platz >= 0}
							onclick={() => reihenfolgeToggle(option)}
						>
							<span class="nummer">{platz >= 0 ? platz + 1 : '·'}</span>
							<span>{option}</span>
						</button>
					{/each}
				</div>
				{#each reihenfolge as gewaehlt (gewaehlt)}
					<input type="hidden" name="antwort" value={gewaehlt} />
				{/each}
				<button
					class="btn btn--go btn--block absenden"
					disabled={laeuft || reihenfolge.length !== frage.optionen.auswahl.length}
				>
					Reihenfolge abgeben
				</button>
			{:else if frage.art === 'match'}
				<p class="small" style="margin:0 0 10px">
					Links etwas antippen, dann rechts das, was dazugehört.
				</p>
				<div class="paare">
					<div class="stapel">
						{#each frage.optionen.auswahl as links (links)}
							<button
								type="button"
								class="btn btn--quiet btn--block links"
								class:gewaehlt={offenesLinks === links}
								onclick={() => (offenesLinks = offenesLinks === links ? null : links)}
							>
								<span>{links}</span>
								{#if paare[links]}<span class="tag klein">{paare[links]}</span>{/if}
							</button>
						{/each}
					</div>
					<div class="stapel">
						{#each frage.optionen.rechts ?? [] as rechts (rechts)}
							{@const belegt = Object.values(paare).includes(rechts)}
							<button
								type="button"
								class="btn btn--quiet btn--block links"
								class:gewaehlt={belegt}
								disabled={!offenesLinks && !belegt}
								onclick={() => paarSetzen(rechts)}
							>
								{rechts}
							</button>
						{/each}
					</div>
				</div>
				{#each frage.optionen.auswahl as links (links)}
					<input type="hidden" name="antwort" value={paare[links] ?? ''} />
				{/each}
				<button class="btn btn--go btn--block absenden" disabled={laeuft || !alleZugeordnet}>
					Zuordnung abgeben
				</button>
			{/if}
		</form>

		<!-- Freitext geht durch den Bewerter — das dauert, und das Kind soll es sehen. -->
		{#if laeuft}
			<div class="card card--tint lade">
				<span class="spinner" aria-label="lädt"></span>
			</div>
		{/if}

		<!-- ─────────── Rückschau ─────────── -->
	{:else if data.phase === 'rueckschau'}
		<form method="POST" action="?/rueckschau" class="card steigt">
			<p style="margin:0 0 14px;font-size:17px">Wie lief das Lernen heute?</p>
			<div class="stapel">
				{#each Object.entries(data.rueckschauen) as [wert, wort] (wert)}
					<button class="btn btn--quiet btn--block links" name="wahl" value={wert}>{wort}</button>
				{/each}
			</div>
		</form>

		<!-- ─────────── Durch ─────────── -->
	{:else if data.phase === 'fertig'}
		<div class="card steigt ergebnis {data.farbe}">
			<p class="eyebrow" style="margin:0 0 8px">Dein Ergebnis</p>
			<p style="margin:0;font-size:20px;line-height:1.45">
				{data.erreicht} von {data.moeglich} Punkten – <strong>{data.wort}</strong>.
			</p>
			<p style="margin:10px 0 0;font-size:17px;line-height:1.55">
				{#if data.abgehakt}
					Abgehakt.
				{:else if data.platz && data.platz <= 2}
					Kommt als Nächstes nochmal.
				{:else if data.platz && data.platz <= data.offen / 2}
					Kommt bald nochmal.
				{:else}
					Kommt später nochmal.
				{/if}
			</p>
		</div>
		<div class="knoepfe">
			<a class="btn btn--lg" href="/schueler/ueben/neu">Nächsten Punkt üben</a>
			<a class="btn btn--quiet" href="/schueler/plan">Mein Lernplan</a>
		</div>

		<!-- ─────────── Klemmt ─────────── -->
	{:else if data.phase === 'fehler'}
		<div class="card card--tint">
			<p style="margin:0;font-size:17px;line-height:1.55">{data.fehler}</p>
			<a class="btn btn--quiet" href="/schueler/plan" style="margin-top:14px">Mein Lernplan</a>
		</div>
	{/if}
</div>

<style>
	/* Der Kopf bleibt stehen, der Verlauf scrollt darunter durch — sonst verliert das Kind bei
	   langen Übungen aus dem Blick, worum es geht und wie weit es ist. Die seitliche Polsterung
	   der Schale wird hier aufgehoben und wieder angelegt, damit der Balken bis an den Rand geht. */
	.kopf {
		position: sticky;
		top: 0;
		z-index: 5;
		margin: -8px -20px 18px;
		padding: 8px 20px 0;
		background: var(--paper);
	}
	.punkte {
		margin-left: auto;
		font-size: 13px;
		white-space: nowrap;
	}
	.balken {
		height: 4px;
		margin: 12px -20px 0;
		background: var(--paper-2);
		overflow: hidden;
	}
	.balken span {
		display: block;
		height: 100%;
		background: var(--lavender-ink);
		transition: width 0.3s ease;
	}
	.stufen {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}
	.tag.jetzt {
		background: var(--lavender);
		color: var(--lavender-ink);
	}
	.tag.durch {
		background: var(--mint);
		color: var(--mint-ink);
	}
	.tag.spaeter {
		background: var(--paper-2);
		color: var(--ink-2);
	}
	.spalte {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 620px;
	}
	/* Am Rechner polstert die Schale mit 40 px statt 20 — der Kopf muss dieselbe Breite
	   zurückgewinnen, sonst endet der Balken vor dem Rand. */
	@media (min-width: 860px) {
		.kopf {
			margin: -34px -40px 18px;
			padding: 34px 40px 0;
		}
		.balken {
			margin: 12px -40px 0;
		}
	}
	.stapel {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.links {
		justify-content: flex-start;
		text-align: left;
		min-height: 54px;
		line-height: 1.35;
	}
	.wahl {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 54px;
		padding: 8px 14px;
		border: 1px solid var(--line);
		border-radius: var(--r);
		font-size: 16px;
	}
	.absenden {
		margin-top: 12px;
		min-height: 54px;
	}
	.hinweis {
		margin: 0 0 12px;
		font-size: 15px;
		line-height: 1.5;
	}
	.paare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.gewaehlt {
		background: var(--lavender);
		color: var(--lavender-ink);
	}
	.nummer {
		display: inline-grid;
		place-items: center;
		width: 24px;
		height: 24px;
		margin-right: 10px;
		border-radius: 8px;
		background: var(--paper-2);
		font-size: 13px;
	}
	.gut {
		background: var(--mint);
		border-color: var(--mint-2);
		color: var(--mint-ink);
	}
	.daneben {
		background: var(--sky);
		border-color: var(--sky-2);
		color: var(--sky-ink);
	}
	.ergebnis.mint {
		background: var(--mint);
		border-color: var(--mint-2);
		color: var(--mint-ink);
	}
	.ergebnis.sky {
		background: var(--sky);
		border-color: var(--sky-2);
		color: var(--sky-ink);
	}
	.ergebnis.apricot {
		background: var(--apricot);
		border-color: var(--apricot-2);
		color: var(--apricot-ink);
	}
	.ergebnis.rose {
		background: var(--rose);
		border-color: var(--rose-2);
		color: var(--rose-ink);
	}
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: var(--r);
		font: inherit;
		font-size: 16px;
		line-height: 1.5;
		resize: vertical;
	}
	.steigt {
		animation: steigt 0.25s ease;
	}
	/* Was schon gelaufen ist, tritt zurück — die aktuelle Frage soll vorne stehen. */
	.frueher {
		background: var(--paper-2);
		border-color: transparent;
	}
	.frage {
		font-size: 16px;
		line-height: 1.45;
		color: var(--ink-2);
	}
	.blase {
		align-self: flex-end;
		width: fit-content;
		max-width: 85%;
		margin-left: auto;
		background: var(--lavender);
		color: var(--lavender-ink);
		border-radius: var(--r-lg) var(--r-lg) 4px var(--r-lg);
		padding: 9px 14px;
		font-size: 15px;
		line-height: 1.4;
	}
	.blase + .blase {
		margin-top: 6px;
	}
	.blase--daneben {
		background: var(--paper);
		color: var(--ink-3);
		border: 1px solid var(--line);
	}
	.lade {
		display: grid;
		place-items: center;
		min-height: 72px;
	}
	.spinner {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 3px solid var(--line-2);
		border-top-color: var(--lavender-ink);
		animation: dreht 0.8s linear infinite;
	}
	@keyframes dreht {
		to {
			transform: rotate(1turn);
		}
	}
	@keyframes steigt {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes atmet {
		50% {
			opacity: 0.7;
		}
	}
</style>
