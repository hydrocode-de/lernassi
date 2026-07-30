<script lang="ts">
	import { page } from '$app/state';
	import { fachTon, initialen } from '$lib/heft';

	let { children, data } = $props();
	const aktiv = $derived(page.url.pathname);
	// Während des Fotografierens tritt die Navigation zurück.
	const angemeldet = $derived(Boolean(data.pseudonym) && aktiv !== '/schueler/aufnehmen');
	const aufKonto = $derived(aktiv.startsWith('/schueler/konto'));
	const aufPlan = $derived(aktiv.startsWith('/schueler/plan'));
	const aufUeben = $derived(aktiv.startsWith('/schueler/ueben'));
	// Ohne Angabe steht das erste Fach offen — die Spalte markiert dasselbe wie die Seite.
	const gewaehltesFach = $derived(
		page.url.searchParams.get('fach') ?? data.faecher[0]?.id ?? null
	);

	let menueOffen = $state(false);
</script>

<div class="shell">
	<aside class="spalte">
		<a href="/schueler" class="marke">lernassi</a>

		<a href="/schueler/aufnehmen" class="btn btn--block hinzu">
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path
					d="M4 8.5h2.6l1.3-2h8.2l1.3 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
				/>
				<circle cx="12" cy="13.5" r="3.4" />
			</svg>
			Aufschrieb hinzufügen
		</a>

		{#if data.faecher.length}
			<p class="eyebrow faecher__titel">Meine Fächer</p>
			<div class="faecher">
				{#each data.faecher as fach, i (fach.id)}
					<a
						href="/schueler?fach={fach.id}"
						class="fach"
						class:an={!aufKonto && gewaehltesFach === fach.id}
					>
						<span class="fach__punkt" style="background:var(--{fachTon(i)}-ink)"></span>
						<span class="fach__name">{fach.title}</span>
						<span class="fach__zahl">{fach.anzahlThemen}</span>
					</a>
				{/each}
			</div>
		{/if}

		<a href="/schueler/plan" class="btn btn--plain uebenSpalte" class:an={aufPlan}>Mein Lernplan</a>
		<!-- „Üben" nimmt die nächste Karte der Warteschlange, ohne Fachwahl. -->
		<a href="/schueler/ueben/neu" class="btn btn--plain uebenSpalte" class:an={aufUeben}>Üben</a>

		<div class="konto">
			{#if menueOffen}
				<div class="menue">
					<a href="/schueler/konto" class="btn btn--plain" onclick={() => (menueOffen = false)}>
						Mein Konto
					</a>
					<form method="POST" action="/abmelden">
						<button class="btn btn--plain abmelden">Abmelden</button>
					</form>
				</div>
			{/if}
			<button
				type="button"
				class="kontoknopf"
				onclick={() => (menueOffen = !menueOffen)}
				aria-expanded={menueOffen}
			>
				<span class="avatar avatar--klein">{initialen(data.pseudonym)}</span>
				<span class="kontoknopf__text">
					<span class="kontoknopf__name">{data.pseudonym}</span>
					{#if data.klasse}<span class="small kontoknopf__klasse">Klasse {data.klasse}</span>{/if}
				</span>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m6 15 6-6 6 6" />
				</svg>
			</button>
		</div>
	</aside>

	<div class="haupt">
		{#if angemeldet}
			<div class="kopf">
				<a href="/schueler" class="marke">lernassi</a>
				<a href="/schueler/konto" class="avatar avatar--knopf" aria-label="Mein Konto">
					{initialen(data.pseudonym)}
				</a>
			</div>
		{/if}

		<div class="inhalt">
			{@render children()}
		</div>

		{#if angemeldet}
			<nav class="tabs">
				<a href="/schueler" class:an={aktiv === '/schueler'}>Inhalt</a>
				<a href="/schueler/plan" class:an={aufPlan}>Plan</a>
				<a href="/schueler/ueben/neu" class:an={aufUeben}>Üben</a>
				<a href="/schueler/konto" class:an={aufKonto}>Ich</a>
			</nav>
		{/if}
	</div>
</div>

<style>
	.shell {
		min-height: 100vh;
		display: flex;
		background: var(--paper);
	}
	.haupt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.inhalt {
		flex: 1;
		width: 100%;
		max-width: 720px;
		margin: 0 auto;
		padding: 8px 20px 24px;
	}

	/* ---------- Kopf und Tab-Leiste: nur am Handy ---------- */
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 18px 20px 8px;
	}
	.marke {
		font-family: var(--display);
		font-weight: 700;
		font-size: 19px;
		letter-spacing: -0.01em;
		color: var(--ink);
		text-decoration: none;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--lavender);
		color: var(--lavender-ink);
		font-family: var(--display);
		font-weight: 700;
		font-size: 14px;
	}
	.avatar--knopf {
		flex: none;
		border: 1px solid var(--lavender-2);
		text-decoration: none;
	}
	.tabs {
		position: sticky;
		bottom: 0;
		flex: none;
		display: flex;
		gap: 6px;
		padding: 8px 14px calc(14px + env(safe-area-inset-bottom));
		background: var(--surface);
		border-top: 1px solid var(--line);
	}
	.tabs a {
		flex: 1;
		min-height: 56px;
		display: grid;
		place-items: center;
		border-radius: var(--r);
		font-family: var(--display);
		font-weight: 600;
		font-size: 15px;
		color: var(--ink-3);
		text-decoration: none;
	}
	.tabs a:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
	.tabs a.an {
		background: var(--lavender);
		color: var(--lavender-ink);
	}

	/* ---------- Fächer-Spalte: nur am Rechner ---------- */
	.spalte {
		display: none;
		flex: none;
		width: 268px;
		border-right: 1px solid var(--line);
		background: var(--surface);
		flex-direction: column;
		padding: 22px 16px 14px;
		/* Bleibt stehen, während der Inhalt scrollt: die Navigation ist kein Seiteninhalt.
		   `align-self` verhindert, dass die Spalte auf die Höhe des Inhalts mitwächst. */
		position: sticky;
		top: 0;
		align-self: flex-start;
		height: 100vh;
		box-sizing: border-box;
		overflow-y: auto;
	}
	.spalte .marke {
		margin: 0 0 20px 4px;
		font-size: 21px;
	}
	.hinzu {
		min-height: 52px;
		gap: 10px;
		font-size: 15px;
		white-space: nowrap;
	}
	.faecher__titel {
		margin: 26px 0 10px 4px;
	}
	.faecher {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.fach {
		display: grid;
		grid-template-columns: 9px 1fr auto;
		align-items: center;
		gap: 11px;
		min-height: 46px;
		padding: 8px 12px;
		border-radius: var(--r);
		color: var(--ink-2);
		font-family: var(--display);
		font-weight: 600;
		font-size: 16px;
		text-decoration: none;
	}
	.fach:hover {
		background: var(--paper-2);
	}
	.fach.an {
		background: var(--lavender);
		color: var(--lavender-ink);
	}
	.fach__punkt {
		width: 9px;
		height: 9px;
		border-radius: 3px;
	}
	.fach__zahl {
		font-weight: 400;
		opacity: 0.7;
		font-size: 14px;
	}
	.uebenSpalte {
		margin: 14px 0 0;
		justify-content: flex-start;
		min-height: 44px;
		font-size: 15px;
	}
	.uebenSpalte + .uebenSpalte {
		margin-top: 2px;
	}
	a.uebenSpalte.an {
		background: var(--lavender);
		color: var(--lavender-ink);
		text-decoration: none;
	}

	.konto {
		position: relative;
		margin-top: auto;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}
	.menue {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r);
		box-shadow: var(--shadow-lift);
		padding: 6px;
		z-index: 80;
		animation: la-rise 0.18s ease;
	}
	.menue :global(.btn) {
		width: 100%;
		justify-content: flex-start;
		min-height: 44px;
		font-size: 15px;
	}
	.abmelden {
		color: var(--rose-ink);
	}
	.kontoknopf {
		display: grid;
		grid-template-columns: 34px 1fr auto;
		align-items: center;
		gap: 11px;
		width: 100%;
		min-height: 52px;
		padding: 6px 10px;
		border: 0;
		border-radius: var(--r);
		background: transparent;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: var(--ink-3);
	}
	.kontoknopf:hover {
		background: var(--paper-2);
	}
	.avatar--klein {
		width: 34px;
		height: 34px;
	}
	.kontoknopf__text {
		min-width: 0;
	}
	.kontoknopf__name {
		display: block;
		font-family: var(--display);
		font-weight: 600;
		font-size: 15px;
		color: var(--ink);
	}
	.kontoknopf__klasse {
		display: block;
		font-size: 13px;
	}

	@media (min-width: 860px) {
		.spalte {
			display: flex;
		}
		.kopf,
		.tabs {
			display: none;
		}
		.inhalt {
			max-width: 960px;
			margin: 0;
			padding: 34px 40px 48px;
		}
	}
</style>
