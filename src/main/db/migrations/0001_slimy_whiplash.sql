CREATE TABLE `category_rules` (
	`category_id` text PRIMARY KEY NOT NULL,
	`template` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP INDEX `categories_name_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_parent_name` ON `categories` (`parent_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_root_name` ON `categories` (`name`) WHERE parent_id is null;