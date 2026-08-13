import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canWriteDepartment, db, getDepartment, id, now } from "@/db/access";

function text(form: FormData, name: string, max = 160) { return String(form.get(name) || "").trim().slice(0, max); }
function optionalCode(value: string, uppercase = false) { const normalized = (uppercase ? value.toUpperCase() : value).trim(); return normalized || null; }
function nonnegative(form: FormData, name: string) { const raw = String(form.get(name) || "").trim(); if (!raw) return null; const value = Number(raw); return Number.isFinite(value) && value >= 0 ? Math.round(value) : null; }
function safeUrl(value: string) { if (!value) return ""; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 1000) : ""; } catch { return ""; } }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const form = await request.formData();
  const supportId = text(form, "support_session_id", 100);
  if (!(await canWriteDepartment(user.userId, departmentId, supportId))) return new Response("Department administrator or active owner-support access required", { status: 403 });
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });

  const assetType = text(form, "asset_type", 20);
  const name = text(form, "name", 120);
  if (!['vehicle', 'equipment'].includes(assetType) || !name) return new Response("Asset type and name are required", { status: 400 });
  const vin = optionalCode(text(form, "vin", 24), true);
  const barcode = optionalCode(text(form, "barcode", 120));
  if (vin && !/^[A-HJ-NPR-Z0-9*]{11,17}$/.test(vin)) return new Response("VIN format is invalid", { status: 400 });
  const assetId = id("asset");
  const at = now();
  const odometer = nonnegative(form, "odometer");
  const engineHours = nonnegative(form, "engine_hours");
  try {
    const database = db();
    await database.batch([
      database.prepare("INSERT INTO department_assets (id,department_id,asset_type,name,unit_number,category,manufacturer,model,model_year,vin,barcode,serial_number,status,location,odometer,engine_hours,manual_url,parts_url,maintenance_notes,vin_source,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(assetId, departmentId, assetType, name, text(form, "unit_number", 60), text(form, "category", 80), text(form, "manufacturer", 120), text(form, "model", 120), nonnegative(form, "model_year"), vin, barcode, text(form, "serial_number", 120), text(form, "status", 30) || "in_service", text(form, "location", 160), odometer, engineHours, safeUrl(text(form, "manual_url", 1000)), safeUrl(text(form, "parts_url", 1000)), text(form, "maintenance_notes", 2000), vin && text(form, "vin_source", 40) === "NHTSA vPIC" ? "NHTSA vPIC" : null, user.userId, at, at),
      database.prepare("INSERT INTO asset_events (id,department_id,asset_id,event_type,detail,odometer,engine_hours,actor_user_id,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id("event"), departmentId, assetId, "asset_created", `${assetType === "vehicle" ? "Apparatus / vehicle" : "Equipment"} record created.`, odometer, engineHours, user.userId, at),
    ]);
  } catch {
    return new Response("That VIN or barcode is already assigned in this department.", { status: 409 });
  }
  await audit(user.userId, departmentId, "asset_created", `${assetType === "vehicle" ? "Vehicle" : "Equipment"} ${name} was added.`);
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${department.slug}?module=fleet&asset=${assetId}${support}`, request.url), 303);
}
