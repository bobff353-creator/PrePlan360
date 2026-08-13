CREATE TABLE `department_module_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`module_key` text NOT NULL,
	`heading` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_department_module_configs_key` ON `department_module_configs` (`department_id`,`module_key`);
--> statement-breakpoint
CREATE TABLE `department_module_items` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`module_key` text NOT NULL,
	`item_type` text DEFAULT 'notice' NOT NULL,
	`title` text NOT NULL,
	`operational_status` text DEFAULT 'ready' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`link_url` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`record_status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_department_module_items_list` ON `department_module_items` (`department_id`,`module_key`,`record_status`,`sort_order`);
