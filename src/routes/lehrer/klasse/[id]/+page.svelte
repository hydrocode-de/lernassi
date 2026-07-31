<script lang="ts">
	import type { Kategorie } from '$lib/kategorie';

	let { data, form } = $props();

	const KATEGORIEN: Kategorie[] = [1, 2, 3, 4];
	const fortgeschrieben = $derived(
		data.ziel?.updatedAt ? new Date(data.ziel.updatedAt).toLocaleDateString('de-DE') : null
	);
</script>

<h1 style="margin:0 0 6px">{data.cls.name}</h1>
<p class="muted" style="margin:0 0 26px">
	Klassencode <span class="tag mono">{data.cls.joinCode}</span>
</p>

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}
{#if form?.ok}<div class="meldung meldung--ok">{form.ok}</div>{/if}
{#if form?.warnung}<div class="meldung meldung--fehler">{form.warnung}</div>{/if}

<div class="card">
	<div class="row" style="margin-bottom:12px">
		<h2 style="margin:0">Lernziel</h2>
		{#if fortgeschrieben}
			<span class="small">fortgeschrieben am {fortgeschrieben}</span>
		{/if}
	</div>
	<p class="small" style="margin:0 0 14px">
		Es steuert, welche Fragen lernassi aus dem Heft eines Kindes auswählt und wie tief sie gehen.
		Die Kinder sehen es nicht.
	</p>
	<form method="POST" action="?/speichereZiel" class="stack">
		<label class="field">
			<span class="field__label">Für {data.cls.subject || 'diese Klasse'}</span>
			<textarea
				name="text"
				rows="8"
				maxlength="8000"
				placeholder={'Fachwissen: … \nAnalysekompetenz: … \nUrteilskompetenz: … \nMethodenkompetenz: …'}
				>{data.ziel?.description ?? ''}</textarea
			>
		</label>
		<button class="btn">{data.ziel ? 'Fortschreiben' : 'Speichern'}</button>
	</form>
</div>

<h2 style="margin:32px 0 12px">Kinder</h2>
{#if !data.kinder.length}
	<p class="muted" style="margin:0">Noch niemand angemeldet.</p>
{:else}
	<div class="stapel">
		{#each data.kinder as kind (kind.id)}
			<a class="card kindzeile" href="/lehrer/klasse/{data.cls.id}/kind/{kind.id}">
				<span class="kindzeile__name">{kind.name}</span>
				<span class="verteilung">
					{#if kind.themen}
						{#each KATEGORIEN as k (k)}
							{@const anzahl = kind.verteilung[k - 1]}
							{#if anzahl}
								<span class="tag tag--{data.kategorien[k].farbe}">
									{anzahl}&nbsp;{data.kategorien[k].wort}
								</span>
							{/if}
						{/each}
					{:else}
						<span class="small">noch nichts geübt</span>
					{/if}
				</span>
			</a>
		{/each}
	</div>
{/if}

<h2 style="margin:32px 0 12px">Was „sitzt" heißen soll</h2>
<form method="POST" action="?/speichereSkala" class="card grenzen">
	<label class="field">
		<span class="field__label">sitzt ab</span>
		<input type="number" name="eins" min="1" max="100" value={data.skala[0].ab} />
	</label>
	<label class="field">
		<span class="field__label">fast sicher ab</span>
		<input type="number" name="zwei" min="1" max="100" value={data.skala[1].ab} />
	</label>
	<label class="field">
		<span class="field__label">wackelt ab</span>
		<input type="number" name="drei" min="1" max="100" value={data.skala[2].ab} />
	</label>
	<button class="btn">Grenzen speichern</button>
</form>

<h2 style="margin:32px 0 12px">Zugänge</h2>
<div class="card">
	<form method="POST" action="?/generatePseudonyms" class="stack">
		<label class="field" style="max-width:200px">
			<span class="field__label">Wie viele Kinder</span>
			<input name="count" type="number" min="1" max="40" value="12" />
		</label>
		<button class="btn btn--quiet">Zugänge erzeugen</button>
	</form>
</div>

{#if data.pseudonyms.length}
	<ul class="liste" style="margin-top:16px">
		{#each data.pseudonyms as eintrag (eintrag.id)}
			<li>
				<span>
					<span class="mono" style="font-size:16px">{eintrag.value}</span>
					{#if eintrag.name}<span class="small" style="margin-left:10px">{eintrag.name}</span>{/if}
				</span>
				{#if eintrag.claimed && eintrag.userId}
					<form method="POST" action="?/resetPassword" class="row" style="gap:8px">
						<input type="hidden" name="userId" value={eintrag.userId} />
						<label class="field" style="padding:6px 10px 7px">
							<input name="newPassword" placeholder="neues Passwort" style="font-size:15px" />
						</label>
						<button class="btn btn--quiet">Zurücksetzen</button>
					</form>
				{:else}
					<span class="small">frei</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<h2 style="margin:32px 0 12px">Diese Klasse</h2>
<form method="POST" action="?/speichereKlasse" class="card stack">
	<label class="field">
		<span class="field__label">Name</span>
		<input name="name" value={data.cls.name} required />
	</label>
	<div class="zweispaltig">
		<label class="field">
			<span class="field__label">Klasse</span>
			<input name="grade" value={data.cls.grade} placeholder="z. B. 9b" />
		</label>
		<label class="field">
			<span class="field__label">Fach</span>
			<input name="subject" value={data.cls.subject} placeholder="z. B. Geschichte" required />
		</label>
	</div>
	<button class="btn btn--quiet">Speichern</button>
</form>

<style>
	.stapel {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.kindzeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		color: inherit;
		text-decoration: none;
	}
	.kindzeile:hover {
		border-color: var(--line-2);
	}
	.kindzeile__name {
		flex: 1;
		min-width: 10rem;
		font-family: var(--display);
		font-weight: 600;
		font-size: 16px;
	}
	.verteilung {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.grenzen {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}
	.grenzen .field {
		max-width: 11rem;
	}
	.zweispaltig {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.zweispaltig .field {
		flex: 1;
		min-width: 10rem;
	}
</style>
