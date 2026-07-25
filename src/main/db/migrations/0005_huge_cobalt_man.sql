CREATE TABLE `drawings` (
	`id` text PRIMARY KEY NOT NULL,
	`strokes` text DEFAULT '' NOT NULL,
	`background_media_id` text,
	`aspect_ratio` real DEFAULT 1.5 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`background_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
