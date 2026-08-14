CREATE TABLE department_integrations (
  department_id text PRIMARY KEY NOT NULL,
  maps_enabled integer NOT NULL DEFAULT 0,
  street_view_enabled integer NOT NULL DEFAULT 0,
  routes_enabled integer NOT NULL DEFAULT 0,
  google_browser_key text NOT NULL DEFAULT '',
  google_map_id text NOT NULL DEFAULT '',
  google_verified_at text,
  google_verification_json text NOT NULL DEFAULT '{}',
  cad_enabled integer NOT NULL DEFAULT 0,
  cad_provider text NOT NULL DEFAULT '',
  cad_signing_secret_cipher text NOT NULL DEFAULT '',
  cad_verified_at text,
  cad_last_event_at text,
  resend_enabled integer NOT NULL DEFAULT 0,
  resend_receiving_address text NOT NULL DEFAULT '',
  resend_api_key_cipher text NOT NULL DEFAULT '',
  resend_webhook_secret_cipher text NOT NULL DEFAULT '',
  resend_webhook_id text NOT NULL DEFAULT '',
  resend_provider_verified_at text,
  resend_last_event_at text,
  nightly_export_enabled integer NOT NULL DEFAULT 0,
  nightly_export_url text NOT NULL DEFAULT '',
  nightly_export_secret_cipher text NOT NULL DEFAULT '',
  nightly_export_verified_at text,
  nightly_export_last_attempt_at text,
  nightly_export_last_success_at text,
  nightly_export_last_status text NOT NULL DEFAULT 'not_configured',
  updated_by text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
CREATE TABLE department_export_deliveries (
  id text PRIMARY KEY NOT NULL,
  department_id text NOT NULL,
  delivery_mode text NOT NULL,
  status text NOT NULL,
  endpoint text NOT NULL,
  http_status integer,
  summary text NOT NULL DEFAULT '',
  created_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_department_exports_department_created ON department_export_deliveries (department_id, created_at);
