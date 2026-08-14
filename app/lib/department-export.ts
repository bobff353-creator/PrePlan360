import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { db, getDepartment, id, now } from "@/db/access";
import type { DepartmentIntegration } from "@/app/lib/department-integrations";
import { decryptIntegrationSecret, hmacSha256 } from "@/app/lib/integration-crypto";
import { recordExportDelivery } from "@/app/lib/department-integrations";

type DeliveryMode = "connection_test" | "manual" | "nightly";

function privateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

function privateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

export async function validateDepartmentExportUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid HTTPS department server URL.");
  }
  if (url.protocol !== "https:") throw new Error("Nightly exports require HTTPS.");
  if (url.username || url.password) throw new Error("Do not place credentials in the export URL.");
  if (["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase()) || url.hostname.endsWith(".local")) throw new Error("The export endpoint must be a public department-owned HTTPS server.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname, family: isIP(url.hostname) }] : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address, family }) => family === 4 ? privateIpv4(address) : privateIpv6(address))) throw new Error("Private or local export targets are not allowed.");
  return url;
}

async function rows<T>(sql: string, departmentId: string) {
  return (await db().prepare(sql).bind(departmentId).all<T>()).results;
}

export async function buildDepartmentSnapshot(departmentId: string) {
  const department = await getDepartment(departmentId);
  if (!department) throw new Error("Department not found.");
  const [foundation, assets, resources, maintenance, assetEvents, members, moduleConfigs, moduleItems, preplans, hydrants, overrides, audit, webhooks] = await Promise.all([
    db().prepare("SELECT module_order_json,hidden_modules_json,board_rotation_seconds,response_duration_seconds,live_board_title,live_board_order_json,live_board_hidden_json,live_board_widths_json,live_board_panels_json,live_board_forecast_detail,live_board_weather_url,live_board_alerts_url,live_board_radar_url,live_board_equipment_url,live_board_closecalls_url,live_board_lodd_url,live_board_training_url,live_board_source_refresh_minutes,live_board_radar_refresh_minutes,live_board_radar_display_seconds,live_board_severe_radar_seconds,live_board_show_next_shift,live_board_external_links_json,shift_hours_on,shift_hours_off,shift_start_time,overtime_period_days,overtime_threshold_hours,overtime_assignment_rule,scheduling_notes,overtime_notes,daily_log_equipment_accountability,updated_at FROM department_foundation_settings WHERE department_id=?").bind(departmentId).first<Record<string, unknown>>(),
    rows<Record<string, unknown>>("SELECT id,asset_type,name,unit_number,category,manufacturer,model,model_year,vin,barcode,serial_number,status,location,odometer,engine_hours,manual_url,parts_url,maintenance_notes,vin_source,created_at,updated_at FROM department_assets WHERE department_id=? ORDER BY asset_type,name", departmentId),
    rows<Record<string, unknown>>("SELECT id,asset_id,resource_type,label,url,source,created_at FROM asset_resources WHERE department_id=? ORDER BY created_at", departmentId),
    rows<Record<string, unknown>>("SELECT id,asset_id,task,source_type,source_url,interval_months,last_completed,next_due,status,notes,created_at,updated_at FROM asset_maintenance WHERE department_id=? ORDER BY created_at", departmentId),
    rows<Record<string, unknown>>("SELECT id,asset_id,event_type,detail,odometer,engine_hours,actor_user_id,occurred_at FROM asset_events WHERE department_id=? ORDER BY occurred_at", departmentId),
    rows<Record<string, unknown>>("SELECT m.id,m.user_id,u.email,u.display_name,m.role,m.status,m.permissions_json,m.created_at,m.updated_at FROM department_memberships m JOIN platform_users u ON u.id=m.user_id WHERE m.department_id=? ORDER BY u.display_name", departmentId),
    rows<Record<string, unknown>>("SELECT id,module_key,heading,description,instructions,created_at,updated_at FROM department_module_configs WHERE department_id=? ORDER BY module_key", departmentId),
    rows<Record<string, unknown>>("SELECT id,module_key,item_type,title,operational_status,summary,location,contact,link_url,sort_order,record_status,created_at,updated_at FROM department_module_items WHERE department_id=? ORDER BY module_key,sort_order,title", departmentId),
    rows<Record<string, unknown>>("SELECT id,property_name,address,latitude,longitude,footprint_json,operational_summary,internal_notes,last_reviewed,status,visibility,created_at,updated_at FROM department_preplans WHERE department_id=? ORDER BY property_name", departmentId),
    rows<Record<string, unknown>>("SELECT id,hydrant_number,location,latitude,longitude,flow_gpm,operational_notes,internal_notes,last_inspected,status,visibility,created_at,updated_at FROM department_hydrants WHERE department_id=? ORDER BY hydrant_number", departmentId),
    rows<Record<string, unknown>>("SELECT id,record_type,source_record_id,data_json,status,created_at,updated_at FROM stickney_record_overrides WHERE department_id=? ORDER BY record_type,source_record_id", departmentId),
    rows<Record<string, unknown>>("SELECT id,actor_user_id,event_type,detail,created_at FROM audit_events WHERE department_id=? ORDER BY created_at DESC LIMIT 500", departmentId),
    rows<Record<string, unknown>>("SELECT id,source,external_id,event_type,status,summary,normalized_json,received_at,processed_at FROM webhook_events WHERE department_id=? ORDER BY received_at DESC LIMIT 500", departmentId),
  ]);
  const records = { assets, resources, maintenance, assetEvents, members, moduleConfigs, moduleItems, preplans, hydrants, sourceOverrides: overrides, audit, webhookEvents: webhooks };
  return {
    schema: "preplan360.department-snapshot.v1",
    snapshotId: id("snapshot"),
    generatedAt: now(),
    department,
    foundation,
    records,
    counts: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length])),
    exclusions: ["password hashes", "session tokens", "API keys", "webhook signing secrets", "raw webhook payloads"],
  };
}

export async function deliverDepartmentExport(integration: DepartmentIntegration, deliveryMode: DeliveryMode) {
  const endpoint = await validateDepartmentExportUrl(integration.nightly_export_url);
  const secret = decryptIntegrationSecret(integration.nightly_export_secret_cipher);
  if (!secret) throw new Error("A nightly export signing secret is required.");
  const at = now();
  const payload = deliveryMode === "connection_test"
    ? { schema: "preplan360.department-export-test.v1", deliveryId: id("delivery"), departmentId: integration.department_id, generatedAt: at, message: "Signed PrePlan 360 connection test" }
    : await buildDepartmentSnapshot(integration.department_id);
  const raw = JSON.stringify(payload);
  const signature = hmacSha256(`${at}.${raw}`, secret);
  let response: Response | null = null;
  let summary = "";
  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "content-type": "application/json",
        "user-agent": "PrePlan360-Department-Export/1.0",
        "x-preplan-department": integration.department_id,
        "x-preplan-delivery-mode": deliveryMode,
        "x-preplan-timestamp": at,
        "x-preplan-signature": `sha256=${signature}`,
      },
      body: raw,
    });
    summary = response.ok ? "Department server accepted the signed export." : `Department server returned HTTP ${response.status}.`;
    await recordExportDelivery({ departmentId: integration.department_id, deliveryMode, status: response.ok ? "accepted" : "rejected", endpoint: endpoint.toString(), httpStatus: response.status, summary });
    await db().prepare("UPDATE department_integrations SET nightly_export_verified_at=CASE WHEN ? THEN COALESCE(nightly_export_verified_at,?) ELSE nightly_export_verified_at END,nightly_export_last_attempt_at=?,nightly_export_last_success_at=CASE WHEN ? THEN ? ELSE nightly_export_last_success_at END,nightly_export_last_status=?,updated_at=? WHERE department_id=?")
      .bind(response.ok ? 1 : 0, at, at, response.ok ? 1 : 0, at, response.ok ? "accepted" : `http_${response.status}`, at, integration.department_id).run();
    if (!response.ok) throw new Error(summary);
    return { ok: true, status: response.status, summary };
  } catch (error) {
    if (!response) {
      summary = error instanceof Error ? error.message : "Department export failed.";
      await recordExportDelivery({ departmentId: integration.department_id, deliveryMode, status: "failed", endpoint: endpoint.toString(), summary });
      await db().prepare("UPDATE department_integrations SET nightly_export_last_attempt_at=?,nightly_export_last_status='failed',updated_at=? WHERE department_id=?").bind(at, at, integration.department_id).run();
    }
    throw error;
  }
}
