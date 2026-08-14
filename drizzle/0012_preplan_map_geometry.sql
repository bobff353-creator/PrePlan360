ALTER TABLE `department_preplans` ADD `latitude` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_preplans` ADD `longitude` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `department_preplans` ADD `footprint_json` text DEFAULT '[]' NOT NULL;
