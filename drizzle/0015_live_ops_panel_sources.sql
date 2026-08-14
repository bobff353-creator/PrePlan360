ALTER TABLE platform_foundation_settings ADD COLUMN IF NOT EXISTS live_board_equipment_url text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE platform_foundation_settings ADD COLUMN IF NOT EXISTS live_board_closecalls_url text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE platform_foundation_settings ADD COLUMN IF NOT EXISTS live_board_lodd_url text NOT NULL DEFAULT 'https://apps.usfa.fema.gov/firefighter-fatalities';
--> statement-breakpoint
ALTER TABLE platform_foundation_settings ADD COLUMN IF NOT EXISTS live_board_training_url text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE platform_foundation_settings ADD COLUMN IF NOT EXISTS live_board_source_refresh_minutes integer NOT NULL DEFAULT 5;
--> statement-breakpoint
ALTER TABLE department_foundation_settings ADD COLUMN IF NOT EXISTS live_board_equipment_url text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE department_foundation_settings ADD COLUMN IF NOT EXISTS live_board_closecalls_url text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE department_foundation_settings ADD COLUMN IF NOT EXISTS live_board_lodd_url text NOT NULL DEFAULT 'https://apps.usfa.fema.gov/firefighter-fatalities';
--> statement-breakpoint
ALTER TABLE department_foundation_settings ADD COLUMN IF NOT EXISTS live_board_training_url text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE department_foundation_settings ADD COLUMN IF NOT EXISTS live_board_source_refresh_minutes integer NOT NULL DEFAULT 5;
