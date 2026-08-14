import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("the owner demo uses compact military-time weather and radar priority", async () => {
  const [script, styles] = await Promise.all([
    read("public/live-ops-custom.js"),
    read("public/live-ops-priority.css"),
  ]);
  assert.match(script, /rotationSec: 12/);
  assert.match(script, /radarRefreshMin: 5/);
  assert.match(script, /radarDisplaySec: 30/);
  assert.match(script, /severeRadarSec: 90/);
  assert.match(script, /function militaryTime/);
  assert.match(script, /TODAY · SIMULATED|TOMORROW · SIMULATED|NEXT 5 HOURS · SIMULATED/);
  assert.match(script, /Riding [Aa]ssignments/);
  assert.match(script, /if \(toneOn\) \{ if \(radarTakeover\) closeRadarTakeover/);
  assert.match(script, /Simulate incident override/);
  assert.match(styles, /body\.live-ops-display \.brand,body\.live-ops-display \.top/);
  assert.match(styles, /radar-takeover\.severe/);
});

test("every department inherits weather, radar, real records, visibility, and Respond priority", async () => {
  const [board, page, stickney, foundation, schema, migration, css] = await Promise.all([
    read("app/d/[slug]/live-ops-board.tsx"),
    read("app/d/[slug]/page.tsx"),
    read("db/stickney.ts"),
    read("db/foundation.ts"),
    read("db/schema.ts"),
    read("drizzle/0014_live_ops_weather_priority.sql"),
    read("app/live-ops-foundation.css"),
  ]);
  assert.match(page, /departmentSlug=\{department\.slug\}/);
  assert.match(page, /weatherLocation=\{department\.weather_location\}/);
  assert.match(page, /sourceData=\{stickneyData\}/);
  assert.match(page, /assets=\{liveOpsAssets\}/);
  assert.match(page, /"dashboard", "live-ops", "staffing"/);
  assert.match(board, /router\.replace\(`\/d\/\$\{departmentSlug\}\?module=respond/);
  assert.match(board, /setWeatherIndex/);
  assert.match(board, /setApparatusIndex/);
  assert.match(board, /live_board_show_next_shift \?/);
  assert.match(board, /live_board_radar_display_seconds/);
  assert.match(board, /live_board_severe_radar_seconds/);
  assert.match(board, /function militaryTime/);
  assert.match(board, /sourceData\?\.apparatus/);
  assert.match(board, /sourceData\?\.schedule/);
  assert.match(board, /assets\.filter/);
  assert.match(board, /ridingAssignments\.length \? `\$\{ridingAssignments\.length\} scheduled`/);
  assert.match(stickney, /if \(module === "live-ops"\)/);
  assert.match(stickney, /where s\.status='filled' and en\.entry_date='\$\{today\}'/);
  assert.match(stickney, /fleetApparatus\(\)/);
  assert.match(foundation, /board_rotation_seconds: 12/);
  assert.match(foundation, /live_board_radar_refresh_minutes: 5/);
  assert.match(foundation, /live_board_show_next_shift: true/);
  assert.match(schema, /liveBoardSevereRadarSeconds/);
  assert.match(migration, /UPDATE department_foundation_settings SET board_rotation_seconds = 12/);
  assert.match(css, /\.live-radar-takeover\.severe/);
});

test("department weather is authenticated and sourced from the National Weather Service", async () => {
  const route = await read("app/api/departments/[id]/weather/route.ts");
  assert.match(route, /canAccessDepartment/);
  assert.match(route, /https:\/\/api\.weather\.gov\/points/);
  assert.match(route, /https:\/\/api\.weather\.gov\/alerts\/active\?point=/);
  assert.match(route, /User-Agent/);
  assert.match(route, /Save the department weather location as verified latitude, longitude coordinates/);
  assert.match(route, /Weather source temporarily unavailable/);
  assert.doesNotMatch(route, /Math\.random|fictional|demo forecast/i);
});

test("the propagation contract covers both demo and shared department implementation", async () => {
  const propagation = JSON.parse(await read("foundation/propagation.json"));
  const liveOps = propagation.modules["live-operations"];
  assert.ok(liveOps.demo.includes("public/live-ops-custom.js"));
  assert.ok(liveOps.demo.includes("public/live-ops-priority.css"));
  assert.ok(liveOps.departments.includes("app/d/[slug]/live-ops-board.tsx"));
  assert.ok(liveOps.departments.includes("app/api/departments/[id]/weather/route.ts"));
  assert.ok(liveOps.departments.includes("db/stickney.ts"));
  assert.ok(liveOps.departments.includes("drizzle/0014_live_ops_weather_priority.sql"));
});
