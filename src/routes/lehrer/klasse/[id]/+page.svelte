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

<h2 style="margin:28px 0 12px">Lernziele</h2>
<div class="card">
	<form method="POST" action="?/createGoal" class="stack">
		<label class="field">
			<span class="field__label">Lernziel</span>
			<input name="title" required placeholder="z. B. Ursachen des 1. Weltkriegs erklären" />
		</label>
		<label class="field">
			<span class="field__label">Beschreibung</span>
			<textarea name="description" rows="2"></textarea>
		</label>
		<label class="field">
			<span class="field__label">Fach</span>
			<input name="subject" placeholder="z. B. Geschichte" />
		</label>
		<label class="field">
			<span class="field__label">Worauf soll lernassi achten</span>
			<input name="contextPrompt" placeholder="z. B. Fachbegriffe konsequent einfordern" />
		</label>
		<button class="btn">Lernziel anlegen</button>
	</form>
</div>

{#if data.goals.length}
	<ul class="liste" style="margin-top:16px">
		{#each data.goals as ziel (ziel.id)}
			<li>
				<div>
					<div style="font-size:17px">{ziel.title}</div>
					{#if ziel.description}<div class="small">{ziel.description}</div>{/if}
				</div>
				{#if ziel.subject}<span class="tag">{ziel.subject}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}

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
