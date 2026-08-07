<script lang="ts">
	import { untrack } from 'svelte';
	import { KI_MARKE, KI_RECHERCHE } from '$lib/ki';

	let { data, form } = $props();

	type Quelle = { name: string; url: string; lizenz: string };
	type Entwurf = {
		thema: string;
		text: string;
		zusammenfassung: string;
		begriffe: string[];
		quellen: Quelle[];
	};

	// Startwert, bewusst nur einmal gelesen: danach gehört das Feld dem Kind.
	let thema = $state(untrack(() => data.vorschlag));
	let laeuft = $state(false);
	let schritte = $state<string[]>([]);
	let meldung = $state<string | null>(null);
	let entwurf = $state<Entwurf | null>(null);

	// Im Entwurf darf das Kind alles ändern — es ist sein Heft. Während lernassi schreibt,
	// füllen sich dieselben Felder; angefasst werden dürfen sie erst danach.
	let titel = $state('');
	let text = $state('');
	let schreibt = $state(false);

	async function nachlesen() {
		laeuft = true;
		schreibt = false;
		schritte = [];
		meldung = null;
		entwurf = null;
		titel = '';
		text = '';

		try {
			const antwort = await fetch('/schueler/recherche/strom', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kapitel: data.kapitel.id, thema })
			});
			if (!antwort.ok || !antwort.body) throw new Error(String(antwort.status));

			// NDJSON: eine Zeile je Ereignis, wie bei der Welle und im Gespräch.
			const leser = antwort.body.getReader();
			const dekoder = new TextDecoder();
			let rest = '';
			for (;;) {
				const { value, done } = await leser.read();
				if (done) break;
				rest += dekoder.decode(value, { stream: true });
				const zeilen = rest.split('\n');
				rest = zeilen.pop() ?? '';
				for (const z of zeilen) {
					if (!z.trim()) continue;
					const e = JSON.parse(z) as { t: string; v: unknown };
					if (e.t === 'schritt') schritte = [...schritte, String(e.v)];
					else if (e.t === 'leer' || e.t === 'fehler') meldung = String(e.v);
					else if (e.t === 'waechst') {
						// Jedes Stück enthält alles Bisherige — überschreiben, nicht anhängen.
						const teil = e.v as { titel?: string; text?: string };
						schreibt = true;
						if (teil.titel) titel = teil.titel;
						if (teil.text) text = teil.text;
					} else if (e.t === 'entwurf') {
						entwurf = e.v as Entwurf;
						titel = entwurf.thema;
						text = entwurf.text;
						schreibt = false;
					}
				}
			}
			if (!entwurf && !meldung) meldung = 'Da kam nichts zurück. Versuch es nochmal.';
		} catch {
			meldung = 'Ich komme gerade nicht an meine Lernseiten. Versuch es nochmal.';
		} finally {
			laeuft = false;
		}
	}

	function nochmal() {
		entwurf = null;
		schreibt = false;
		schritte = [];
		meldung = null;
	}
</script>

<a href="/schueler?fach={data.fach.id}&bearbeiten=1" class="zurueckknopf btn btn--plain">
	Zurück zum Verzeichnis
</a>

<p class="eyebrow" style="margin:0 0 6px">{data.fach.title} · {data.kapitel.title}</p>
<h1 style="margin:0 0 5px">Nachlesen</h1>

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}

{#if !entwurf && !schreibt}
	<p class="muted" style="margin:0 0 16px;font-size:16px">
		Für ein Thema, zu dem in deinem Heft noch nichts steht.
	</p>
	<p class="ki-hinweis" style="margin:0 0 20px">
		<span class="ki-hinweis__marke">{KI_MARKE}</span>
		<span>{KI_RECHERCHE}</span>
	</p>

	{#if meldung}<div class="meldung meldung--fehler">{meldung}</div>{/if}

	<form
		onsubmit={(e) => {
			e.preventDefault();
			if (thema.trim() && !laeuft) nachlesen();
		}}
	>
		<label class="field" style="margin-bottom:14px">
			<span class="field__label">Zu welchem Thema?</span>
			<input bind:value={thema} maxlength="120" disabled={laeuft} placeholder="z. B. Wiener Kongress" />
		</label>
		<button class="btn btn--go btn--lg btn--block" disabled={laeuft || !thema.trim()}>
			{laeuft ? 'Ich lese nach …' : 'Nachlesen'}
		</button>
	</form>

	{#if schritte.length}
		<!-- Was lernassi gerade tut, Satz für Satz. Kein Ladebalken: dass eine Quelle nicht
		     gereicht hat, ist die eigentliche Auskunft. -->
		<div class="card schrittkarte">
			<p class="eyebrow" style="margin:0 0 12px">Ich lese nach …</p>
			<ul class="schritte">
				{#each schritte as schritt, i (i)}
					<li class:jetzt={laeuft && i === schritte.length - 1}>
						{#if laeuft && i === schritte.length - 1}
							<span class="dreher"></span>
						{:else}
							<span class="haken">✓</span>
						{/if}
						<span>{schritt}</span>
					</li>
				{/each}
			</ul>
		</div>
	{:else if !laeuft}
		<p class="small" style="margin:12px 2px 0">
			Ich kann nur in {data.quellen.join(', ')} nachlesen – nicht im ganzen Internet.
		</p>
	{/if}
{:else}
	<!-- Entwurf: dasselbe Formular wie im Editor. Gespeichert wird erst beim Übernehmen. -->
	<div class="row" style="margin:14px 0 12px">
		<span class="tag tag--sky">Entwurf</span>
		<span class="small">
			{schreibt ? 'lernassi schreibt gerade …' : 'noch nicht in deinem Heft'}
		</span>
	</div>

	<form method="POST" action="?/uebernehmen">
		<input type="hidden" name="kapitel" value={data.kapitel.id} />
		<input type="hidden" name="nach" value={data.stelle} />
		{#if entwurf}
			<input type="hidden" name="zusammenfassung" value={entwurf.zusammenfassung} />
			<input type="hidden" name="begriffe" value={entwurf.begriffe.join(', ')} />
			<input type="hidden" name="quellen" value={JSON.stringify(entwurf.quellen)} />
		{/if}

		<label class="field" style="margin-bottom:10px">
			<span class="field__label">Titel</span>
			<input name="titel" bind:value={titel} maxlength="120" readonly={schreibt} required />
		</label>

		<!-- Während lernassi schreibt, füllt sich dasselbe Feld, in das das Kind gleich
		     hineinschreibt. Nur eben noch nicht anfassbar — sonst tippt es gegen den Strom an. -->
		<label class="field feld">
			<span class="field__label">
				{schreibt ? 'Text – entsteht gerade' : 'Text – ändere, was du willst'}
			</span>
			<textarea
				name="text"
				bind:value={text}
				rows="14"
				maxlength="20000"
				readonly={schreibt}
				required
			></textarea>
		</label>

		{#if entwurf}
			<p class="quellen">
				Aus: {#each entwurf.quellen as q, i (q.url)}{#if i > 0} · {/if}<a
						href={q.url}
						target="_blank"
						rel="noreferrer">{q.name}</a
					> ({q.lizenz}){/each}
			</p>

			<div class="hinweisbox">
				Das ist nachgelesen, nicht dein Unterricht. Was deine Lehrkraft gesagt hat, zählt mehr.
			</div>

			<div class="knoepfe">
				<button class="btn btn--go btn--lg btn--block">Passt – in mein Heft</button>
				<button type="button" class="btn btn--quiet btn--block" onclick={nochmal}>
					Anderes Thema
				</button>
			</div>
		{/if}
	</form>
{/if}

<style>
	.zurueckknopf {
		margin: 0 0 10px;
		padding-inline: 0;
		min-height: 44px;
	}
	.schrittkarte {
		margin-top: 18px;
	}
	.schritte {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.schritte li {
		display: grid;
		grid-template-columns: 18px 1fr;
		gap: 10px;
		font-size: 15px;
		line-height: 1.5;
		color: var(--ink-2);
		animation: auftauchen 0.25s ease;
	}
	.schritte li.jetzt {
		color: var(--ink);
	}
	@keyframes auftauchen {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	.haken {
		color: var(--mint-ink);
		font-size: 13px;
	}
	.dreher {
		width: 14px;
		height: 14px;
		margin-top: 3px;
		border-radius: 50%;
		border: 2px solid var(--lavender-2);
		border-top-color: var(--lavender-ink);
		animation: dreht 0.9s linear infinite;
	}
	@keyframes dreht {
		to {
			transform: rotate(360deg);
		}
	}
	.feld textarea {
		min-height: 34dvh;
		font-size: 17px;
		line-height: 1.65;
		resize: vertical;
	}
	.quellen {
		margin: 12px 0 0;
		font-size: 13px;
		line-height: 1.6;
		color: var(--ink-3);
	}
	.hinweisbox {
		margin-top: 12px;
		background: var(--apricot);
		border: 1px solid var(--apricot-2);
		color: var(--apricot-ink);
		border-radius: var(--r);
		padding: 11px 13px;
		font-size: 14px;
		line-height: 1.5;
	}
	.knoepfe {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 16px;
	}
	.knoepfe :global(.btn) {
		min-height: 52px;
	}
</style>
