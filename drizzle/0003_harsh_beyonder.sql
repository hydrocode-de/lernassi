CREATE TABLE `round_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`erreicht` integer NOT NULL,
	`moeglich` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `toc_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`kind` text DEFAULT 'einordnung' NOT NULL,
	`chapter_id` text,
	`plan_item_id` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text DEFAULT 'laufend' NOT NULL,
	`confidence_before` integer,
	`mirror_reaction` text,
	`self_after` text,
	`erreicht` integer,
	`moeglich` integer,
	`wert` integer,
	`since_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `toc_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_item_id`) REFERENCES `plan_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_rounds`("id", "student_id", "kind", "chapter_id", "plan_item_id", "started_at", "finished_at", "status", "confidence_before", "mirror_reaction", "self_after", "erreicht", "moeglich", "wert", "since_at") SELECT "id", "student_id", 'einordnung', "chapter_id", NULL, "started_at", "finished_at", "status", "confidence_before", "mirror_reaction", NULL, NULL, NULL, NULL, "since_at" FROM `rounds`;--> statement-breakpoint
DROP TABLE `rounds`;--> statement-breakpoint
ALTER TABLE `__new_rounds` RENAME TO `rounds`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `classes` ADD `mastery_scale` text;--> statement-breakpoint
ALTER TABLE `plan_items` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `punkte` integer DEFAULT 1 NOT NULL;