ALTER TABLE `toc_entries` ADD `class_id` text REFERENCES classes(id);--> statement-breakpoint
-- Altdaten zuordnen: bisher hing das Fach im Heft nur über seinen Namen an der Klasse.
-- Was sich so nicht auflösen lässt (Tippfehler, aufgelöste Klassen), bleibt ohne Klasse
-- stehen — die Aufschriebe des Kindes gehen dabei nicht verloren.
UPDATE `toc_entries` SET `class_id` = (
	SELECT `c`.`id` FROM `classes` `c`
	JOIN `students` `s` ON `s`.`class_id` = `c`.`id`
	WHERE `s`.`user_id` = `toc_entries`.`student_id`
	  AND lower(`c`.`subject`) = lower(`toc_entries`.`title`)
	LIMIT 1
) WHERE `kind` = 'subject';
