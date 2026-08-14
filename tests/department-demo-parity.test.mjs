import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...parts) => readFile(path.join(root, ...parts), "utf8");

test("the shared department foundation includes every operational demo module", async () => {
  const [demo, foundation, page] = await Promise.all([
    read("public", "fireflow-360-demo.html"),
    read("db", "foundation.ts"),
    read("app", "d", "[slug]", "page.tsx"),
  ]);
  for (const label of ["Live Ops Board", "Command Center", "Respond", "Active Incident", "Roster & Staffing", "Scheduling", "Payroll", "Daily Log", "Daily Duties", "Apparatus & Logistics", "Pre-Plans", "Inspections", "Hydrants", "Box Cards & Docs"]) {
    assert.match(demo, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const [key, label] of [["command-center", "Command Center"], ["active-incident", "Active Incident"], ["payroll", "Payroll"]]) {
    assert.match(foundation, new RegExp(`key: "${key}", label: "${label}"`));
  }
  assert.match(page, /<CommandCenterWorkspace/);
  assert.match(page, /<ActiveIncidentWorkspace/);
  assert.match(page, /<PayrollWorkspace/);
  assert.match(page, /getDepartmentSource\(department\.slug\)/);
});

test("new department workspaces keep real tenant data and reject fictional demo records", async () => {
  const [workspaces, page, stickney, fermilab, access] = await Promise.all([
    read("app", "d", "[slug]", "operations-workspaces.tsx"),
    read("app", "d", "[slug]", "page.tsx"),
    read("db", "stickney.ts"),
    read("db", "fermilab.ts"),
    read("db", "access.ts"),
  ]);
  assert.doesNotMatch(workspaces, /Redstone Valley|Meridian Commons|E-1204|Box 1204/);
  assert.match(workspaces, /demo names and counts are never substituted/);
  assert.match(workspaces, /No wages are guessed or copied from demo data/);
  assert.match(workspaces, /download=.*schedule-hours/);
  assert.match(workspaces, /employment_end_date.*periodStart/);
  assert.match(page, /loadDepartmentSourceModule\(source, "payroll", department\.id\)/);
  assert.match(page, /loadDepartmentSourceModule\(source, "dashboard", department\.id\)/);
  assert.match(page, /loadDepartmentSourceModule\(source, "preplans", department\.id\)/);
  assert.match(stickney, /module === "scheduling" \|\| module === "payroll"/);
  assert.match(fermilab, /module === "live-ops" \|\| module === "scheduling" \|\| module === "payroll"/);
  assert.match(access, /"payroll"/);
});

test("Active Incident is backed by the same saved record used by Live Ops and station takeover", async () => {
  const [workspaces, page, watcher] = await Promise.all([
    read("app", "d", "[slug]", "operations-workspaces.tsx"),
    read("app", "d", "[slug]", "page.tsx"),
    read("app", "api", "departments", "[id]", "active-incident", "route.ts"),
  ]);
  assert.match(workspaces, /item_type === "incident" && item\.operational_status === "active"/);
  assert.match(page, /getDepartmentModuleData\(department\.id, "live-ops"\)/);
  assert.match(page, /recordManagerOnly/);
  assert.match(watcher, /getDepartmentModuleData\(departmentId, "live-ops"\)/);
});
