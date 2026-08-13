CREATE TABLE `platform_foundation_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`module_order_json` text DEFAULT '[]' NOT NULL,
	`hidden_modules_json` text DEFAULT '[]' NOT NULL,
	`board_rotation_seconds` integer DEFAULT 8 NOT NULL,
	`response_duration_seconds` integer DEFAULT 12 NOT NULL,
	`shift_hours_on` integer DEFAULT 24 NOT NULL,
	`shift_hours_off` integer DEFAULT 48 NOT NULL,
	`shift_start_time` text DEFAULT '07:00' NOT NULL,
	`overtime_period_days` integer DEFAULT 14 NOT NULL,
	`overtime_threshold_hours` integer DEFAULT 212 NOT NULL,
	`overtime_assignment_rule` text DEFAULT 'Department-defined rotation' NOT NULL,
	`scheduling_notes` text DEFAULT '' NOT NULL,
	`overtime_notes` text DEFAULT '' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `department_foundation_settings` (
	`department_id` text PRIMARY KEY NOT NULL,
	`module_order_json` text DEFAULT '[]' NOT NULL,
	`hidden_modules_json` text DEFAULT '[]' NOT NULL,
	`board_rotation_seconds` integer DEFAULT 8 NOT NULL,
	`response_duration_seconds` integer DEFAULT 12 NOT NULL,
	`shift_hours_on` integer DEFAULT 24 NOT NULL,
	`shift_hours_off` integer DEFAULT 48 NOT NULL,
	`shift_start_time` text DEFAULT '07:00' NOT NULL,
	`overtime_period_days` integer DEFAULT 14 NOT NULL,
	`overtime_threshold_hours` integer DEFAULT 212 NOT NULL,
	`overtime_assignment_rule` text DEFAULT 'Department-defined rotation' NOT NULL,
	`scheduling_notes` text DEFAULT '' NOT NULL,
	`overtime_notes` text DEFAULT '' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
