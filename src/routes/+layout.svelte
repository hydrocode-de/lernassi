<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#1d4ed8" />
</svelte:head>

<header>
	<a class="brand" href="/">lernassi</a>
	<nav>
		{#if data.user}
			<span class="who">{data.user.name ?? data.user.username} · {data.user.role}</span>
			<form method="POST" action="/abmelden"><button>Abmelden</button></form>
		{:else}
			<a href="/lehrer/anmelden">Lehrkraft</a>
			<a href="/schueler/anmelden">Schüler:in</a>
		{/if}
	</nav>
</header>

<main>
	{@render children()}
</main>
