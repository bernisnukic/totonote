CREATE TABLE `tag_set_members` (
	`tag_set_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`tag_set_id`, `tag_id`),
	FOREIGN KEY (`tag_set_id`) REFERENCES `tag_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tag_set_members_tag` ON `tag_set_members` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tag_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tag_sets_workspace` ON `tag_sets` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tag_sets_name` ON `tag_sets` (`workspace_id`,`name`);