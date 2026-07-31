DROP INDEX `students_user_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `students_user_class` ON `students` (`user_id`,`class_id`);--> statement-breakpoint
ALTER TABLE `classes` ADD `grade` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` ADD `subject` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `first_name` text;--> statement-breakpoint
--> Das Fach zieht vom Lernziel an die Klasse: eine Klasse IST ab jetzt ein Fach.
UPDATE `classes` SET `subject` = COALESCE((
	SELECT `subject` FROM `learning_goals`
	WHERE `class_id` = `classes`.`id` AND `subject` IS NOT NULL
	ORDER BY COALESCE(`updated_at`, `created_at`) DESC LIMIT 1
), '');--> statement-breakpoint
--> Ein Lernziel je Klasse: das zuletzt fortgeschriebene bleibt, die übrigen fallen weg.
DELETE FROM `learning_goals` WHERE `rowid` NOT IN (
	SELECT MAX(`rowid`) FROM `learning_goals` GROUP BY `class_id`
);--> statement-breakpoint
CREATE UNIQUE INDEX `learning_goals_class_id_unique` ON `learning_goals` (`class_id`);--> statement-breakpoint
ALTER TABLE `learning_goals` DROP COLUMN `title`;--> statement-breakpoint
ALTER TABLE `learning_goals` DROP COLUMN `subject`;
