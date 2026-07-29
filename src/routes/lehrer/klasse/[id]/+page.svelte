<script lang="ts">
	let { data, form } = $props();
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
