CREATE TABLE `note_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`lizenz` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Bestehende Foto-Aufschriebe bekommen ihre Quelle nachgetragen: die Heftseiten, aus denen
-- sie gelesen wurden. Selbst getippte bleiben leer — was dort steht, weiß nur das Kind, und
-- es wird ab jetzt beim Schreiben gefragt.
INSERT INTO `note_sources` (`id`, `note_id`, `name`, `url`, `lizenz`, `sort_order`, `created_at`)
SELECT lower(hex(randomblob(16))), `n`.`id`,
	CASE
		WHEN `n`.`page_numbers` IS NULL OR `n`.`page_numbers` = '' THEN 'Deine Heftseiten'
		ELSE 'Deine Heftseiten, Seite ' || `n`.`page_numbers`
	END,
	NULL, NULL, 0, `n`.`created_at`
FROM `notes` `n` WHERE `n`.`herkunft` = 'foto';
