CREATE TABLE `catalog_services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`default_price` real DEFAULT 0 NOT NULL,
	`category` text,
	`archived_at` text
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`telegram` text,
	`viber` text,
	`note` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_clients_phone` ON `clients` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_clients_name` ON `clients` (`name`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`brand` text,
	`model` text,
	`imei` text,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_devices_client` ON `devices` (`client_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`kind` text NOT NULL,
	`number` text NOT NULL,
	`note` text,
	`snapshot` text,
	`pdf_path` text,
	`issued_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_documents_order` ON `documents` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_kind` ON `documents` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_documents_number` ON `documents` (`number`);--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'variable' NOT NULL,
	`budget_monthly` real DEFAULT 0 NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_code` text,
	`order_id` integer,
	`client_id` integer,
	`channel` text NOT NULL,
	`target` text,
	`text` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_notify_created` ON `notification_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `notification_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`channel` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`type` text NOT NULL,
	`message` text,
	`payload` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_order` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_events_created` ON `order_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `order_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`path` text NOT NULL,
	`caption` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_photos_order` ON `order_photos` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`title` text NOT NULL,
	`due_at` text,
	`done` integer DEFAULT false NOT NULL,
	`done_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_order` ON `order_tasks` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_done` ON `order_tasks` (`done`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`client_id` integer,
	`client_name` text,
	`client_phone` text,
	`device_label` text,
	`fault` text,
	`appearance` text,
	`accessories` text,
	`work_description` text,
	`status` text DEFAULT 'new' NOT NULL,
	`client_total` real DEFAULT 0 NOT NULL,
	`cost_total` real DEFAULT 0 NOT NULL,
	`accepted_at` text DEFAULT (datetime('now')) NOT NULL,
	`promised_at` text,
	`ready_at` text,
	`issued_at` text,
	`warranty_months` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_number` ON `orders` (`number`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_client` ON `orders` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_issued` ON `orders` (`issued_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_accepted` ON `orders` (`accepted_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer,
	`direction` text NOT NULL,
	`amount` real NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`category` text,
	`occurred_on` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_payments_order` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_date` ON `payments` (`occurred_on`);--> statement-breakpoint
CREATE INDEX `idx_payments_direction` ON `payments` (`direction`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
