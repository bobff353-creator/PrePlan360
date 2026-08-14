import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the owner demo can hide equipment accountability without deleting its values", async () => {
  const [dailyLog, owner, styles] = await Promise.all([
    read("public/daily-log-demo.js"),
    read("public/owner-upgrade.js"),
    read("public/daily-log-demo.css"),
  ]);

  assert.match(owner, /dailyLogEquipmentAccountability:true/);
  assert.match(owner, /Show Equipment Accountability/);
  assert.match(dailyLog, /dlSetEquipmentAccountability/);
  assert.match(dailyLog, /const equipmentPanel = showEquipment\s*\?/);
  assert.match(dailyLog, /hiding changes the layout, not saved checklist values/);
  assert.match(styles, /\.dl-lower\.equipment-hidden\{grid-template-columns:1fr\}/);
});

test("the saved owner foundation supports inherited and per-department visibility", async () => {
  const [foundation, route, editor, schema, migration, departmentPage] = await Promise.all([
    read("db/foundation.ts"),
    read("app/api/owner/foundation/route.ts"),
    read("app/owner/demo/foundation-editor.tsx"),
    read("db/schema.ts"),
    read("drizzle/0013_daily_log_display.sql"),
    read("app/d/[slug]/page.tsx"),
  ]);

  assert.match(foundation, /daily_log_equipment_accountability: true/);
  assert.match(foundation, /settings\.daily_log_equipment_accountability \? 1 : 0/);
  assert.match(route, /daily_log_equipment_accountability: form\.has/);
  assert.match(editor, /name="daily_log_equipment_accountability"/);
  assert.match(departmentPage, /data-daily-log-equipment-accountability/);
  assert.equal((schema.match(/integer\("daily_log_equipment_accountability"\)/g) || []).length, 2);
  assert.equal((migration.match(/ADD `daily_log_equipment_accountability`/g) || []).length, 2);
});
