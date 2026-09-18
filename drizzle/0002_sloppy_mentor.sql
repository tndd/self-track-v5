CREATE TABLE `tag_catalogs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `entries` ADD `quantities` text DEFAULT '{}' NOT NULL;