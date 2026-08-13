CREATE TABLE `access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`department_name` text NOT NULL,
	`requested_role` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`department_id` text,
	`reviewed_by` text,
	`created_at` text NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_access_requests_status` ON `access_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`department_id` text,
	`event_type` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_department_created` ON `audit_events` (`department_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `department_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`department_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_user_department` ON `department_memberships` (`user_id`,`department_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_department` ON `department_memberships` (`department_id`,`status`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text NOT NULL,
	`station_count` integer DEFAULT 1 NOT NULL,
	`vehicle_count` integer DEFAULT 0 NOT NULL,
	`weather_location` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_departments_slug` ON `departments` (`slug`);--> statement-breakpoint
CREATE TABLE `platform_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`platform_role` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_platform_users_email` ON `platform_users` (`email`);--> statement-breakpoint
CREATE TABLE `support_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`department_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_support_sessions_owner_status` ON `support_sessions` (`owner_user_id`,`status`);