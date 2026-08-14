import type { StickneyInventoryItem } from "@/db/stickney";

export type FleetCheckMode = "daily" | "weekly";
export type FleetCheckResult = "pending" | "pass" | "fail" | "missing" | "na";

export type FleetCheckItem = {
  source_item_id: string;
  item_name: string;
  category: string;
  result: FleetCheckResult;
  note: string;
  numeric_reading: number | null;
  photo_url: string | null;
  photo_content_type: string | null;
};

export type FleetCheckRecord = {
  id: string;
  apparatus_id: string;
  apparatus_name: string;
  check_type: FleetCheckMode;
  status: "in_progress" | "completed";
  mapping: "department" | "active_inventory" | "none";
  started_by: string;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  items: FleetCheckItem[];
};

export type FleetWorkOrderRecord = {
  id: string;
  check_id: string;
  source_item_id: string;
  apparatus_id: string;
  apparatus_name: string;
  item_name: string;
  result: "fail" | "missing";
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "parts" | "closed";
  note: string;
  photo_url: string | null;
  photo_content_type: string | null;
  reported_by: string;
  reported_at: string;
  updated_at: string;
};

export type FleetOverlayResponse = {
  checks: FleetCheckRecord[];
  workOrders: FleetWorkOrderRecord[];
};

const modePattern: Record<FleetCheckMode, RegExp> = {
  daily: /(^|[^a-z])daily([^a-z]|$)/i,
  weekly: /(^|[^a-z])weekly([^a-z]|$)/i,
};

function checkTypes(item: StickneyInventoryItem) {
  return [...(item.check_types ?? []), item.source_form ?? ""]
    .flatMap((value) => String(value || "").split(/[,;/|]+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function fleetCheckTemplate(inventory: StickneyInventoryItem[], apparatusId: string, mode: FleetCheckMode) {
  const activeInventory = inventory.filter((item) => item.apparatus_id === apparatusId && !item.retired_at);
  const mapped = activeInventory.filter((item) => checkTypes(item).some((value) => modePattern[mode].test(value)));
  const selected = mapped.length ? mapped : activeInventory;
  const mapping: FleetCheckRecord["mapping"] = mapped.length ? "department" : selected.length ? "active_inventory" : "none";
  const items: FleetCheckItem[] = selected.map((item) => ({
    source_item_id: item.id,
    item_name: item.name,
    category: item.equipment_category || "Apparatus inventory",
    result: "pending",
    note: "",
    numeric_reading: null,
    photo_url: null,
    photo_content_type: null,
  }));
  if (mode === "daily") {
    items.unshift({
      source_item_id: "__odometer__",
      item_name: "Odometer reading",
      category: "Vehicle readings",
      result: "pending",
      note: "",
      numeric_reading: null,
      photo_url: null,
      photo_content_type: null,
    });
  }
  return { items, mapping };
}

export function fleetCheckProgress(items: FleetCheckItem[]) {
  const completed = items.filter((item) => item.source_item_id === "__odometer__" ? item.numeric_reading != null : item.result !== "pending").length;
  const failed = items.filter((item) => item.result === "fail" || item.result === "missing").length;
  return { completed, total: items.length, failed };
}

export function fleetCheckValidation(items: FleetCheckItem[], completing: boolean) {
  if (!items.length) return "No active inventory is available for this apparatus check.";
  for (const item of items) {
    if (item.source_item_id === "__odometer__") {
      if (item.numeric_reading != null && (!Number.isFinite(item.numeric_reading) || item.numeric_reading < 0)) return "Enter a valid nonnegative odometer reading.";
      if (completing && item.numeric_reading == null) return "Record the odometer before completing the daily vehicle check.";
      continue;
    }
    if (completing && item.result === "pending") return "Complete every apparatus check item before submitting.";
    if ((item.result === "fail" || item.result === "missing") && !item.note.trim()) return `Add a write-up note for ${item.item_name}.`;
    if ((item.result === "fail" || item.result === "missing") && !item.photo_url) return `Add photo evidence for ${item.item_name}.`;
  }
  return "";
}

export function isFleetCheckRecord(value: unknown): value is FleetCheckRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FleetCheckRecord>;
  return typeof row.id === "string" && typeof row.apparatus_id === "string" && (row.check_type === "daily" || row.check_type === "weekly") && Array.isArray(row.items);
}

export function isFleetWorkOrderRecord(value: unknown): value is FleetWorkOrderRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FleetWorkOrderRecord>;
  return typeof row.id === "string" && typeof row.check_id === "string" && typeof row.source_item_id === "string" && typeof row.item_name === "string";
}
