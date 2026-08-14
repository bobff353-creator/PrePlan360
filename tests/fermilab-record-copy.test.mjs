import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Fermilab copied records are isolated to the Fermilab department adapter", async () => {
  const [adapter, page] = await Promise.all([read("db/fermilab.ts"), read("app/d/[slug]/page.tsx")]);
  assert.match(adapter, /const tenantSlug = "fermilab"/);
  assert.match(adapter, /const expectedProjectRef = "tskywxetyvszuljumlsi"/);
  assert.match(adapter, /\.eq\("tenant_slug", tenantSlug\)/);
  assert.match(page, /isFermilab && connectedRecordModules\.has\(active\[0\]\)/);
  assert.match(page, /loadFermilabModule\(active\[0\], department\.id\)/);
  assert.equal((page.match(/department\.slug === "fermilab"/g) || []).length, 1);
});

test("the Fermilab adapter exposes requested operational records without source deletes", async () => {
  const adapter = await read("db/fermilab.ts");
  for (const source of ["employees", "schedule_assignments", "schedule_requests", "fleet_apparatus", "inventory_equipment", "inventory_media", "field_preplans", "field_hydrants", "daily_duty_tasks", "box_cards", "policies", "important_phone_numbers"]) {
    assert.match(adapter, new RegExp(`records\\("${source}"`), `Expected ${source} to be loaded`);
  }
  assert.doesNotMatch(adapter, /\.delete\(|\bDELETE\b|\bTRUNCATE\b|\bDROP\b/i);
  assert.match(adapter, /scheduleRequests/);
});

test("Fermilab media routes require sign-in, department access, and exact department slug", async () => {
  for (const path of ["app/api/departments/[id]/fermilab-photo/[employeeId]/route.ts", "app/api/departments/[id]/fermilab-inventory-photo/[photoId]/route.ts"]) {
    const route = await read(path);
    assert.match(route, /getChatGPTUser\(\)/);
    assert.match(route, /department\.slug !== "fermilab"/);
    assert.match(route, /canAccessDepartment\(user\.userId, departmentId\)/);
    assert.match(route, /cache-control": "private, no-store, max-age=0"/);
  }
});

test("shared workspaces label and route each connected source dynamically", async () => {
  const [workspace, staffing, fleet, documents] = await Promise.all([
    read("app/d/[slug]/stickney-workspace.tsx"),
    read("app/d/[slug]/staffing-workspace.tsx"),
    read("app/d/[slug]/fleet-workspace.tsx"),
    read("app/d/[slug]/documents-workspace.tsx"),
  ]);
  assert.match(workspace, /sourceName/);
  assert.match(workspace, /sourceKey}-inventory-photo/);
  assert.match(workspace, /scheduleRequests/);
  assert.match(staffing, /sourceKey}-photo/);
  assert.match(fleet, /sourceKey}-inventory-photo/);
  assert.match(documents, /Copied \{sourceName\} source/);
});

test("authorized Fermilab edits save as tenant overlays without changing the source copy", async () => {
  const route = await read("app/api/departments/[id]/stickney-records/route.ts");
  assert.match(route, /new Set\(\["stickney", "fermilab"\]\)\.has\(department\.slug\)/);
  assert.match(route, /loadFermilabModule\("staffing", departmentId\)/);
  assert.match(route, /INSERT INTO stickney_record_overrides/);
  assert.doesNotMatch(route, /fermilab_record_mirror[\s\S]*DELETE/i);
});
