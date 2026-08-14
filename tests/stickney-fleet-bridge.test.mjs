import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../db/stickney.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../app/d/[slug]/fleet-workspace.tsx", import.meta.url), "utf8");

test("Stickney apparatus checks use the department-filtered Fleet bridge", () => {
  assert.match(source, /from stickney_inventory_checks c/);
  assert.match(source, /left join stickney_inventory_check_items i/);
  assert.match(source, /from stickney_inventory_readiness_exceptions/);
  assert.match(source, /from stickney_inventory_work_orders/);
  assert.doesNotMatch(source, /from inventory_checks c left join inventory_check_items i/);
});

test("the Apparatus workspace exposes daily and weekly connected check activity", () => {
  assert.match(workspace, /Daily, weekly, inventory, and air-pack checks/);
  assert.match(workspace, /checks\.map\(\(check\)/);
  assert.match(workspace, /check\.item_count/);
  assert.match(workspace, /check\.pending_count/);
  assert.match(workspace, /check\.failed_count/);
  assert.match(workspace, /check\.latest_odometer/);
});
