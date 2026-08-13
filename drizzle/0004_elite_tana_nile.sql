CREATE TABLE `asset_events` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`event_type` text NOT NULL,
	`detail` text NOT NULL,
	`odometer` integer,
	`engine_hours` integer,
	`actor_user_id` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_asset_events_asset_time` ON `asset_events` (`department_id`,`asset_id`,`occurred_at`);
--> statement-breakpoint
INSERT INTO `asset_events` (`id`,`department_id`,`asset_id`,`event_type`,`detail`,`odometer`,`engine_hours`,`actor_user_id`,`occurred_at`)
SELECT 'event_imported_' || `id`,`department_id`,`id`,'record_initialized','Permanent record history initialized for existing asset.',`odometer`,`engine_hours`,`created_by`,`created_at`
FROM `department_assets`;
--> statement-breakpoint
PRAGMA optimize;
