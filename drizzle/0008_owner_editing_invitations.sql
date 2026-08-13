ALTER TABLE "department_memberships" ADD "permissions_json" text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
CREATE TABLE "department_invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "department_id" text NOT NULL,
  "email" text NOT NULL,
  "display_name" text DEFAULT '' NOT NULL,
  "role" text NOT NULL,
  "permissions_json" text DEFAULT '[]' NOT NULL,
  "token_hash" text NOT NULL,
  "status" text NOT NULL,
  "invited_by" text NOT NULL,
  "expires_at" text NOT NULL,
  "accepted_by" text,
  "created_at" text NOT NULL,
  "accepted_at" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_department_invitations_token" ON "department_invitations" ("token_hash");
--> statement-breakpoint
CREATE INDEX "idx_department_invitations_department_status" ON "department_invitations" ("department_id","status");
--> statement-breakpoint
CREATE TABLE "member_credentials" (
  "user_id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "password_salt" text NOT NULL,
  "password_hash" text NOT NULL,
  "iterations" integer NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_member_credentials_email" ON "member_credentials" ("email");
--> statement-breakpoint
CREATE TABLE "member_sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "created_at" text NOT NULL,
  "expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_member_sessions_user_expires" ON "member_sessions" ("user_id","expires_at");
--> statement-breakpoint
CREATE TABLE "member_login_state" (
  "email" text PRIMARY KEY NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "locked_until" text,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stickney_record_overrides" (
  "id" text PRIMARY KEY NOT NULL,
  "department_id" text NOT NULL,
  "record_type" text NOT NULL,
  "source_record_id" text NOT NULL,
  "data_json" text DEFAULT '{}' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stickney_overrides_record" ON "stickney_record_overrides" ("department_id","record_type","source_record_id");
--> statement-breakpoint
CREATE INDEX "idx_stickney_overrides_department_type" ON "stickney_record_overrides" ("department_id","record_type","status");
