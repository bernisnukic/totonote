CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`byte_size` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
