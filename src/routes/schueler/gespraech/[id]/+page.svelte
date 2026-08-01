<script lang="ts">
	import { KI_GESPRAECH, KI_MARKE, kiErzeugt } from '$lib/ki';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { rundeAblegen } from '$lib/mitschrieb';

	let { data, form } = $props();

	let laeuft = $state(false);
	/** Der Satz, der gerade hereinkommt — Zeichen für Zeichen. */
	let strom = $state('');
	let stromFehler = $state<string | null>(null);
	/** Für wie viele Züge schon geholt wurde. Verhindert, dass ein Fehler in eine
	 *  Endlosschleife läuft: nach einem Fehlschlag holt erst der Knopf wieder. */
	let geholtFuer = $state(-1);

	// Zwischenstände für Reihenfolge und Zuordnung — alles andere kommt ohne aus.
	let reihenfolge = $state<string[]>([]);
	let paare = $state<Record<string, string>>({});
	let offenesLinks = $state<string | null>(null);
	let fragenId = $state<string | null>(null);

	const offeneFrage = $derived(
		data.phase === 'gespraech'
			? data.stand.offeneFrage
			: data.phase === 'pruefung'
				? data.pruefung.frage
				: null
	);

	$effect(() => {
		if (offeneFrage && offeneFrage.id !== fragenId) {
			fragenId = offeneFrage.id;
			reihenfolge = [];
			paare = {};
			offenesLinks = null;
		}
	});

	// Ist lernassi dran, wird der Zug geholt, sobald die Seite steht.
	$effect(() => {
		if (data.phase !== 'gespraech') return;
		const n = data.stand.zuege.length;
		if (data.stand.dran !== 'lernassi' || laeuft || geholtFuer === n) return;
		geholtFuer = n;
		zugHolen();
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

	async function zugHolen() {
		laeuft = true;
		strom = '';
		stromFehler = null;
		let fertig = false;
		try {
			const antwort = await fetch(`/schueler/gespraech/${data.roundId}/zug`, { method: 'POST' });
			if (!antwort.ok || !antwort.body) throw new Error(String(antwort.status));

			const leser = antwort.body.getReader();
			const entschluessler = new TextDecoder();
			let rest = '';
			for (;;) {
				const { done, value } = await leser.read();
				if (done) break;
				rest += entschluessler.decode(value, { stream: true });
				const zeilen = rest.split('\n');
				rest = zeilen.pop() ?? '';
				for (const z of zeilen) {
					if (!z.trim()) continue;
					const ereignis = JSON.parse(z);
					if (ereignis.t === 'text') strom += ereignis.v;
					else if (ereignis.t === 'fehler') stromFehler = ereignis.v;
					else if (ereignis.t === 'fertig') fertig = true;
				}
			}
		} catch {
			stromFehler = 'Da ist mir etwas dazwischengekommen. Versuch es nochmal.';
		} finally {
			laeuft = false;
			// Der Zug steht jetzt in der Datenbank — die Seite holt ihn sich von dort. Erst
			// danach den Strom leeren, sonst blitzt die Blase kurz leer auf.
			if (fertig) {
				await invalidateAll();
				strom = '';
			}
		}
	}

	function nochmal() {
		geholtFuer = -1;
		stromFehler = null;
	}

	function reihenfolgeToggle(option: string) {
		reihenfolge = reihenfolge.includes(option)
			? reihenfolge.filter((o) => o !== option)
			: [...reihenfolge, option];
	}

	function paarSetzen(rechts: string) {
		const schonBei = Object.keys(paare).find((l) => paare[l] === rechts);
		if (schonBei) {
			const { [schonBei]: _weg, ...restPaare } = paare;
			paare = restPaare;
			return;
		}
		if (!offenesLinks) return;
		paare = { ...paare, [offenesLinks]: rechts };
		offenesLinks = null;
	}

	const alleZugeordnet = $derived(
		offeneFrage?.art === 'match' ? offeneFrage.optionen.auswahl.every((l) => paare[l]) : false
	);

	const schritt = $derived(
		data.phase === 'fertig' ? 3 : data.phase === 'pruefung' || data.phase === 'rueckschau' ? 2 : 1
	);
	const stufe = (n: number) => (schritt === n ? 'jetzt' : schritt > n ? 'durch' : 'spaeter');
</script>

<!-- Antwortfeld einer angetippten Frage. Einmal geschrieben, zweimal gebraucht: im Gespräch
     und in der Prüfung ist das Antworten dieselbe Handlung. -->
{#snippet tippen(frage: { id: string; art: string; optionen: { auswahl: string[]; rechts?: string[] } })}
	<form
		method="POST"
		action="?/antworten"
		use:enhance={() => {
			laeuft = true;
			return async ({ update }) => {
				await update();
				laeuft = false;
			};
		}}
	>
		<input type="hidden" name="questionId" value={frage.id} />
		{#if frage.art === 'single' || frage.art === 'yesno'}
			<div class="stapel">
				{#each frage.optionen.auswahl as option (option)}
					<button class="btn btn--quiet btn--block links" name="antwort" value={option} disabled={laeuft}>
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
{/snippet}

<div class="kopf">
	<div class="row" style="align-items:flex-start">
		<div>
			<p class="eyebrow" style="margin:0 0 4px">Aus meinem Lernplan</p>
			<h1 style="margin:0;font-size:24px" {...kiErzeugt}>{data.auftrag}</h1>
			<p class="muted" style="margin:5px 0 0;font-size:16px">
				{#if data.fach}{data.fach}{/if}{#if data.kapitel} · {data.kapitel}{/if}{#if data.minuten}
					· etwa {data.minuten} Minuten{/if}
			</p>
		</div>
		{#if data.phase !== 'fertig'}
			<form method="POST" action="?/abbrechen">
				<button class="btn btn--plain" style="min-height:44px;white-space:nowrap">Beenden</button>
			</form>
		{/if}
	</div>
	<div class="stufen">
		<span class="tag {stufe(1)}">1 Reden</span>
		<span class="tag {stufe(2)}">2 Prüfen</span>
		<span class="tag {stufe(3)}">3 Abhaken</span>
		{#if data.phase === 'pruefung'}
			<span class="small punkte">Frage {data.pruefung.frage?.nummer} von {data.pruefung.von}</span>
		{/if}
	</div>
	<div class="balken">
		{#if data.phase === 'pruefung'}
			<span style="width:{data.pruefung.von ? (data.pruefung.beantwortet / data.pruefung.von) * 100 : 0}%"></span>
		{/if}
	</div>
</div>

<p class="ki-hinweis" style="margin:18px 0 0">
	<span class="ki-hinweis__marke">{KI_MARKE}</span>
	<span>{KI_GESPRAECH}</span>
</p>

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

		<!-- ─────────── Gespräch ─────────── -->
	{:else if data.phase === 'gespraech'}
		{#each data.stand.zuege as zug (zug.id)}
			{#if zug.wer === 'lernassi'}
				<div class="sagt">
					{#if zug.bezug === 'darueber-hinaus'}
						<span class="tag klein darueber">über dein Heft hinaus</span>
					{/if}
					<p {...kiErzeugt}>{zug.text}</p>
				</div>
			{:else}
				<div class="blase" class:blase--daneben={zug.frage?.getroffen === false}>
					{zug.text}
				</div>
			{/if}
		{/each}

		<!-- Der Wartepunkt steht schon, bevor der Abruf losgeht: sonst wäre die Seite zwischen
		     Laden und Hydration leer, und ohne JavaScript für immer. -->
		{#if strom}
			<div class="sagt"><p {...kiErzeugt}>{strom}<span class="cursor"></span></p></div>
		{:else if laeuft || (data.stand.dran === 'lernassi' && !stromFehler)}
			<div class="sagt denkt"><span class="spinner" aria-label="lernassi überlegt"></span></div>
		{/if}

		{#if stromFehler}
			<div class="card card--tint">
				<p style="margin:0 0 12px;font-size:17px;line-height:1.55">{stromFehler}</p>
				<button class="btn btn--quiet" onclick={nochmal}>Nochmal</button>
			</div>
		{/if}

		{#if data.stand.dran === 'frage' && data.stand.offeneFrage}
			<div class="card steigt">
				{@render tippen(data.stand.offeneFrage)}
			</div>
		{:else if data.stand.dran === 'text'}
			<form
				method="POST"
				action="?/sagen"
				class="card steigt"
				use:enhance={() => {
					laeuft = true;
					return async ({ update }) => {
						await update();
						laeuft = false;
					};
				}}
			>
				<textarea
					name="text"
					rows="3"
					maxlength={data.zugMax}
					placeholder="Schreib, was du denkst – ein paar Sätze reichen."
				></textarea>
				<button class="btn btn--go btn--block absenden" disabled={laeuft}>Abschicken</button>
			</form>
		{/if}

		<!-- ─────────── Abschlussprüfung ─────────── -->
	{:else if data.phase === 'pruefung' && data.pruefung.frage}
		<div class="card card--tint">
			<p style="margin:0;font-size:16px;line-height:1.5">
				Das Reden ist durch. Jetzt kommen noch {data.pruefung.von}
				{data.pruefung.von === 1 ? 'Frage' : 'Fragen'} am Stück – ohne Hilfe, ein Versuch je Frage.
			</p>
		</div>
		<div class="card steigt">
			<p class="eyebrow fragenkopf" style="margin:0 0 8px">
				<span>
					Frage {data.pruefung.frage.nummer} von {data.pruefung.von} · {data.pruefung.frage.punkte}
					{data.pruefung.frage.punkte === 1 ? 'Punkt' : 'Punkte'}
				</span>
				<span class="tag tag--ki">{KI_MARKE}</span>
			</p>
			<p style="margin:0 0 14px;font-size:17px;line-height:1.55" {...kiErzeugt}>
				{data.pruefung.frage.prompt}
			</p>
			{@render tippen(data.pruefung.frage)}
		</div>

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
			<!-- Getrennt ausgewiesen: im Gespräch durfte nachgedacht und geredet werden, in der
			     Prüfung nicht. Eine Summe aus beidem allein würde das verwischen. -->
			<p style="margin:8px 0 0;font-size:15px;line-height:1.5">
				Im Gespräch {data.teile.gespraech.erreicht} von {data.teile.gespraech.moeglich}, in der
				Prüfung {data.teile.pruefung.erreicht} von {data.teile.pruefung.moeglich}.
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
	.fragenkopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
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
	@media (min-width: 860px) {
		.kopf {
			margin: -34px -40px 18px;
			padding: 34px 40px 0;
		}
		.balken {
			margin: 12px -40px 0;
		}
	}
	/* Was lernassi sagt, steht ohne Karte da — ein Gespräch ist keine Folge von Formularen.
	   Die Antworten des Kindes bleiben Blasen, wie im Verlauf der klassischen Übung. */
	.sagt {
		max-width: 90%;
	}
	.sagt p {
		margin: 0;
		font-size: 17px;
		line-height: 1.55;
	}
	.sagt.denkt {
		padding: 6px 0;
	}
	.darueber {
		display: inline-block;
		margin-bottom: 6px;
		background: var(--apricot);
		color: var(--apricot-ink);
	}
	.cursor {
		display: inline-block;
		width: 2px;
		height: 1em;
		margin-left: 2px;
		vertical-align: -2px;
		background: var(--ink-3);
		animation: blinkt 1s step-end infinite;
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
	.blase--daneben {
		background: var(--paper);
		color: var(--ink-3);
		border: 1px solid var(--line);
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
	.spinner {
		width: 22px;
		height: 22px;
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
	@keyframes blinkt {
		50% {
			opacity: 0;
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
</style>
