import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...parts) => readFile(path.join(root, ...parts), "utf8");

test("the shared department foundation includes every operational demo module", async () => {
  const [demo, foundation, page, contractText] = await Promise.all([
    read("public", "fireflow-360-demo.html"),
    read("db", "foundation.ts"),
    read("app", "d", "[slug]", "page.tsx"),
    read("foundation", "demo-department-parity.json"),
  ]);
  const contract = JSON.parse(contractText);
  assert.equal(contract.modules.length, 14, "the demo has fourteen operational/reference modules outside Owner Studio");
  assert.deepEqual(contract.departments, ["stickney", "fermilab"]);
  assert.equal(new Set(contract.modules.map((module) => module.demoId)).size, contract.modules.length, "demo module ids must be unique");
  assert.equal(new Set(contract.modules.map((module) => module.foundationKey)).size, contract.modules.length, "foundation keys must be unique");
  for (const contractModule of contract.modules) {
    assert.match(demo, new RegExp(contractModule.demoLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${contractModule.demoLabel} must remain in the owner demo`);
    assert.match(foundation, new RegExp(`key: "${contractModule.foundationKey}"`), `${contractModule.foundationKey} must remain in the shared department foundation`);
    const renderer = await read(...contractModule.renderer.split("/"));
    for (const marker of contractModule.requiredMarkers) assert.ok(renderer.includes(marker), `${contractModule.demoLabel} is missing the shared capability marker: ${marker}`);
  }
  assert.match(page, /const \{ slug \} = await params/);
  assert.match(page, /getDepartmentBySlug\(slug\)/);
  assert.match(page, /getDepartmentSource\(department\.slug\)/);
  assert.match(page, /<CommandCenterWorkspace/);
  assert.match(page, /<ActiveIncidentWorkspace/);
  assert.match(page, /<PayrollWorkspace/);
});

test("Stickney, Fermilab, and future departments use one tenant-safe application foundation", async () => {
  const [contractText, sourceRegistry, stickney, fermilab, page] = await Promise.all([
    read("foundation", "demo-department-parity.json"),
    read("db", "department-source.ts"),
    read("db", "stickney.ts"),
    read("db", "fermilab.ts"),
    read("app", "d", "[slug]", "page.tsx"),
  ]);
  const contract = JSON.parse(contractText);
  for (const slug of contract.departments) assert.match(sourceRegistry, new RegExp(`${slug}: \\{`));
  for (const key of ["staffing", "scheduling", "payroll", "preplans", "hydrants", "fleet", "inventory", "duties", "documents", "phones"]) {
    assert.ok(stickney.includes(`module === "${key}"`) || stickney.includes(`module === "${key}" ||`), `Stickney adapter must keep ${key}`);
    assert.ok(fermilab.includes(`module === "${key}"`) || fermilab.includes(`module === "${key}" ||`), `Fermilab adapter must keep ${key}`);
  }
  assert.match(page, /Every department slug uses this shared route/);
  assert.doesNotMatch(page, /slug === "stickney"|slug === "fermilab"/);
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
