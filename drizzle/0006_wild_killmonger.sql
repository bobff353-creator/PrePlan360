CREATE TABLE `department_hydrants` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`hydrant_number` text NOT NULL,
	`location` text NOT NULL,
	`latitude` text DEFAULT '' NOT NULL,
	`longitude` text DEFAULT '' NOT NULL,
	`flow_gpm` integer,
	`operational_notes` text DEFAULT '' NOT NULL,
	`internal_notes` text DEFAULT '' NOT NULL,
	`last_inspected` text,
	`status` text DEFAULT 'in_service' NOT NULL,
	`visibility` text DEFAULT 'department_only' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_department_hydrants_number` ON `department_hydrants` (`department_id`,`hydrant_number`);--> statement-breakpoint
CREATE INDEX `idx_department_hydrants_visibility_department` ON `department_hydrants` (`visibility`,`department_id`);--> statement-breakpoint
CREATE TABLE `department_preplans` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`property_name` text NOT NULL,
	`address` text NOT NULL,
	`operational_summary` text DEFAULT '' NOT NULL,
	`internal_notes` text DEFAULT '' NOT NULL,
	`last_reviewed` text,
	`status` text DEFAULT 'active' NOT NULL,
	`visibility` text DEFAULT 'department_only' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_department_preplans_department_status` ON `department_preplans` (`department_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_department_preplans_visibility_department` ON `department_preplans` (`visibility`,`department_id`);
--> statement-breakpoint
PRAGMA optimize;
