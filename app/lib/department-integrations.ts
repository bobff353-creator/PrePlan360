import { db, id, now } from "@/db/access";

export type DepartmentIntegration = {
  department_id: string;
  maps_enabled: number;
  street_view_enabled: number;
  routes_enabled: number;
  google_browser_key: string;
  google_map_id: string;
  google_verified_at: string | null;
  google_verification_json: string;
  cad_enabled: number;
  cad_provider: string;
  cad_signing_secret_cipher: string;
  cad_verified_at: string | null;
  cad_last_event_at: string | null;
  resend_enabled: number;
  resend_receiving_address: string;
  resend_api_key_cipher: string;
  resend_webhook_secret_cipher: string;
  resend_webhook_id: string;
  resend_provider_verified_at: string | null;
  resend_last_event_at: string | null;
  nightly_export_enabled: number;
  nightly_export_url: string;
  nightly_export_secret_cipher: string;
  nightly_export_verified_at: string | null;
  nightly_export_last_attempt_at: string | null;
  nightly_export_last_success_at: string | null;
  nightly_export_last_status: string;
  updated_by: string;
  updated_at: string;
};

export type DepartmentExportDelivery = {
  id: string;
  delivery_mode: string;
  status: string;
  endpoint: string;
  http_status: number | null;
  summary: string;
  created_at: string;
};

const integrationColumns = "department_id,maps_enabled,street_view_enabled,routes_enabled,google_browser_key,google_map_id,google_verified_at,google_verification_json,cad_enabled,cad_provider,cad_signing_secret_cipher,cad_verified_at,cad_last_event_at,resend_enabled,resend_receiving_address,resend_api_key_cipher,resend_webhook_secret_cipher,resend_webhook_id,resend_provider_verified_at,resend_last_event_at,nightly_export_enabled,nightly_export_url,nightly_export_secret_cipher,nightly_export_verified_at,nightly_export_last_attempt_at,nightly_export_last_success_at,nightly_export_last_status,updated_by,updated_at";

export function emptyDepartmentIntegration(departmentId: string): DepartmentIntegration {
  return {
    department_id: departmentId,
    maps_enabled: 0,
    street_view_enabled: 0,
    routes_enabled: 0,
    google_browser_key: "",
    google_map_id: "",
    google_verified_at: null,
    google_verification_json: "{}",
    cad_enabled: 0,
    cad_provider: "",
    cad_signing_secret_cipher: "",
    cad_verified_at: null,
    cad_last_event_at: null,
    resend_enabled: 0,
    resend_receiving_address: "",
    resend_api_key_cipher: "",
    resend_webhook_secret_cipher: "",
    resend_webhook_id: "",
    resend_provider_verified_at: null,
    resend_last_event_at: null,
    nightly_export_enabled: 0,
    nightly_export_url: "",
    nightly_export_secret_cipher: "",
    nightly_export_verified_at: null,
    nightly_export_last_attempt_at: null,
    nightly_export_last_success_at: null,
    nightly_export_last_status: "not_configured",
    updated_by: "",
    updated_at: "",
  };
}

export async function getDepartmentIntegration(departmentId: string) {
  return await db().prepare(`SELECT ${integrationColumns} FROM department_integrations WHERE department_id=?`).bind(departmentId).first<DepartmentIntegration>() || emptyDepartmentIntegration(departmentId);
}

export async function getDepartmentIntegrationBySlug(slug: string) {
  return db().prepare(`SELECT ${integrationColumns} FROM department_integrations WHERE department_id=(SELECT id FROM departments WHERE slug=?)`).bind(slug).first<DepartmentIntegration>();
}

export async function ensureDepartmentIntegration(departmentId: string, actorUserId: string) {
  const at = now();
  await db().prepare("INSERT INTO department_integrations (department_id,updated_by,updated_at) VALUES (?,?,?) ON CONFLICT(department_id) DO NOTHING").bind(departmentId, actorUserId, at).run();
}

export async function markCadDelivery(departmentId: string) {
  const at = now();
  await db().prepare("UPDATE department_integrations SET cad_verified_at=COALESCE(cad_verified_at,?),cad_last_event_at=?,updated_at=? WHERE department_id=?").bind(at, at, at, departmentId).run();
}

export async function markResendDelivery(departmentId: string) {
  const at = now();
  await db().prepare("UPDATE department_integrations SET resend_last_event_at=?,updated_at=? WHERE department_id=?").bind(at, at, departmentId).run();
}

export async function listEnabledNightlyExports() {
  const result = await db().prepare(`SELECT ${integrationColumns} FROM department_integrations WHERE nightly_export_enabled=1 AND nightly_export_verified_at IS NOT NULL ORDER BY department_id`).all<DepartmentIntegration>();
  return result.results;
}

export async function recordExportDelivery(input: { departmentId: string; deliveryMode: string; status: string; endpoint: string; httpStatus?: number | null; summary: string }) {
  await db().prepare("INSERT INTO department_export_deliveries (id,department_id,delivery_mode,status,endpoint,http_status,summary,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id("export"), input.departmentId, input.deliveryMode, input.status, input.endpoint, input.httpStatus ?? null, input.summary.slice(0, 500), now()).run();
}

export async function listDepartmentExportDeliveries(departmentId: string) {
  const result = await db().prepare("SELECT id,delivery_mode,status,endpoint,http_status,summary,created_at FROM department_export_deliveries WHERE department_id=? ORDER BY created_at DESC LIMIT 10").bind(departmentId).all<DepartmentExportDelivery>();
  return result.results;
}
