CREATE TABLE `daily_summaries` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`score` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `date`)
);
--> statement-breakpoint
CREATE INDEX `idx_entries_user_time_id` ON `entries` (`user_id`,`recorded_at`,`id`);