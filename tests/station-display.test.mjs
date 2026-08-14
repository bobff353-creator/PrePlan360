import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (...parts) => readFile(path.join(root, ...parts), "utf8");

test("owner demo provides a persistent 24/7 display with a 3 AM inner-app refresh", async () => {
  const [page, shell, demo, station] = await Promise.all([
    read("app", "demo", "page.tsx"),
    read("app", "station-display-button.tsx"),
    read("public", "live-ops-custom.js"),
    read("public", "station-display.js"),
  ]);
  assert.match(page, /StationDisplayButton/);
  assert.match(page, /station=1/);
  assert.match(shell, /setHours\(3, 0, 0, 0\)/);
  assert.match(shell, /requestFullscreen/);
  assert.match(shell, /wakeLock/);
  assert.match(shell, /setRefreshKey\(Date\.now\(\)\)/);
  assert.match(demo, /responseSec: 90/);
  assert.match(station, /preplan360:station-incident/);
  assert.match(station, /current = "board"/);
});

test("every department uses the authenticated incident watcher and 90 second foundation default", async () => {
  const [page, monitor, route, foundation] = await Promise.all([
    read("app", "d", "[slug]", "page.tsx"),
    read("app", "station-incident-monitor.tsx"),
    read("app", "api", "departments", "[id]", "active-incident", "route.ts"),
    read("db", "foundation.ts"),
  ]);
  assert.match(page, /StationIncidentMonitor/);
  assert.match(page, /station-embedded/);
  assert.match(monitor, /setTimeout\(poll, 5000\)/);
  assert.match(monitor, /module=respond&station=1/);
  assert.match(monitor, /responseSeconds/);
  assert.match(route, /canAccessDepartment/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /item_type === "incident".*operational_status === "active"/s);
  assert.match(foundation, /response_duration_seconds: 90/);
});
