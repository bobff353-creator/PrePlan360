import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fleetCheckProgress, fleetCheckTemplate, fleetCheckValidation } from "../app/lib/fleet-checks.ts";

const inventory = [
  { id: "daily-light", apparatus_id: "engine-1", name: "Emergency lights", equipment_category: "Safety", check_types: ["daily"], source_form: null, retired_at: null },
  { id: "weekly-pack", apparatus_id: "engine-1", name: "SCBA pack", equipment_category: "SCBA", check_types: ["weekly"], source_form: null, retired_at: null },
  { id: "fallback-tool", apparatus_id: "engine-2", name: "Halligan", equipment_category: "Tools", check_types: [], source_form: null, retired_at: null },
];

test("department fleet checks use mapped real equipment and a dedicated odometer reading", () => {
  const daily = fleetCheckTemplate(inventory, "engine-1", "daily");
  assert.equal(daily.mapping, "department");
  assert.deepEqual(daily.items.map((item) => item.source_item_id), ["__odometer__", "daily-light"]);
  assert.equal(daily.items[0].item_name, "Odometer reading");
  const weekly = fleetCheckTemplate(inventory, "engine-1", "weekly");
  assert.deepEqual(weekly.items.map((item) => item.source_item_id), ["weekly-pack"]);
});

test("unmapped departments use their own active inventory without inventing equipment", () => {
  const daily = fleetCheckTemplate(inventory, "engine-2", "daily");
  assert.equal(daily.mapping, "active_inventory");
  assert.deepEqual(daily.items.map((item) => item.source_item_id), ["__odometer__", "fallback-tool"]);
});

test("failed or missing apparatus items require a write-up and photo", () => {
  const item = fleetCheckTemplate(inventory, "engine-2", "weekly").items[0];
  item.result = "missing";
  assert.match(fleetCheckValidation([item], true), /write-up note/);
  item.note = "Not found in assigned compartment";
  assert.match(fleetCheckValidation([item], true), /photo evidence/);
  item.photo_url = "private-blob";
  assert.equal(fleetCheckValidation([item], true), "");
  assert.deepEqual(fleetCheckProgress([item]), { completed: 1, total: 1, failed: 1 });
});

test("shared fleet workspace exposes interactive check, evidence, and repair APIs", async () => {
  const [workspace, api, evidence, propagation] = await Promise.all([
    readFile(new URL("../app/d/[slug]/fleet-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/departments/[id]/fleet-checks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/departments/[id]/fleet-evidence/[checkId]/[itemId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../foundation/propagation.json", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /Daily Vehicle Check/);
  assert.match(workspace, /Weekly Apparatus Check/);
  assert.match(workspace, /Mark all pass/);
  assert.match(workspace, /capture="environment"/);
  assert.match(workspace, /Save progress/);
  assert.match(api, /fleet_check_completed/);
  assert.match(api, /fleet_work_order/);
  assert.match(evidence, /canAccessDepartment/);
  assert.match(propagation, /apparatus-and-logistics/);
});
