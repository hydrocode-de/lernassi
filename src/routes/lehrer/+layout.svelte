<script lang="ts">
	let { children, data } = $props();
</script>

<header class="kopfzeile">
	<a href="/lehrer" class="marke">lernassi</a>
	{#if data.user}
		<div class="row" style="gap:12px">
			<span class="small">{data.user.name ?? data.user.email}</span>
			<form method="POST" action="/abmelden">
				<button class="btn btn--quiet">Abmelden</button>
			</form>
		</div>
	{/if}
</header>

<div class="seite">
	{@render children()}
</div>
