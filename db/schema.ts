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
}, (table) => [
  uniqueIndex("idx_memberships_user_department").on(table.userId, table.departmentId),
  index("idx_memberships_department").on(table.departmentId, table.status),
]);

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

export const departmentPreplans = sqliteTable("department_preplans", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull(),
  propertyName: text("property_name").notNull(),
  address: text("address").notNull(),
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
