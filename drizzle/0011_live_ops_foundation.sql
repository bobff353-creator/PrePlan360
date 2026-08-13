ALTER TABLE `platform_foundation_settings` ADD `live_board_title` text DEFAULT 'Live Operations Board' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_order_json` text DEFAULT '["summary","station","apparatus"]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_hidden_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_widths_json` text DEFAULT '{"summary":"full","station":"half","apparatus":"half"}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_panels_json` text DEFAULT '["equipment","duty","closecalls","training"]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_forecast_detail` text DEFAULT '3' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_weather_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_alerts_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_radar_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_radar_refresh_minutes` integer DEFAULT 10 NOT NULL;
--> statement-breakpoint
ALTER TABLE `platform_foundation_settings` ADD `live_board_external_links_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_title` text DEFAULT 'Live Operations Board' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_order_json` text DEFAULT '["summary","station","apparatus"]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_hidden_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_widths_json` text DEFAULT '{"summary":"full","station":"half","apparatus":"half"}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_panels_json` text DEFAULT '["equipment","duty","closecalls","training"]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_forecast_detail` text DEFAULT '3' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_weather_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_alerts_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_radar_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_radar_refresh_minutes` integer DEFAULT 10 NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_foundation_settings` ADD `live_board_external_links_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
UPDATE `platform_foundation_settings` SET `response_duration_seconds` = 45 WHERE `id` = 'master' AND `response_duration_seconds` = 12;
