<script lang="ts">
	import type { Kategorie } from '$lib/kategorie';
	import type { Rueckschau } from '$lib/server/uebung';

	let { data, form } = $props();

	const KATEGORIEN: Kategorie[] = [1, 2, 3, 4];
	const rueckschau = (wert: string) => data.rueckschauen[wert as Rueckschau] ?? '–';
</script>

<p style="margin:0 0 10px"><a href="/lehrer">← Meine Klassen</a></p>
<h1 style="margin:0 0 8px">{data.cls.name}</h1>
<p class="muted" style="margin:0 0 4px">
	Klassencode <span class="tag mono">{data.cls.joinCode}</span>
</p>
<p class="small" style="margin:6px 0 0">
	Code und Pseudonym an die Kinder austeilen. Wer zu welchem Pseudonym gehört, bleibt auf deiner
	eigenen Liste.
</p>

{#if form?.message}<div class="meldung meldung--fehler">{form.message}</div>{/if}
{#if form?.ok}<div class="meldung meldung--ok">{form.ok}</div>{/if}

<h2 style="margin:28px 0 6px">Wie es läuft</h2>
{#if !data.themen.length}
	<p class="small" style="margin:0 0 12px">Noch keine Ergebnisse.</p>
{:else}
	<p class="small" style="margin:0 0 12px">Je Thema, wie viele Kinder wo stehen.</p>
	<div class="stapel">
		{#each data.themen as t (t.topicId)}
			<div class="card themenzeile">
				<span class="themenzeile__titel">{t.titel}</span>
				<span class="verteilung">
					{#each KATEGORIEN as k (k)}
						{@const anzahl = t.verteilung[k - 1]}
						{#if anzahl}
							<span class="tag tag--{data.kategorien[k].farbe}">
								{anzahl}&nbsp;{data.kategorien[k].wort}
							</span>
						{/if}
					{/each}
				</span>
			</div>
		{/each}
	</div>
{/if}

{#if data.kinder.length}
	<h3 style="margin:22px 0 8px">Einzelne Kinder</h3>
	<div class="pseudonyme">
		{#each data.kinder as k (k.id)}
			<a class="btn btn--quiet klein" href="?kind={k.id}" class:an={data.kind?.pseudonym === k.pseudonym}>
				{k.pseudonym}
			</a>
		{/each}
	</div>
{/if}

{#if data.kind}
	<div class="card" style="margin-top:14px">
		<div class="row" style="margin-bottom:12px">
			<h3 style="margin:0">{data.kind.pseudonym}</h3>
			<a class="btn btn--plain klein" href="?">Zumachen</a>
		</div>
		<p class="small" style="margin:0 0 14px">
			{data.kind.plan.offen} offen · {data.kind.plan.erledigt} abgehakt
		</p>

		{#if data.kind.themen.length}
			<div class="chips" style="margin-bottom:16px">
				{#each data.kind.themen as t (t.topicId)}
					<span class="chip chip--{data.kategorien[t.kategorie].farbe}">
						<span class="chip__dot"></span>{t.titel} – {data.kategorien[t.kategorie].wort}
					</span>
				{/each}
			</div>
		{/if}

		{#if data.kind.uebungen.length}
			<p class="eyebrow" style="margin:0 0 8px">Selbsteinschätzung und Ergebnis</p>
			<table class="verlauf">
				<thead>
					<tr><th>Wann</th><th>Vorher</th><th>Hinterher</th><th>Ergebnis</th></tr>
				</thead>
				<tbody>
					{#each data.kind.uebungen as u (u.wann)}
						<tr>
							<td>{new Date(u.wann).toLocaleDateString('de-DE')}</td>
							<td>{u.vorher ? data.sicherheiten[u.vorher - 1] : '–'}</td>
							<td>{u.nachher ? rueckschau(u.nachher) : '–'}</td>
							<td>{u.kategorie ? data.kategorien[u.kategorie].wort : '–'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="small" style="margin:0">Noch keine Übung abgeschlossen.</p>
		{/if}
	</div>
{/if}

<h2 style="margin:32px 0 6px">Was „sitzt" heißen soll</h2>
<p class="small" style="margin:0 0 12px">
	Gilt für diese Klasse und wirkt rückwirkend auf alle Kinder.
</p>
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

<h2 style="margin:28px 0 6px">Lernziele</h2>
<p class="small" style="margin:0 0 12px">
	Ein aktuelles Lernziel pro Fach, so formuliert wie im Bildungsplan – gerne nach Fachwissen,
	Analyse, Urteils- und Methodenkompetenz gruppiert. Es steuert, welche Fragen lernassi aus dem
	Heft eines Kindes auswählt und wie tief sie gehen. Die Kinder sehen es nicht.
</p>

{#if form?.warnung}<div class="meldung meldung--fehler">{form.warnung}</div>{/if}

{#each data.goals.filter((z) => z.subject) as ziel (ziel.id)}
	<div class="card" style="margin-bottom:12px">
		<form method="POST" action="?/speichereZiel" class="stack">
			<input type="hidden" name="subject" value={ziel.subject} />
			<div class="row">
				<h3>{ziel.subject}</h3>
				<span class="small">
					{#if ziel.updatedAt}
						fortgeschrieben am {new Date(ziel.updatedAt).toLocaleDateString('de-DE')}
					{/if}
				</span>
			</div>
			<label class="field">
				<span class="field__label">Lernziel</span>
				<textarea name="text" rows="8" maxlength="8000">{ziel.description ?? ''}</textarea>
			</label>
			<button class="btn">Fortschreiben</button>
		</form>
	</div>
{/each}

<div class="card">
	<form method="POST" action="?/speichereZiel" class="stack">
		<label class="field" style="max-width:280px">
			<span class="field__label">Fach</span>
			<input name="subject" required placeholder="z. B. Geschichte" />
		</label>
		<label class="field">
			<span class="field__label">Lernziel</span>
			<textarea
				name="text"
				rows="6"
				maxlength="8000"
				placeholder={'Fachwissen: … \nAnalysekompetenz: … \nUrteilskompetenz: … \nMethodenkompetenz: …'}
			></textarea>
		</label>
		<p class="small" style="margin:0">
			Länger als {data.warnschwelle} Zeichen wird es unschärfer – die Anwendung sagt dann Bescheid,
			hält dich aber nicht auf.
		</p>
		<button class="btn">Lernziel anlegen</button>
	</form>
</div>

<h2 style="margin:32px 0 12px">Pseudonyme</h2>
<div class="card">
	<form method="POST" action="?/generatePseudonyms" class="stack">
		<label class="field" style="max-width:200px">
			<span class="field__label">Wie viele Kinder</span>
			<input name="count" type="number" min="1" max="40" value="12" />
		</label>
		<button class="btn btn--quiet">Pseudonyme erzeugen</button>
	</form>
</div>

{#if data.pseudonyms.length}
	<ul class="liste" style="margin-top:16px">
		{#each data.pseudonyms as eintrag (eintrag.id)}
			<li>
				<span class="mono" style="font-size:16px">{eintrag.value}</span>
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

<style>
	.stapel {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.themenzeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
	}
	.themenzeile__titel {
		flex: 1;
		min-width: 12rem;
		font-size: 16px;
		line-height: 1.4;
	}
	.verteilung {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pseudonyme {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.klein {
		min-height: 44px;
		font-size: 14px;
	}
	.pseudonyme .an {
		background: var(--lavender);
		color: var(--lavender-ink);
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
	.verlauf {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}
	.verlauf th,
	.verlauf td {
		text-align: left;
		padding: 7px 10px 7px 0;
		border-bottom: 1px solid var(--line);
	}
	.verlauf th {
		font-family: var(--display);
		font-weight: 600;
		font-size: 13px;
		color: var(--ink-3);
	}
</style>
