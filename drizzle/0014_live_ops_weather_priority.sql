ALTER TABLE platform_foundation_settings ADD COLUMN IF NOT EXISTS live_board_radar_display_seconds integer NOT NULL DEFAULT 30;
--> statement-breakpoint
ALTER TABLE platform_foundation_settings ADD COLUMN IF NOT EXISTS live_board_severe_radar_seconds integer NOT NULL DEFAULT 90;
--> statement-breakpoint
ALTER TABLE platform_foundation_settings ADD COLUMN IF NOT EXISTS live_board_show_next_shift integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE department_foundation_settings ADD COLUMN IF NOT EXISTS live_board_radar_display_seconds integer NOT NULL DEFAULT 30;
--> statement-breakpoint
ALTER TABLE department_foundation_settings ADD COLUMN IF NOT EXISTS live_board_severe_radar_seconds integer NOT NULL DEFAULT 90;
--> statement-breakpoint
ALTER TABLE department_foundation_settings ADD COLUMN IF NOT EXISTS live_board_show_next_shift integer NOT NULL DEFAULT 1;
--> statement-breakpoint
UPDATE platform_foundation_settings SET board_rotation_seconds = 12 WHERE board_rotation_seconds = 8;
--> statement-breakpoint
UPDATE platform_foundation_settings SET live_board_radar_refresh_minutes = 5 WHERE live_board_radar_refresh_minutes = 10;
--> statement-breakpoint
UPDATE department_foundation_settings SET board_rotation_seconds = 12 WHERE board_rotation_seconds = 8;
--> statement-breakpoint
UPDATE department_foundation_settings SET live_board_radar_refresh_minutes = 5 WHERE live_board_radar_refresh_minutes = 10;
