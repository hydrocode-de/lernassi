<script lang="ts">
	import { page } from '$app/state';

	let { children, data } = $props();
	const aktiv = $derived(page.url.pathname);
	// Während des Fotografierens tritt die Navigation zurück.
	const angemeldet = $derived(Boolean(data.pseudonym) && aktiv !== '/schueler/aufnehmen');
</script>

<div class="shell">
	<div class="inhalt">
		{@render children()}
	</div>

	{#if angemeldet}
		<nav class="tabs">
			<a href="/schueler" class:an={aktiv === '/schueler'}>Inhalt</a>
			<span class="spaeter">Üben</span>
			<a href="/schueler/meine-fotos" class:an={aktiv.startsWith('/schueler/meine-fotos')}>Ich</a>
		</nav>
	{/if}
</div>

<style>
	.shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.inhalt {
		flex: 1;
		width: 100%;
		max-width: 720px;
		margin: 0 auto;
		padding: 28px 20px 24px;
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
	.tabs a,
	.tabs .spaeter {
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
	.tabs .spaeter {
		color: var(--ink-3);
		opacity: 0.45;
	}

	@media (min-width: 860px) {
		.inhalt {
			max-width: 960px;
			padding: 34px 44px 48px;
		}
	}
</style>
