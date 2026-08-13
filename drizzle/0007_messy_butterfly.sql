CREATE TABLE `owner_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`iterations` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_owner_credentials_email` ON `owner_credentials` (`email`);--> statement-breakpoint
CREATE TABLE `owner_login_state` (
	`email` text PRIMARY KEY NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `owner_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_owner_sessions_user_expires` ON `owner_sessions` (`user_id`,`expires_at`);