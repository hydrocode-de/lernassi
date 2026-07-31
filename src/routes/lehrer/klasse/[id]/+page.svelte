<script lang="ts">
	import type { Kategorie } from '$lib/kategorie';
	import { vorZeit } from '$lib/heft';

	let { data, form } = $props();

	const KATEGORIEN: Kategorie[] = [1, 2, 3, 4];
	const fortgeschrieben = $derived(
		data.ziel?.updatedAt ? new Date(data.ziel.updatedAt).toLocaleDateString('de-DE') : null
	);

	// Über die ganze Klasse zusammengezählt — nicht dieselben Themen, aber dieselbe Skala.
	const gesamtVerteilung = $derived(
		data.kinder.reduce(
			(summe, k) => summe.map((v, i) => v + k.verteilung[i]) as typeof summe,
			[0, 0, 0, 0]
		)
	);
	const gesamtThemen = $derived(gesamtVerteilung.reduce((a, b) => a + b, 0));

	// „Aktiv" heißt: eine abgeschlossene Runde, keine Übungssitzung nur begonnen und kein Login.
	const SIEBEN_TAGE = 7 * 86_400_000;
	const istAktiv = (zuletztAktiv: number | null) =>
		zuletztAktiv !== null && Date.now() - zuletztAktiv < SIEBEN_TAGE;
	const aktiveAnzahl = $derived(data.kinder.filter((k) => istAktiv(k.zuletztAktiv)).length);
	const inaktiveKinder = $derived(data.kinder.filter((k) => !istAktiv(k.zuletztAktiv)));
	const aktivLabel = (zuletztAktiv: number | null) =>
		zuletztAktiv === null ? 'noch nie aktiv' : vorZeit(zuletztAktiv);
</script>

<h1 style="margin:0 0 6px">{data.cls.name}</h1>
<p class="muted" style="margin:0 0 26px">
	Klassencode <span class="tag mono">{data.cls.joinCode}</span>
</p>

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}
{#if form?.ok}<div class="meldung meldung--ok">{form.ok}</div>{/if}
{#if form?.warnung}<div class="meldung meldung--fehler">{form.warnung}</div>{/if}

{#if data.kinder.length}
	<div class="card" style="margin-bottom:16px">
		<div class="row" style="margin-bottom:4px">
			<h2 style="margin:0">Klassenbild</h2>
			<span class="small">{gesamtThemen} {gesamtThemen === 1 ? 'Thema' : 'Themen'}</span>
		</div>
		<p class="small" style="margin:0 0 14px">
			Über alle {data.kinder.length} Kinder zusammengezählt — nicht dieselben Themen, aber
			dieselbe Skala.
		</p>

		{#if gesamtThemen}
			<div class="balken">
				{#each KATEGORIEN as k (k)}
					{@const anzahl = gesamtVerteilung[k - 1]}
					{#if anzahl}
						<div
							class="balken__teil balken__teil--{data.kategorien[k].farbe}"
							style="width:{(anzahl / gesamtThemen) * 100}%"
						>
							{anzahl}
						</div>
					{/if}
				{/each}
			</div>
			<div class="legende-zeile">
				{#each KATEGORIEN as k (k)}
					{@const anzahl = gesamtVerteilung[k - 1]}
					{#if anzahl}
						<span
							><span class="punkt punkt--{data.kategorien[k].farbe}"></span>{data.kategorien[k]
								.wort} · {anzahl}</span
						>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="small" style="margin:0">Noch niemand hat geübt.</p>
		{/if}

		<hr class="trennlinie" />

		<p class="aktiv-zahl">
			{aktiveAnzahl} / {data.kinder.length} <span class="small">diese Woche aktiv</span>
		</p>
		{#if inaktiveKinder.length}
			<div class="inaktive-liste">
				{#each inaktiveKinder as kind (kind.id)}
					<span class="inaktive-chip"
						><strong>{kind.name}</strong> {aktivLabel(kind.zuletztAktiv)}</span
					>
				{/each}
			</div>
		{/if}
	</div>
{/if}

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
				<span class="kindzeile__links">
					<span class="kindzeile__name">{kind.name}</span>
					<span
						class="small kindzeile__aktiv"
						class:kindzeile__aktiv--lange={!istAktiv(kind.zuletztAktiv)}
					>
						zuletzt aktiv: {aktivLabel(kind.zuletztAktiv)}
					</span>
				</span>
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
	.kindzeile__links {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 10rem;
	}
	.kindzeile__name {
		font-family: var(--display);
		font-weight: 600;
		font-size: 16px;
	}
	.kindzeile__aktiv {
		display: block;
	}
	.kindzeile__aktiv--lange {
		color: var(--rose-ink);
	}
	.verteilung {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.balken {
		display: flex;
		height: 30px;
		border-radius: var(--r-sm);
		overflow: hidden;
		background: var(--paper-2);
	}
	.balken__teil {
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--display);
		font-weight: 700;
		font-size: 13px;
	}
	.balken__teil--mint {
		background: var(--mint);
		color: var(--mint-ink);
	}
	.balken__teil--sky {
		background: var(--sky);
		color: var(--sky-ink);
	}
	.balken__teil--apricot {
		background: var(--apricot);
		color: var(--apricot-ink);
	}
	.balken__teil--rose {
		background: var(--rose);
		color: var(--rose-ink);
	}
	.legende-zeile {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		margin-top: 10px;
		font-size: 13.5px;
		color: var(--ink-2);
	}
	.legende-zeile span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.punkt {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		display: inline-block;
	}
	.punkt--mint {
		background: var(--mint-ink);
	}
	.punkt--sky {
		background: var(--sky-ink);
	}
	.punkt--apricot {
		background: var(--apricot-ink);
	}
	.punkt--rose {
		background: var(--rose-ink);
	}
	.trennlinie {
		border: none;
		border-top: 1px solid var(--line);
		margin: 16px 0;
	}
	.aktiv-zahl {
		margin: 0;
		font-family: var(--display);
		font-weight: 700;
		font-size: 16px;
	}
	.inaktive-liste {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 10px;
	}
	.inaktive-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 11px;
		border-radius: var(--r-pill);
		border: 1px solid var(--rose-2);
		background: var(--rose);
		color: var(--rose-ink);
		font-size: 13.5px;
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
