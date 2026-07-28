<div class="seite">
	<h1 style="margin:0 0 6px">lernassi</h1>
	<p class="muted" style="margin:0 0 26px;font-size:17px">
		Dein Heft, geordnet – und du entscheidest, woran du arbeitest.
	</p>

	<div class="karten">
		<div class="card">
			<h3 style="margin:0 0 6px">Für Schüler:innen</h3>
			<p class="small" style="margin:0 0 16px">
				Mit Klassencode und Pseudonym von deiner Lehrkraft.
			</p>
			<a href="/schueler/anmelden" class="btn btn--block">Anmelden</a>
			<a href="/schueler/registrieren" class="btn btn--plain" style="margin-top:8px">
				Zum ersten Mal hier
			</a>
		</div>

		<div class="card">
			<h3 style="margin:0 0 6px">Für Lehrkräfte</h3>
			<p class="small" style="margin:0 0 16px">Klassen und Lernziele anlegen, Pseudonyme vergeben.</p>
			<a href="/lehrer/anmelden" class="btn btn--quiet btn--block">Anmelden</a>
			<a href="/lehrer/registrieren" class="btn btn--plain" style="margin-top:8px">Konto anlegen</a>
		</div>
	</div>
</div>

<style>
	.karten {
		display: grid;
		gap: 14px;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}
	@media (min-width: 700px) {
		.karten {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
