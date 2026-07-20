ALTER TABLE `annotations` ADD `category_id` text REFERENCES categories(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `annotations` ADD `placement_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_annotations_category` ON `annotations` (`category_id`);