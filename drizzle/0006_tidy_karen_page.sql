CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`rolle` text NOT NULL,
	`art` text NOT NULL,
	`text` text,
	`question_id` text,
	`bezug` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `questions` ADD `pruefung` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `bezug` text;--> statement-breakpoint
ALTER TABLE `rounds` ADD `modus` text DEFAULT 'klassisch' NOT NULL;