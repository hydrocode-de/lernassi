<script lang="ts">
	import { KI_MARKE, kiErzeugt } from '$lib/ki';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { rundeAblegen } from '$lib/mitschrieb';

	let { data, form } = $props();

	// Ohne JavaScript läuft alles genauso, nur ohne diese Zwischenmeldung.
	let laeuft = $state(false);

	// Reihenfolge und Zuordnung brauchen einen Zwischenstand im Browser. Alles andere
	// kommt ohne aus: ein Knopf ist eine Antwort.
	let reihenfolge = $state<string[]>([]);
	let paare = $state<Record<string, string>>({});
	let offenesLinks = $state<string | null>(null);
	let fragenId = $state<string | null>(null);

	const frage = $derived(data.phase === 'fragen' ? data.frage : null);

	// Neue Frage: Zwischenstand zurücksetzen.
	$effect(() => {
		if (frage && frage.id !== fragenId) {
			fragenId = frage.id;
			reihenfolge = [];
			paare = {};
			offenesLinks = null;
		}
	});

	// Nach Rundenende wandert der Roh-Mitschrieb auf dieses Gerät.
	$effect(() => {
		if (data.phase === 'fertig' && data.mitschrieb?.length) {
			rundeAblegen({
				roundId: data.roundId,
				kapitel: data.kapitel,
				wann: Date.now(),
				aufrufe: data.mitschrieb
			});
		}
	});

	const schritt = $derived(
		data.phase === 'selbst' || data.phase === 'fragen' || data.phase === 'wartet'
			? 1
			: data.phase === 'spiegel'
				? 2
				: data.phase === 'plan'
					? 3
					: 4
	);
	const notiz = $derived(
		{
			selbst: 'Erst dein Gefühl',
			fragen: 'Fragen aus deinem Heft',
			wartet: 'Fragen aus deinem Heft',
			spiegel: 'Gefühl und Ergebnis',
			plan: 'Deine Punkte',
			fertig: 'Plan steht',
			fehler: ''
		}[data.phase] ?? ''
	);

	// ─────────── Auf die nächsten Fragen warten ───────────
	//
	// Die Fragen kommen über einen Strom in die STEHENDE Seite, nicht über einen Seiten-Load.
	// Ein Load könnte während der 10 bis 20 Sekunden nichts anzeigen; hier steht die Form der
	// Frage sofort da und der Text wächst hinein.
	let strom = $state('');
	let stromFehler = $state<string | null>(null);
	let lage = $state<'heft' | 'schreiben'>('heft');
	let langeSchonDa = $state(false);
	let geholtFuer = $state<number | null>(null);

	// Ab hier ist das Warten ungewöhnlich lang — dann wird es gesagt statt verschwiegen.
	const LANGE = 12000;

	$effect(() => {
		if (data.phase !== 'wartet' || geholtFuer === data.nummer) return;
		geholtFuer = data.nummer;
		welleHolen();
	});

	async function welleHolen() {
		strom = '';
		stromFehler = null;
		lage = 'heft';
		langeSchonDa = false;
		const uhr = setTimeout(() => (langeSchonDa = true), LANGE);
		let fertig = false;
		try {
			const antwort = await fetch(`/schueler/runde/${data.roundId}/welle`, { method: 'POST' });
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
					else if (ereignis.t === 'lage') lage = ereignis.v;
					else if (ereignis.t === 'fehler') stromFehler = ereignis.v;
					else if (ereignis.t === 'fertig') fertig = true;
				}
			}
		} catch {
			stromFehler = 'Da komme ich gerade nicht weiter.';
		} finally {
			clearTimeout(uhr);
			// Die Fragen stehen jetzt in der Datenbank — die Seite holt sie sich von dort.
			if (fertig) await invalidateAll();
		}
	}

	function nochmal() {
		geholtFuer = null;
		stromFehler = null;
	}

	const rueckmeldung = $derived(
		form && 'outcome' in form
			? (form as {
					antwort: string[];
					art: string;
					outcome: 'richtig' | 'teilweise' | 'falsch';
					perfekt: boolean;
					nochEinVersuch: boolean;
					hinweis: string | null;
					loesung: string[] | null;
				})
			: null
	);
	// Pfeile nur, wo die Reihenfolge die Antwort ist — sonst ist eine Aufzählung gemeint.
	const alsListe = (art: string, teile: string[] | null | undefined) =>
		(teile ?? []).join(art === 'order' || art === 'match' ? ' → ' : ', ');

	// Mehrfachauswahl im Plan: welche Punkte sind angetippt, und wann sollen sie dran sein.
	let gewaehltePunkte = $state<number[]>([]);
	let termine = $state<Record<number, string>>({});
	const punktAn = (i: number) => gewaehltePunkte.includes(i);
	function punktToggle(i: number) {
		gewaehltePunkte = punktAn(i) ? gewaehltePunkte.filter((x) => x !== i) : [...gewaehltePunkte, i];
	}

	let gewaehlterFokus = $state<string[]>([]);
	function fokusToggle(k: string) {
		gewaehlterFokus = gewaehlterFokus.includes(k)
			? gewaehlterFokus.filter((x) => x !== k)
			: [...gewaehlterFokus, k];
	}

	function reihenfolgeToggle(o: string) {
		reihenfolge = reihenfolge.includes(o)
			? reihenfolge.filter((x) => x !== o)
			: [...reihenfolge, o];
	}

	function paarSetzen(rechts: string) {
		if (!offenesLinks) return;
		// Ein rechter Begriff gehört zu genau einem linken.
		for (const [l, r] of Object.entries(paare)) if (r === rechts) delete paare[l];
		paare[offenesLinks] = rechts;
		offenesLinks = null;
	}

	const alleZugeordnet = $derived(
		frage?.art === 'match' ? frage.optionen.auswahl.every((l) => paare[l]) : false
	);
	const heute = new Date().toISOString().slice(0, 10);
</script>

<div class="kopf">
	<div class="row" style="align-items:flex-start">
		<div>
			<p class="eyebrow" style="margin:0 0 4px">{data.fach}</p>
			<h1 style="margin:0;font-size:24px">{data.kapitel}</h1>
		</div>
		{#if data.phase !== 'fertig'}
			<form method="POST" action="?/beenden">
				<button class="btn btn--plain beenden">Runde beenden</button>
			</form>
		{/if}
	</div>
	<div class="pillen">
		<span class="tag" class:an={schritt === 1} class:durch={schritt > 1}>1 Einordnen</span>
		<span class="tag" class:an={schritt === 2} class:durch={schritt > 2}>2 Vergleichen</span>
		<span class="tag" class:an={schritt === 3} class:durch={schritt > 3}>3 Plan machen</span>
		{#if notiz}<span class="small notiz">{notiz}</span>{/if}
	</div>
</div>

<div class="lauf">
	{#if form && 'message' in form && form.message}
		<div class="meldung meldung--fehler">{form.message}</div>
	{/if}

	<!-- ─────────── Selbsteinschätzung vorher ─────────── -->
	{#if data.phase === 'selbst'}
		<div class="card steigt">
			<p style="margin:0;font-size:17px;line-height:1.55">
				{data.kapitel} – fünf Fragen aus deinem eigenen Heft. Vorher eine Sache: wie sicher fühlst
				du dich gerade damit?
			</p>
		</div>
		<form method="POST" action="?/selbsteinschaetzung" class="card">
			<div class="stufen">
				{#each data.sicherheiten as label, i (label)}
					<button class="btn btn--quiet" name="wert" value={i + 1}>{label}</button>
				{/each}
			</div>
		</form>

		<!-- ─────────── Fragen ─────────── -->
		<!-- ─────────── Die nächste Frage entsteht ───────────
		     Gleiche Karte, gleicher Zähler, gleiche KI-Kennzeichnung wie eine fertige Frage: das
		     Kind sieht, was kommt, statt einer leeren Seite. -->
	{:else if data.phase === 'wartet'}
		{#if stromFehler}
			<div class="card steigt">
				<p class="eyebrow fragenkopf" style="margin:0 0 8px">
					<span>Frage {data.nummer} von {data.von}</span>
					<span class="tag tag--ki">{KI_MARKE}</span>
				</p>
				<div class="blase" style="margin:0 0 14px">{stromFehler}</div>
				{#if data.nummer > 1}
					<p style="margin:0 0 14px;font-size:15px;color:var(--ink-2)">
						Was du bisher beantwortet hast, bleibt erhalten.
					</p>
				{/if}
				<div class="stapel">
					<button class="btn btn--go btn--block" type="button" onclick={nochmal}>
						Nochmal versuchen
					</button>
					<a class="btn btn--quiet btn--block" href="/schueler/kapitel/{data.kapitelId}">
						Später weitermachen
					</a>
				</div>
			</div>
		{:else}
			<div class="card steigt">
				<p class="eyebrow fragenkopf" style="margin:0 0 8px">
					<span>Frage {data.nummer} von {data.von}</span>
					<span class="tag tag--ki">{KI_MARKE}</span>
				</p>

				<p class="entsteht" {...kiErzeugt}>
					{strom}{#if strom}<span class="kursor"></span>{/if}
				</p>

				<!-- Die Form der Antwort steht schon da, damit die Karte nicht als Loch wirkt. -->
				<div class="stapel" aria-hidden="true">
					<div class="platzhalter"></div>
					<div class="platzhalter" style="animation-delay:.2s"></div>
					<div class="platzhalter" style="animation-delay:.4s"></div>
				</div>
			</div>

			<div class="card card--tint atmet" aria-live="polite">
				<p style="margin:0;font-size:17px;line-height:1.55">
					{#if lage === 'heft'}
						Einen Moment, ich schaue in dein Heft nach<span class="punkte"><i></i><i></i><i></i></span>
					{:else}
						Ich schreibe dir die Frage<span class="punkte"><i></i><i></i><i></i></span>
					{/if}
				</p>
				{#if langeSchonDa}
					<p class="dauert">
						Das dauert heute länger als sonst. Ich bin noch dran — du kannst auch kurz ins Heft
						gehen und gleich wiederkommen.
					</p>
				{/if}
			</div>
		{/if}
	{:else if data.phase === 'fragen' && frage}
		{#if rueckmeldung}
			<div class="blase">{rueckmeldung.antwort.join(' · ')}</div>
			<div
				class="card"
				class:gut={rueckmeldung.perfekt}
				class:halb={!rueckmeldung.perfekt && rueckmeldung.outcome === 'teilweise'}
				class:daneben={!rueckmeldung.perfekt && rueckmeldung.outcome === 'falsch'}
			>
				<p style="margin:0;font-size:17px;line-height:1.55">
					{#if rueckmeldung.outcome === 'richtig'}
						Stimmt – genau so steht es in deinem Heft.
					{:else if rueckmeldung.nochEinVersuch}
						Noch nicht ganz. {rueckmeldung.hinweis}
					{:else if rueckmeldung.perfekt}
						Richtig. Beim zweiten Griff war es da.
					{:else if rueckmeldung.outcome === 'teilweise'}
						Ein Teil sitzt. Richtig wäre: {alsListe(rueckmeldung.art, rueckmeldung.loesung)}
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
			<input type="hidden" name="frage" value={frage.id} />
			<p class="eyebrow fragenkopf" style="margin:0 0 8px">
				<span>Frage {frage.nummer} von {frage.von}{data.zweiterVersuch ? ' · zweiter Versuch' : ''}</span>
				<span class="tag tag--ki">{KI_MARKE}</span>
			</p>
			<p style="margin:0 0 14px;font-size:17px;line-height:1.55" {...kiErzeugt}>{frage.prompt}</p>

			<!-- Nach der Rückmeldung steht der Hinweis schon dort — hier nur beim Neuladen. -->
			{#if data.zweiterVersuch && data.hinweis && !rueckmeldung}
				<p class="card card--tint hinweis">{data.hinweis}</p>
			{/if}

			{#if frage.art === 'single' || frage.art === 'yesno'}
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
								class:fertig={Boolean(paare[links])}
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

		{#if laeuft}
			<div class="card card--tint atmet">
				<p style="margin:0;font-size:17px;line-height:1.55">
					{data.danachWarten
						? 'Gut. Die letzten zwei Fragen kommen gleich.'
						: 'Einen Moment …'}
				</p>
			</div>
		{/if}

		<!-- ─────────── Spiegel ─────────── -->
	{:else if data.phase === 'spiegel'}
		<div class="card steigt">
			<!-- Der Spiegel-Agent verbindet Selbstbild und Ergebnis selbst — hier nichts davorsetzen,
			     sonst steht es zweimal da. -->
			<p style="margin:0;font-size:17px;line-height:1.55">{data.spiegel.satz}</p>
		</div>
		<div class="card">
			{#if data.spiegel.sitzt.length}
				<p class="eyebrow" style="margin:0 0 12px">Sitzt schon</p>
				<div class="chips" style="margin-bottom:18px">
					{#each data.spiegel.sitzt as s (s)}
						<span class="chip mint" style="cursor:default">{s}</span>
					{/each}
				</div>
			{/if}
			{#if data.spiegel.wackelt.length}
				<p class="eyebrow" style="margin:0 0 12px">Wackelt noch</p>
				<div class="chips">
					{#each data.spiegel.wackelt as w (w)}
						<span class="chip apricot" style="cursor:default">{w}</span>
					{/each}
				</div>
			{/if}
		</div>

		{#if !data.reaktion}
			<form
				method="POST"
				action="?/spiegelReaktion"
				class="card"
				use:enhance={() => {
					laeuft = true;
					return async ({ update }) => {
						await update();
						laeuft = false;
					};
				}}
			>
				<p style="margin:0 0 14px;font-size:17px">Passt das zu deinem Gefühl?</p>
				<div class="stapel">
					{#each Object.entries(data.reaktionen) as [wert, label] (wert)}
						<button class="btn btn--quiet btn--block links" name="wert" value={wert} disabled={laeuft}>
							{label}
						</button>
					{/each}
				</div>
			</form>
		{:else}
			<div class="blase">{data.reaktionen[data.reaktion as keyof typeof data.reaktionen]}</div>
			<form
				method="POST"
				action="?/fokus"
				class="card"
				use:enhance={() => {
					laeuft = true;
					return async ({ update }) => {
						await update();
						laeuft = false;
					};
				}}
			>
				<p style="margin:0 0 6px;font-size:17px">Was davon willst du zuerst festmachen?</p>
				<p class="small" style="margin:0 0 14px">Du kannst auch nichts auswählen.</p>
				<div class="chips">
					{#each data.spiegel.kandidaten as k (k)}
						<button
							type="button"
							class="chip"
							aria-pressed={gewaehlterFokus.includes(k)}
							onclick={() => fokusToggle(k)}
							style="min-height:48px"
						>
							{k}
						</button>
					{/each}
				</div>
				{#each gewaehlterFokus as k (k)}
					<input type="hidden" name="kandidat" value={k} />
				{/each}
				<button class="btn btn--lg btn--block" style="margin-top:18px" disabled={laeuft}>
					Weiter zum Plan
				</button>
			</form>
		{/if}

		<!-- Spiegel und Plan holt jeweils der nächste Seiten-Load beim Agenten. Ohne diese Meldung
		     stünde die Seite still, während er arbeitet — dasselbe Loch wie früher bei den Fragen. -->
		{#if laeuft}
			<div class="card card--tint atmet">
				<p style="margin:0;font-size:17px;line-height:1.55">
					{data.reaktion
						? 'Ich schaue, was sich zum Üben lohnt'
						: 'Einen Moment …'}<span class="punkte"><i></i><i></i><i></i></span>
				</p>
			</div>
		{/if}

		<!-- ─────────── Plan ─────────── -->
	{:else if data.phase === 'plan'}
		<div class="card steigt">
			<p style="margin:0;font-size:17px;line-height:1.55">{data.plan.satz}</p>
		</div>

		{#if data.plan.vorschlaege.length}
			<form method="POST" action="?/planSpeichern" class="card">
				<p class="eyebrow" style="margin:0 0 12px">
					{data.plan.allesSitzt ? 'Freiwillig, eine Stufe höher' : 'Zur Auswahl'}
				</p>
				<div class="stapel">
					{#each data.plan.vorschlaege as v, i (v.auftrag)}
						<div class="vorschlag" class:an={punktAn(i)}>
							<button type="button" class="vorschlag__knopf" onclick={() => punktToggle(i)}>
								<span>
									<span class="vorschlag__text">{v.auftrag}</span>
									<span class="small">etwa {v.minuten} Minuten · {v.thema}</span>
								</span>
								<span class="tag klein">{punktAn(i) ? 'nehme ich' : 'antippen'}</span>
							</button>
							{#if punktAn(i)}
								<input type="hidden" name="punkt" value={i} />
								<div class="wann">
									<label class="chip" aria-pressed={(termine[i] ?? 'sofort') === 'sofort'}>
										<input
											type="radio"
											name="wann-{i}"
											value="sofort"
											checked={(termine[i] ?? 'sofort') === 'sofort'}
											onchange={() => (termine[i] = 'sofort')}
										/>
										Sofort
									</label>
									<label class="chip" aria-pressed={(termine[i] ?? 'sofort') !== 'sofort'}>
										<input
											type="radio"
											name="wann-{i}"
											value={termine[i] && termine[i] !== 'sofort' ? termine[i] : heute}
											checked={(termine[i] ?? 'sofort') !== 'sofort'}
											onchange={() => (termine[i] = heute)}
										/>
										An einem Tag
									</label>
									{#if (termine[i] ?? 'sofort') !== 'sofort'}
										<input
											class="datum"
											type="date"
											min={heute}
											value={termine[i]}
											onchange={(e) => (termine[i] = e.currentTarget.value)}
										/>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
				<button
					class="btn btn--go btn--lg btn--block"
					style="margin-top:18px"
					disabled={!gewaehltePunkte.length}
				>
					In meinen Lernplan
				</button>
			</form>
		{/if}

		<form method="POST" action="?/ohnePlan">
			<button class="btn btn--quiet btn--block" style="min-height:52px">
				{data.plan.allesSitzt ? 'Danke, reicht mir' : 'Diesmal nichts mitnehmen'}
			</button>
		</form>

		<!-- ─────────── Fertig ─────────── -->
	{:else if data.phase === 'fertig'}
		<div class="card gut steigt">
			<p style="margin:0;font-size:17px;line-height:1.55">
				{#if data.punkte.length}
					Dein Plan steht – und er ist deiner. Du hast selbst ausgewählt, was drauf kommt.
				{:else}
					Durch. Diesmal nimmst du nichts mit – das ist auch eine Antwort.
				{/if}
			</p>
		</div>

		{#if data.punkte.length}
			<div class="card">
				<div class="row" style="margin-bottom:14px">
					<h3>Neu in deinem Lernplan</h3>
					<span class="tag">{data.fach}</span>
				</div>
				<div class="stapel">
					{#each data.punkte as p, i (p.auftrag)}
						<div class="punkt">
							<span class="ziffer">{i + 1}</span>
							<span>
								<span class="vorschlag__text">{p.auftrag}</span>
								<span class="small">
									{p.minutes ? `etwa ${p.minutes} Minuten` : 'kurz'}
									{p.dueAt
										? ` · ab ${new Date(p.dueAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`
										: ' · sofort'}
								</span>
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="knoepfe">
			<a class="btn btn--lg" href="/schueler/plan">Mein Lernplan</a>
			<a class="btn btn--quiet" href="/schueler?fach={data.fachId}">Zum Inhaltsverzeichnis</a>
		</div>

		<!-- ─────────── Es klemmt ─────────── -->
	{:else}
		<div class="card card--tint steigt">
			<p style="margin:0 0 14px;font-size:17px;line-height:1.55">{data.fehler}</p>
			<div class="knoepfe">
				<a class="btn" href="/schueler/runde/{data.roundId}">Nochmal versuchen</a>
				<form method="POST" action="?/beenden">
					<button class="btn btn--quiet">Runde beenden</button>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Fragenkopf trägt jetzt zwei Dinge: die Zählung und die Herkunftsmarke. */
	.fragenkopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.kopf {
		padding-bottom: 14px;
		border-bottom: 1px solid var(--line);
		margin-bottom: 18px;
	}
	.beenden {
		min-height: 44px;
		white-space: nowrap;
	}
	.pillen {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}
	.pillen .tag.an {
		background: var(--lavender);
		color: var(--lavender-ink);
	}
	.pillen .tag.durch {
		background: var(--mint);
		color: var(--mint-ink);
	}
	.notiz {
		font-size: 13px;
	}
	.lauf {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 620px;
	}
	.steigt {
		animation: la-rise 0.25s ease;
	}
	.atmet {
		animation: la-breathe 1.6s ease-in-out infinite;
	}
	/* Was das Kind gesagt hat, steht rechts — wie im Gespräch. */
	.blase {
		align-self: flex-end;
		max-width: 85%;
		background: var(--lavender);
		color: var(--lavender-ink);
		border-radius: var(--r-lg) var(--r-lg) 4px var(--r-lg);
		padding: 12px 16px;
		font-size: 16px;
	}
	.gut {
		background: var(--mint);
		border-color: var(--mint-2);
		color: var(--mint-ink);
	}
	.halb,
	.daneben {
		background: var(--apricot);
		border-color: var(--apricot-2);
		color: var(--apricot-ink);
	}
	.hinweis {
		margin: 0 0 14px;
		font-size: 16px;
		line-height: 1.5;
		padding: 12px 14px;
	}

	/* ─── Die Frage entsteht ─── */
	.entsteht {
		margin: 0 0 14px;
		font-size: 17px;
		line-height: 1.55;
		/* Hält die Höhe einer einzeiligen Frage, damit die Karte beim ersten Wort nicht springt. */
		min-height: 1.55em;
	}
	.kursor {
		display: inline-block;
		width: 2px;
		height: 1.05em;
		vertical-align: -0.18em;
		margin-left: 2px;
		background: var(--lavender-ink);
		animation: la-blink 1s steps(2, start) infinite;
	}
	@keyframes la-blink {
		50% {
			opacity: 0;
		}
	}
	/* Kein Spinner, sondern die Form der Antwort, die noch kommt. */
	.platzhalter {
		height: 48px;
		border-radius: var(--r);
		background: linear-gradient(
			100deg,
			var(--paper-2) 30%,
			oklch(0.96 0.012 285) 50%,
			var(--paper-2) 70%
		);
		background-size: 220% 100%;
		animation: la-sweep 1.6s ease-in-out infinite;
	}
	@keyframes la-sweep {
		to {
			background-position: -120% 0;
		}
	}
	.punkte {
		display: inline-flex;
		gap: 4px;
		margin-left: 4px;
		vertical-align: 2px;
	}
	.punkte i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.35;
		animation: la-dot 1.25s ease-in-out infinite;
	}
	.punkte i:nth-child(2) {
		animation-delay: 0.16s;
	}
	.punkte i:nth-child(3) {
		animation-delay: 0.32s;
	}
	@keyframes la-dot {
		40% {
			opacity: 1;
			transform: translateY(-2px);
		}
	}
	.dauert {
		margin: 12px 0 0;
		font-size: 15px;
		line-height: 1.5;
		background: var(--apricot);
		color: var(--apricot-ink);
		border-radius: var(--r);
		padding: 10px 13px;
	}
	@media (prefers-reduced-motion: reduce) {
		.platzhalter,
		.kursor,
		.punkte i,
		.atmet {
			animation: none;
		}
	}
	.stufen {
		display: grid;
		gap: 8px;
	}
	.stufen :global(.btn) {
		min-height: 54px;
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
		gap: 12px;
	}
	.gewaehlt {
		background: var(--lavender);
		border-color: var(--lavender-2);
		color: var(--lavender-ink);
	}
	.fertig {
		border-color: var(--mint-2);
	}
	.nummer {
		flex: none;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--paper-2);
		font-size: 13px;
	}
	.wahl {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 54px;
		padding: 10px 14px;
		border: 1px solid var(--line-2);
		border-radius: var(--r);
		background: var(--surface);
		font-size: 16px;
		line-height: 1.35;
		cursor: pointer;
	}
	.wahl:has(input:checked) {
		background: var(--lavender);
		border-color: var(--lavender-2);
		color: var(--lavender-ink);
	}
	.wahl input {
		width: 22px;
		height: 22px;
		accent-color: var(--lavender-ink);
	}
	.absenden {
		margin-top: 14px;
		min-height: 54px;
	}
	.paare {
		display: grid;
		gap: 10px;
	}
	.klein {
		font-size: 12px;
	}
	.chip.mint {
		background: var(--mint);
		border-color: var(--mint-2);
		color: var(--mint-ink);
	}
	.chip.apricot {
		background: var(--apricot);
		border-color: var(--apricot-2);
		color: var(--apricot-ink);
	}
	.vorschlag {
		border: 1px solid var(--line-2);
		border-radius: var(--r);
		background: var(--surface);
	}
	.vorschlag.an {
		border-color: var(--lavender-2);
		background: var(--lavender);
	}
	.vorschlag__knopf {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 62px;
		padding: 12px 14px;
		border: 0;
		border-radius: var(--r);
		background: transparent;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
	}
	.vorschlag__text {
		display: block;
		font-size: 16px;
		line-height: 1.35;
	}
	.vorschlag :global(.small) {
		display: block;
		font-size: 13px;
	}
	.wann {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 0 14px 14px;
	}
	.wann .chip input {
		width: 18px;
		height: 18px;
		accent-color: var(--lavender-ink);
	}
	.datum {
		min-height: 44px;
		padding: 0 12px;
		border: 1px solid var(--line-2);
		border-radius: var(--r);
		background: var(--surface);
		font-family: var(--text);
		font-size: 15px;
		color: var(--ink);
	}
	.punkt {
		display: grid;
		grid-template-columns: 26px 1fr;
		align-items: start;
		gap: 12px;
		min-height: 52px;
	}
	.ziffer {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--paper-2);
		font-family: var(--display);
		font-weight: 700;
		font-size: 13px;
	}
	.punkt :global(.small) {
		display: block;
		font-size: 13px;
	}
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.knoepfe :global(.btn) {
		min-height: 54px;
	}

	@media (min-width: 700px) {
		.stufen {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.paare {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
