ALTER TABLE `departments` ADD `app_title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `departments` ADD `welcome_message` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `departments` ADD `brand_primary` text DEFAULT '#7f1d1d' NOT NULL;--> statement-breakpoint
ALTER TABLE `departments` ADD `brand_secondary` text DEFAULT '#090d12' NOT NULL;--> statement-breakpoint
ALTER TABLE `departments` ADD `brand_accent` text DEFAULT '#d4a017' NOT NULL;--> statement-breakpoint
ALTER TABLE `departments` ADD `brand_action` text DEFAULT '#2563a6' NOT NULL;--> statement-breakpoint
ALTER TABLE `departments` ADD `brand_alert` text DEFAULT '#d85a1f' NOT NULL;--> statement-breakpoint
ALTER TABLE `departments` ADD `logo_key` text;--> statement-breakpoint
ALTER TABLE `departments` ADD `logo_content_type` text;