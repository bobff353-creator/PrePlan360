import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { configPath, currentModuleHashes, lockPath, projectRoot, readJson } from "../scripts/foundation-propagation-lib.mjs";

test("all department builds share the dynamic department route", async () => {
  const [page, styles] = await Promise.all([
    readFile(path.join(projectRoot, "app", "d", "[slug]", "page.tsx"), "utf8"),
    readFile(path.join(projectRoot, "app", "department-app.css"), "utf8"),
  ]);
  assert.match(page, /getDepartmentBySlug\(slug\)/);
  assert.match(page, /getDepartmentFoundation\(department\.id\)/);
  assert.match(page, /orderedVisibleModules\(foundation\)/);
  assert.match(page, /<LiveOpsBoard/);
  assert.match(page, /id="dept-sidebar-expanded"/);
  assert.match(page, /className="dept-sidebar-copy dept-nav-label"/);
  assert.match(styles, /grid-template-columns:76px minmax\(0,1fr\)/);
  assert.match(styles, /:has\(\.dept-sidebar-toggle:checked\)\{grid-template-columns:240px/);
  assert.equal((page.match(/department\.slug === "stickney"/g) || []).length, 1, "Only the legacy-data adapter may specialize Stickney; the application shell and foundation stay shared.");
  assert.doesNotMatch(page, /department\.slug === "fermilab"/);
});

test("the foundation propagation lock covers every mapped demo and department implementation", async () => {
  const [config, lock] = await Promise.all([readJson(configPath), readJson(lockPath)]);
  assert.equal(config.release, lock.release);
  assert.equal(lock.sharedDepartmentRoute, "app/d/[slug]/page.tsx");
  assert.equal(lock.futureDepartments, "automatic-through-shared-route");
  assert.deepEqual(lock.currentDepartments, ["stickney", "fermilab"]);
  const current = await currentModuleHashes(config);
  assert.deepEqual(current, lock.modules);
});
