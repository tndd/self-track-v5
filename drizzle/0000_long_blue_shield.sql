CREATE TABLE `entries` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`recorded_at` text NOT NULL,
	`score` integer,
	`pain` integer,
	`note` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_entries_user_date` ON `entries` (`user_id`,`date`);