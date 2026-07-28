CREATE TABLE `pseudonyms` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`value` text NOT NULL,
	`claimed` integer DEFAULT false NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pseudonyms_value_unique` ON `pseudonyms` (`value`);