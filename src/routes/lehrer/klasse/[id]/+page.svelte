<script lang="ts">
	let { data, form } = $props();
</script>

<p><a href="/lehrer">← Meine Klassen</a></p>
<h1>{data.cls.name}</h1>
<p>Klassencode: <span class="pill code">{data.cls.joinCode}</span> <span class="muted">— an die Kinder austeilen</span></p>

{#if form?.message}<div class="msg error">{form.message}</div>{/if}
{#if form?.ok}<div class="msg ok">{form.ok}</div>{/if}

<h2>Lernziel anlegen</h2>
<div class="card">
	<form method="POST" action="?/createGoal">
		<label for="title">Titel</label>
		<input id="title" name="title" required placeholder="z. B. Ursachen des 1. Weltkriegs erklären" />
		<label for="description">Beschreibung (optional)</label>
		<textarea id="description" name="description" rows="2"></textarea>
		<label for="contextPrompt">Kontext für die Schüler-KI (optional, wird ab M2 genutzt)</label>
		<input id="contextPrompt" name="contextPrompt" />
		<label for="subject">Fach (optional)</label>
		<input id="subject" name="subject" />
		<button>Lernziel anlegen</button>
	</form>
</div>

{#if data.goals.length}
	<ul class="clean">
		{#each data.goals as g (g.id)}
			<li><span>{g.title}</span>{#if g.subject}<span class="pill">{g.subject}</span>{/if}</li>
		{/each}
	</ul>
{/if}

<h2>Pseudonyme</h2>
<div class="card">
	<form method="POST" action="?/generatePseudonyms" class="row">
		<div>
			<label for="count">Anzahl (1–40)</label>
			<input id="count" name="count" type="number" min="1" max="40" value="12" style="width:8rem" />
		</div>
		<button class="secondary">Pseudonyme erzeugen</button>
	</form>
	<p class="muted">
		Teile jedem Kind ein Pseudonym zu — auf deiner <strong>eigenen</strong> Namensliste (bleibt außerhalb des Systems).
		Das Kind registriert sich mit Klassencode + Pseudonym + eigenem Passwort.
	</p>
</div>

{#if data.pseudonyms.length}
	<table>
		<thead><tr><th>Pseudonym</th><th>Status</th><th>Passwort zurücksetzen</th></tr></thead>
		<tbody>
			{#each data.pseudonyms as p (p.id)}
				<tr>
					<td class="code">{p.value}</td>
					<td>{#if p.claimed}<span class="pill">vergeben</span>{:else}<span class="muted">frei</span>{/if}</td>
					<td>
						{#if p.claimed && p.userId}
							<form method="POST" action="?/resetPassword" class="row">
								<input type="hidden" name="userId" value={p.userId} />
								<input name="newPassword" type="text" placeholder="neues Passwort" style="width:11rem" />
								<button class="secondary">Reset</button>
							</form>
						{:else}<span class="muted">—</span>{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
