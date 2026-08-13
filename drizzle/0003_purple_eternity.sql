CREATE TABLE `asset_maintenance` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`task` text NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`interval_months` integer,
	`last_completed` text,
	`next_due` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_asset_maintenance_asset_status` ON `asset_maintenance` (`department_id`,`asset_id`,`status`);--> statement-breakpoint
CREATE TABLE `asset_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`source` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_asset_resources_asset` ON `asset_resources` (`department_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `department_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`asset_type` text NOT NULL,
	`name` text NOT NULL,
	`unit_number` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`model_year` integer,
	`vin` text,
	`barcode` text,
	`serial_number` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'in_service' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`odometer` integer,
	`engine_hours` integer,
	`manual_url` text DEFAULT '' NOT NULL,
	`parts_url` text DEFAULT '' NOT NULL,
	`maintenance_notes` text DEFAULT '' NOT NULL,
	`vin_source` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_department_assets_department_type` ON `department_assets` (`department_id`,`asset_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_department_assets_vin` ON `department_assets` (`department_id`,`vin`) WHERE "department_assets"."vin" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_department_assets_barcode` ON `department_assets` (`department_id`,`barcode`) WHERE "department_assets"."barcode" IS NOT NULL;