<script lang="ts">
	import '@fontsource/quicksand/500.css';
	import '@fontsource/quicksand/600.css';
	import '@fontsource/quicksand/700.css';
	import '@fontsource-variable/source-sans-3';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#fbfaf7" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="lernassi" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="mobile-web-app-capable" content="yes" />
</svelte:head>

{@render children()}
