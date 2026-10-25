ALTER TABLE `orders` ADD `prepayment` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `prepayment_at` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `cost` real DEFAULT 0 NOT NULL;