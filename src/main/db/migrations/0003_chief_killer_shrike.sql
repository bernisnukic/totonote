/*
 Hand-written, replacing drizzle-kit's generated version.

 Drizzle-kit emitted `ALTER TABLE categories ADD workspace_id text NOT NULL
 REFERENCES workspaces(id)`, which SQLite rejects outright — "Cannot add a NOT NULL
 column with default value NULL" — so that migration could never have applied to any
 database, empty or not.

 Instead: create the workspaces table, seed one, and rebuild `categories` and
 `documents` with the new column backfilled to it. Existing worlds keep everything;
 they just find it all inside a workspace called "My World".

 The rebuilds drop and recreate tables that other tables reference, which is safe only
 because connection.ts turns foreign keys off around migrate().
*/
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `workspaces` (`id`, `name`, `sort_order`) VALUES ('ws-default', 'My World', 1);
--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `__new_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_categories` (`id`, `workspace_id`, `name`, `sort_order`, `parent_id`)
	SELECT `id`, 'ws-default', `name`, `sort_order`, `parent_id` FROM `categories`;
--> statement-breakpoint
DROP TABLE `categories`;
--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_parent_name` ON `categories` (`parent_id`,`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_root_name` ON `categories` (`workspace_id`,`name`) WHERE parent_id is null;
--> statement-breakpoint
CREATE INDEX `idx_categories_workspace` ON `categories` (`workspace_id`);
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`section_label` text DEFAULT 'Section' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_documents` (`id`, `workspace_id`, `title`, `description`, `section_label`, `created_at`, `updated_at`)
	SELECT `id`, 'ws-default', `title`, `description`, `section_label`, `created_at`, `updated_at` FROM `documents`;
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;
--> statement-breakpoint
CREATE INDEX `idx_documents_workspace` ON `documents` (`workspace_id`);
