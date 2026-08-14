import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../db/fermilab.ts", import.meta.url), "utf8");
const registry = await readFile(new URL("../db/department-source.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/d/[slug]/page.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../app/d/[slug]/stickney-workspace.tsx", import.meta.url), "utf8");

test("Fermilab source adapter covers the transferred department records", () => {
  for (const table of [
    "employees",
    "employee_profiles",
    "schedule_assignments",
    "field_preplans",
    "field_hydrants",
    "fleet_apparatus",
    "inventory_compartments",
    "inventory_equipment",
    "inventory_media",
    "inventory_checks",
    "inventory_check_items",
    "daily_duty_tasks",
    "box_cards",
    "policies",
    "important_phone_numbers",
  ]) assert.match(source, new RegExp(`mirrorRows\\(\"${table}\"\\)|mirrorCount\\(table\\)`));
});

test("Fermilab mirror stays server-only and read-only", () => {
  assert.match(source, /import "server-only"/);
  assert.match(source, /FERMILAB_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /from\("fermilab_record_mirror"\)/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(source, /applyOverrides/);
});

test("shared department route selects the registered Fermilab adapter", () => {
  assert.match(registry, /fermilab:\s*\{/);
  assert.match(registry, /loadFermilabModule/);
  assert.match(page, /loadDepartmentSourceModule/);
  assert.match(workspace, /source\.recordsLabel/);
  assert.doesNotMatch(workspace, /Live Stickney records/);
});
