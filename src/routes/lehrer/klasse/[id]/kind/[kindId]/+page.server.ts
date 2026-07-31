// Ein Kind im Einzelnen. Eigene Seite statt aufklappen: die Lehrkraft geht zu einem Kind
// und wieder zurück — mit dem Zurück-Pfeil, wie überall sonst.

import { ownedClass } from '$lib/server/lehrer';
import { skalaLesen, KATEGORIEN } from '$lib/kategorie';
import { kindBild } from '$lib/server/fortschritt';
import { SICHERHEIT } from '$lib/server/runde';
import { RUECKSCHAU } from '$lib/server/uebung';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const cls = await ownedClass(locals, params.id);
	const skala = skalaLesen(cls.masteryScale);
	const kind = await kindBild(cls.id, params.kindId, skala);
	if (!kind) throw error(404, 'Nicht gefunden');

	return {
		zurueck: { href: `/lehrer/klasse/${cls.id}`, text: cls.name },
		cls,
		kind,
		kategorien: KATEGORIEN,
		sicherheiten: SICHERHEIT,
		rueckschauen: RUECKSCHAU
	};
};
