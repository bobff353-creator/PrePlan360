import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const platformUsers = sqliteTable("platform_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  platformRole: text("platform_role").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_platform_users_email").on(table.email),
  uniqueIndex("idx_single_platform_owner").on(table.platformRole).where(sql`${table.platformRole} = 'platform_owner'`),
]);

export const ownerCredentials = sqliteTable("owner_credentials", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  iterations: integer("iterations").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_owner_credentials_email").on(table.email)]);

export const ownerSessions = sqliteTable("owner_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [index("idx_owner_sessions_user_expires").on(table.userId, table.expiresAt)]);

export const ownerLoginState = sqliteTable("owner_login_state", {
  email: text("email").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: text("locked_until"),
  updatedAt: text("updated_at").notNull(),
});

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: text("status").notNull(),
  stationCount: integer("station_count").notNull().default(1),
  vehicleCount: integer("vehicle_count").notNull().default(0),
  weatherLocation: text("weather_location").notNull().default(""),
  appTitle: text("app_title").notNull().default(""),
  welcomeMessage: text("welcome_message").notNull().default(""),
  brandPrimary: text("brand_primary").notNull().default("#7f1d1d"),
  brandSecondary: text("brand_secondary").notNull().default("#090d12"),
  brandAccent: text("brand_accent").notNull().default("#d4a017"),
  brandAction: text("brand_action").notNull().default("#2563a6"),
  brandAlert: text("brand_alert").notNull().default("#d85a1f"),
  logoKey: text("logo_key"),
  logoContentType: text("logo_content_type"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_departments_slug").on(table.slug)]);

export const departmentAssets = sqliteTable("department_assets", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  assetType: text("asset_type").notNull(),
  name: text("name").notNull(),
  unitNumber: text("unit_number").notNull().default(""),
  category: text("category").notNull().default(""),
  manufacturer: text("manufacturer").notNull().default(""),
  model: text("model").notNull().default(""),
  modelYear: integer("model_year"),
  vin: text("vin"),
  barcode: text("barcode"),
  serialNumber: text("serial_number").notNull().default(""),
  status: text("status").notNull().default("in_service"),
  location: text("location").notNull().default(""),
  odometer: integer("odometer"),
  engineHours: integer("engine_hours"),
  manualUrl: text("manual_url").notNull().default(""),
  partsUrl: text("parts_url").notNull().default(""),
  maintenanceNotes: text("maintenance_notes").notNull().default(""),
  vinSource: text("vin_source"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_department_assets_department_type").on(table.departmentId, table.assetType),
  uniqueIndex("idx_department_assets_vin").on(table.departmentId, table.vin).where(sql`${table.vin} IS NOT NULL`),
  uniqueIndex("idx_department_assets_barcode").on(table.departmentId, table.barcode).where(sql`${table.barcode} IS NOT NULL`),
]);

export const assetResources = sqliteTable("asset_resources", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  assetId: text("asset_id").notNull(),
  resourceType: text("resource_type").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  source: text("source").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_asset_resources_asset").on(table.departmentId, table.assetId)]);

export const assetMaintenance = sqliteTable("asset_maintenance", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  assetId: text("asset_id").notNull(),
  task: text("task").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url").notNull().default(""),
  intervalMonths: integer("interval_months"),
  lastCompleted: text("last_completed"),
  nextDue: text("next_due"),
  status: text("status").notNull().default("planned"),
  notes: text("notes").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_asset_maintenance_asset_status").on(table.departmentId, table.assetId, table.status)]);

export const assetEvents = sqliteTable("asset_events", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  assetId: text("asset_id").notNull(),
  eventType: text("event_type").notNull(),
  detail: text("detail").notNull(),
  odometer: integer("odometer"),
  engineHours: integer("engine_hours"),
  actorUserId: text("actor_user_id").notNull(),
  occurredAt: text("occurred_at").notNull(),
}, (table) => [index("idx_asset_events_asset_time").on(table.departmentId, table.assetId, table.occurredAt)]);

export const departmentMemberships = sqliteTable("department_memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  departmentId: text("department_id").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  permissionsJson: text("permissions_json").notNull().default("[]"),
}, (table) => [
  uniqueIndex("idx_memberships_user_department").on(table.userId, table.departmentId),
  index("idx_memberships_department").on(table.departmentId, table.status),
]);

export const departmentInvitations = sqliteTable("department_invitations", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default(""),
  role: text("role").notNull(),
  permissionsJson: text("permissions_json").notNull().default("[]"),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull(),
  invitedBy: text("invited_by").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedBy: text("accepted_by"),
  createdAt: text("created_at").notNull(),
  acceptedAt: text("accepted_at"),
}, (table) => [
  uniqueIndex("idx_department_invitations_token").on(table.tokenHash),
  index("idx_department_invitations_department_status").on(table.departmentId, table.status),
]);

export const memberCredentials = sqliteTable("member_credentials", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  iterations: integer("iterations").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_member_credentials_email").on(table.email)]);

export const memberSessions = sqliteTable("member_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [index("idx_member_sessions_user_expires").on(table.userId, table.expiresAt)]);

export const memberLoginState = sqliteTable("member_login_state", {
  email: text("email").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: text("locked_until"),
  updatedAt: text("updated_at").notNull(),
});

export const stickneyRecordOverrides = sqliteTable("stickney_record_overrides", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  recordType: text("record_type").notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  dataJson: text("data_json").notNull().default("{}"),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_stickney_overrides_record").on(table.departmentId, table.recordType, table.sourceRecordId),
  index("idx_stickney_overrides_department_type").on(table.departmentId, table.recordType, table.status),
]);

export const departmentModuleConfigs = sqliteTable("department_module_configs", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  moduleKey: text("module_key").notNull(),
  heading: text("heading").notNull().default(""),
  description: text("description").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_department_module_configs_key").on(table.departmentId, table.moduleKey)]);

export const departmentModuleItems = sqliteTable("department_module_items", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  moduleKey: text("module_key").notNull(),
  itemType: text("item_type").notNull().default("notice"),
  title: text("title").notNull(),
  operationalStatus: text("operational_status").notNull().default("ready"),
  summary: text("summary").notNull().default(""),
  location: text("location").notNull().default(""),
  contact: text("contact").notNull().default(""),
  linkUrl: text("link_url").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  recordStatus: text("record_status").notNull().default("active"),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_department_module_items_list").on(table.departmentId, table.moduleKey, table.recordStatus, table.sortOrder),
]);

export const platformFoundationSettings = sqliteTable("platform_foundation_settings", {
  id: text("id").primaryKey(),
  moduleOrderJson: text("module_order_json").notNull().default("[]"),
  hiddenModulesJson: text("hidden_modules_json").notNull().default("[]"),
  boardRotationSeconds: integer("board_rotation_seconds").notNull().default(12),
  responseDurationSeconds: integer("response_duration_seconds").notNull().default(12),
  liveBoardTitle: text("live_board_title").notNull().default("Live Operations Board"),
  liveBoardOrderJson: text("live_board_order_json").notNull().default('["summary","station","apparatus"]'),
  liveBoardHiddenJson: text("live_board_hidden_json").notNull().default("[]"),
  liveBoardWidthsJson: text("live_board_widths_json").notNull().default('{"summary":"full","station":"half","apparatus":"half"}'),
  liveBoardPanelsJson: text("live_board_panels_json").notNull().default('["equipment","duty","closecalls","training"]'),
  liveBoardForecastDetail: text("live_board_forecast_detail").notNull().default("3"),
  liveBoardWeatherUrl: text("live_board_weather_url").notNull().default(""),
  liveBoardAlertsUrl: text("live_board_alerts_url").notNull().default(""),
  liveBoardRadarUrl: text("live_board_radar_url").notNull().default(""),
  liveBoardEquipmentUrl: text("live_board_equipment_url").notNull().default(""),
  liveBoardClosecallsUrl: text("live_board_closecalls_url").notNull().default(""),
  liveBoardLoddUrl: text("live_board_lodd_url").notNull().default("https://apps.usfa.fema.gov/firefighter-fatalities"),
  liveBoardTrainingUrl: text("live_board_training_url").notNull().default(""),
  liveBoardSourceRefreshMinutes: integer("live_board_source_refresh_minutes").notNull().default(5),
  liveBoardRadarRefreshMinutes: integer("live_board_radar_refresh_minutes").notNull().default(5),
  liveBoardRadarDisplaySeconds: integer("live_board_radar_display_seconds").notNull().default(30),
  liveBoardSevereRadarSeconds: integer("live_board_severe_radar_seconds").notNull().default(90),
  liveBoardShowNextShift: integer("live_board_show_next_shift").notNull().default(1),
  liveBoardExternalLinksJson: text("live_board_external_links_json").notNull().default("[]"),
  shiftHoursOn: integer("shift_hours_on").notNull().default(24),
  shiftHoursOff: integer("shift_hours_off").notNull().default(48),
  shiftStartTime: text("shift_start_time").notNull().default("07:00"),
  minimumStaffing: integer("minimum_staffing").notNull().default(0),
  overtimePeriodDays: integer("overtime_period_days").notNull().default(14),
  overtimeThresholdHours: integer("overtime_threshold_hours").notNull().default(212),
  overtimeAssignmentRule: text("overtime_assignment_rule").notNull().default("Department-defined rotation"),
  schedulingNotes: text("scheduling_notes").notNull().default(""),
  overtimeNotes: text("overtime_notes").notNull().default(""),
  dailyLogEquipmentAccountability: integer("daily_log_equipment_accountability").notNull().default(1),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const departmentFoundationSettings = sqliteTable("department_foundation_settings", {
  departmentId: text("department_id").primaryKey(),
  moduleOrderJson: text("module_order_json").notNull().default("[]"),
  hiddenModulesJson: text("hidden_modules_json").notNull().default("[]"),
  boardRotationSeconds: integer("board_rotation_seconds").notNull().default(12),
  responseDurationSeconds: integer("response_duration_seconds").notNull().default(12),
  liveBoardTitle: text("live_board_title").notNull().default("Live Operations Board"),
  liveBoardOrderJson: text("live_board_order_json").notNull().default('["summary","station","apparatus"]'),
  liveBoardHiddenJson: text("live_board_hidden_json").notNull().default("[]"),
  liveBoardWidthsJson: text("live_board_widths_json").notNull().default('{"summary":"full","station":"half","apparatus":"half"}'),
  liveBoardPanelsJson: text("live_board_panels_json").notNull().default('["equipment","duty","closecalls","training"]'),
  liveBoardForecastDetail: text("live_board_forecast_detail").notNull().default("3"),
  liveBoardWeatherUrl: text("live_board_weather_url").notNull().default(""),
  liveBoardAlertsUrl: text("live_board_alerts_url").notNull().default(""),
  liveBoardRadarUrl: text("live_board_radar_url").notNull().default(""),
  liveBoardEquipmentUrl: text("live_board_equipment_url").notNull().default(""),
  liveBoardClosecallsUrl: text("live_board_closecalls_url").notNull().default(""),
  liveBoardLoddUrl: text("live_board_lodd_url").notNull().default("https://apps.usfa.fema.gov/firefighter-fatalities"),
  liveBoardTrainingUrl: text("live_board_training_url").notNull().default(""),
  liveBoardSourceRefreshMinutes: integer("live_board_source_refresh_minutes").notNull().default(5),
  liveBoardRadarRefreshMinutes: integer("live_board_radar_refresh_minutes").notNull().default(5),
  liveBoardRadarDisplaySeconds: integer("live_board_radar_display_seconds").notNull().default(30),
  liveBoardSevereRadarSeconds: integer("live_board_severe_radar_seconds").notNull().default(90),
  liveBoardShowNextShift: integer("live_board_show_next_shift").notNull().default(1),
  liveBoardExternalLinksJson: text("live_board_external_links_json").notNull().default("[]"),
  shiftHoursOn: integer("shift_hours_on").notNull().default(24),
  shiftHoursOff: integer("shift_hours_off").notNull().default(48),
  shiftStartTime: text("shift_start_time").notNull().default("07:00"),
  minimumStaffing: integer("minimum_staffing").notNull().default(0),
  overtimePeriodDays: integer("overtime_period_days").notNull().default(14),
  overtimeThresholdHours: integer("overtime_threshold_hours").notNull().default(212),
  overtimeAssignmentRule: text("overtime_assignment_rule").notNull().default("Department-defined rotation"),
  schedulingNotes: text("scheduling_notes").notNull().default(""),
  overtimeNotes: text("overtime_notes").notNull().default(""),
  dailyLogEquipmentAccountability: integer("daily_log_equipment_accountability").notNull().default(1),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const accessRequests = sqliteTable("access_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  departmentName: text("department_name").notNull(),
  requestedRole: text("requested_role").notNull(),
  note: text("note").notNull().default(""),
  status: text("status").notNull(),
  departmentId: text("department_id"),
  reviewedBy: text("reviewed_by"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
}, (table) => [index("idx_access_requests_status").on(table.status, table.createdAt)]);

export const supportSessions = sqliteTable("support_sessions", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  departmentId: text("department_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
}, (table) => [index("idx_support_sessions_owner_status").on(table.ownerUserId, table.status)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").notNull(),
  departmentId: text("department_id"),
  eventType: text("event_type").notNull(),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_audit_department_created").on(table.departmentId, table.createdAt)]);

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  externalId: text("external_id").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  departmentId: text("department_id"),
  summary: text("summary").notNull(),
  normalizedJson: text("normalized_json").notNull(),
  rawPayload: text("raw_payload").notNull(),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
}, (table) => [
  uniqueIndex("idx_webhook_events_source_external").on(table.source, table.externalId),
  index("idx_webhook_events_status_received").on(table.status, table.receivedAt),
]);

export const departmentIntegrations = sqliteTable("department_integrations", {
  departmentId: text("department_id").primaryKey(),
  mapsEnabled: integer("maps_enabled").notNull().default(0),
  streetViewEnabled: integer("street_view_enabled").notNull().default(0),
  routesEnabled: integer("routes_enabled").notNull().default(0),
  googleBrowserKey: text("google_browser_key").notNull().default(""),
  googleMapId: text("google_map_id").notNull().default(""),
  googleVerifiedAt: text("google_verified_at"),
  googleVerificationJson: text("google_verification_json").notNull().default("{}"),
  cadEnabled: integer("cad_enabled").notNull().default(0),
  cadProvider: text("cad_provider").notNull().default(""),
  cadSigningSecretCipher: text("cad_signing_secret_cipher").notNull().default(""),
  cadVerifiedAt: text("cad_verified_at"),
  cadLastEventAt: text("cad_last_event_at"),
  resendEnabled: integer("resend_enabled").notNull().default(0),
  resendReceivingAddress: text("resend_receiving_address").notNull().default(""),
  resendApiKeyCipher: text("resend_api_key_cipher").notNull().default(""),
  resendWebhookSecretCipher: text("resend_webhook_secret_cipher").notNull().default(""),
  resendWebhookId: text("resend_webhook_id").notNull().default(""),
  resendProviderVerifiedAt: text("resend_provider_verified_at"),
  resendLastEventAt: text("resend_last_event_at"),
  nightlyExportEnabled: integer("nightly_export_enabled").notNull().default(0),
  nightlyExportUrl: text("nightly_export_url").notNull().default(""),
  nightlyExportSecretCipher: text("nightly_export_secret_cipher").notNull().default(""),
  nightlyExportVerifiedAt: text("nightly_export_verified_at"),
  nightlyExportLastAttemptAt: text("nightly_export_last_attempt_at"),
  nightlyExportLastSuccessAt: text("nightly_export_last_success_at"),
  nightlyExportLastStatus: text("nightly_export_last_status").notNull().default("not_configured"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const departmentExportDeliveries = sqliteTable("department_export_deliveries", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  deliveryMode: text("delivery_mode").notNull(),
  status: text("status").notNull(),
  endpoint: text("endpoint").notNull(),
  httpStatus: integer("http_status"),
  summary: text("summary").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_department_exports_department_created").on(table.departmentId, table.createdAt)]);

export const departmentPreplans = sqliteTable("department_preplans", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  propertyName: text("property_name").notNull(),
  address: text("address").notNull(),
  latitude: text("latitude").notNull().default(""),
  longitude: text("longitude").notNull().default(""),
  footprintJson: text("footprint_json").notNull().default("[]"),
  operationalSummary: text("operational_summary").notNull().default(""),
  internalNotes: text("internal_notes").notNull().default(""),
  lastReviewed: text("last_reviewed"),
  status: text("status").notNull().default("active"),
  visibility: text("visibility").notNull().default("department_only"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_department_preplans_department_status").on(table.departmentId, table.status),
  index("idx_department_preplans_visibility_department").on(table.visibility, table.departmentId),
]);

export const departmentHydrants = sqliteTable("department_hydrants", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  hydrantNumber: text("hydrant_number").notNull(),
  location: text("location").notNull(),
  latitude: text("latitude").notNull().default(""),
  longitude: text("longitude").notNull().default(""),
  flowGpm: integer("flow_gpm"),
  operationalNotes: text("operational_notes").notNull().default(""),
  internalNotes: text("internal_notes").notNull().default(""),
  lastInspected: text("last_inspected"),
  status: text("status").notNull().default("in_service"),
  visibility: text("visibility").notNull().default("department_only"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_department_hydrants_number").on(table.departmentId, table.hydrantNumber),
  index("idx_department_hydrants_visibility_department").on(table.visibility, table.departmentId),
]);
