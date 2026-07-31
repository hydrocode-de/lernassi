<script lang="ts">
	import { page } from '$app/state';
	import { initialen } from '$lib/heft';

	let { children, data } = $props();
	const aktiv = $derived(page.url.pathname);
	// Der Zurück-Weg gehört zur Seite, nicht zum Inhalt: die Seiten geben ihn im load mit.
	const zurueck = $derived(page.data.zurueck as { href: string; text: string } | undefined);

	let menueOffen = $state(false);
</script>

<div class="shell">
	<aside class="spalte">
		<a href="/lehrer" class="marke">lernassi</a>

		{#if zurueck}
			<a href={zurueck.href} class="btn btn--plain zurueck">
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m15 18-6-6 6-6" />
				</svg>
				{zurueck.text}
			</a>
		{/if}

		{#if data.klassen.length}
			<p class="eyebrow klassen__titel">Meine Klassen</p>
			<div class="klassen">
				{#each data.klassen as klasse (klasse.id)}
					<a
						href="/lehrer/klasse/{klasse.id}"
						class="klasse"
						class:an={aktiv.startsWith(`/lehrer/klasse/${klasse.id}`)}
					>
						{klasse.name}
					</a>
				{/each}
			</div>
		{/if}

		<a href="/lehrer" class="btn btn--plain neue" class:an={aktiv === '/lehrer'}>Klasse anlegen</a>

		{#if data.user}
			<div class="konto">
				{#if menueOffen}
					<div class="menue">
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
					<span class="avatar avatar--klein">{initialen(data.user.name ?? data.user.email)}</span>
					<span class="kontoknopf__text">
						<span class="kontoknopf__name">{data.user.name ?? data.user.email}</span>
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
		{/if}
	</aside>

	<div class="haupt">
		<div class="kopf">
			{#if zurueck}
				<a href={zurueck.href} class="kopfZurueck" aria-label={zurueck.text}>
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="m15 18-6-6 6-6" />
					</svg>
				</a>
			{:else}
				<a href="/lehrer" class="marke">lernassi</a>
			{/if}
			{#if data.user}
				<form method="POST" action="/abmelden">
					<button class="btn btn--plain kopfAbmelden">Abmelden</button>
				</form>
			{/if}
		</div>

		<div class="inhalt">
			{@render children()}
		</div>
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
		padding: 8px 20px 40px;
	}

	/* ---------- Kopf: nur am Handy ---------- */
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 12px 8px 20px;
	}
	.marke {
		font-family: var(--display);
		font-weight: 700;
		font-size: 19px;
		letter-spacing: -0.01em;
		color: var(--ink);
		text-decoration: none;
	}
	.kopfZurueck {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin-left: -10px;
		border-radius: 50%;
		color: var(--ink);
		text-decoration: none;
	}
	.kopfZurueck:hover {
		background: var(--paper-2);
	}
	.kopfAbmelden {
		min-height: 44px;
		font-size: 15px;
	}

	/* ---------- Seitenleiste: nur am Rechner ---------- */
	.spalte {
		display: none;
		flex: none;
		width: 268px;
		border-right: 1px solid var(--line);
		background: var(--surface);
		flex-direction: column;
		padding: 22px 16px 14px;
		/* Bleibt stehen, während der Inhalt scrollt: die Navigation ist kein Seiteninhalt. */
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
	.zurueck {
		justify-content: flex-start;
		gap: 6px;
		min-height: 44px;
		margin-bottom: 6px;
		font-size: 15px;
	}
	.klassen__titel {
		margin: 14px 0 10px 4px;
	}
	.klassen {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.klasse {
		display: flex;
		align-items: center;
		min-height: 46px;
		padding: 8px 12px;
		border-radius: var(--r);
		color: var(--ink-2);
		font-family: var(--display);
		font-weight: 600;
		font-size: 16px;
		text-decoration: none;
	}
	.klasse:hover {
		background: var(--paper-2);
	}
	.klasse.an {
		background: var(--lavender);
		color: var(--lavender-ink);
	}
	.neue {
		margin: 14px 0 0;
		justify-content: flex-start;
		min-height: 44px;
		font-size: 15px;
	}
	a.neue.an {
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
	.avatar {
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--lavender);
		color: var(--lavender-ink);
		font-family: var(--display);
		font-weight: 700;
		font-size: 14px;
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (min-width: 860px) {
		.spalte {
			display: flex;
		}
		.kopf {
			display: none;
		}
		.inhalt {
			max-width: 960px;
			margin: 0;
			padding: 34px 40px 48px;
		}
	}
</style>
