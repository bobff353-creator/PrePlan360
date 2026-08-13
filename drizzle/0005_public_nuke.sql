CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`department_id` text,
	`summary` text NOT NULL,
	`normalized_json` text NOT NULL,
	`raw_payload` text NOT NULL,
	`received_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_webhook_events_source_external` ON `webhook_events` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_webhook_events_status_received` ON `webhook_events` (`status`,`received_at`);
--> statement-breakpoint
PRAGMA optimize;
