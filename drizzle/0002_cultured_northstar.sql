CREATE TABLE `chapter_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`text` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `toc_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_assessments_chapter_id_unique` ON `chapter_assessments` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`chapter_id` text,
	`auftrag` text NOT NULL,
	`minutes` integer,
	`due_at` integer,
	`status` text DEFAULT 'offen' NOT NULL,
	`created_in_round_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `toc_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `toc_entries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_in_round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`wave` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text,
	`correct_answer` text,
	`hint` text,
	`topic_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `toc_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`given` text,
	`outcome` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text DEFAULT 'laufend' NOT NULL,
	`confidence_before` integer,
	`mirror_reaction` text,
	`since_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `toc_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `learning_goals` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `notes` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `toc_entries` ADD `last_assessed_at` integer;