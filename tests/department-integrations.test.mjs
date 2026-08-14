import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("department build exposes the shared secure integration center", async () => {
  const [page, center, route, migration] = await Promise.all([
    read("app/departments/[id]/page.tsx"),
    read("app/departments/integration-center.tsx"),
    read("app/api/departments/[id]/integrations/route.ts"),
    read("drizzle/0016_department_integrations.sql"),
  ]);
  assert.match(page, /DepartmentIntegrationCenter/);
  assert.match(center, /Google Maps platform/);
  assert.match(center, /Direct CAD webhook/);
  assert.match(center, /Resend inbound CAD email/);
  assert.match(center, /Department server backup/);
  assert.match(route, /canAdminDepartment/);
  assert.match(route, /encryptIntegrationSecret/);
  assert.match(migration, /department_integrations/);
  assert.match(migration, /department_export_deliveries/);
});

test("department preplans use Google Maps when configured and expose setup when not", async () => {
  const [map, demoMap] = await Promise.all([
    readFile(new URL("../app/d/[slug]/preplan-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/preplans-upgrade.js", import.meta.url), "utf8"),
  ]);
  assert.match(map, /maps\.googleapis\.com\/maps\/api\/js/);
  assert.match(map, /new google\.maps\.Polygon/);
  assert.match(map, /new google\.maps\.Marker/);
  assert.match(map, /Set up Google Maps/);
  assert.match(map, /departments\/\$\{departmentId\}#integrations/);
  assert.match(demoMap, /Real department builds overlay saved building footprints and hydrants on Google Maps/);
  assert.match(demoMap, /Open department builds/);
});

test("nightly export is HTTPS-only, signed, and excludes credentials", async () => {
  const [delivery, cron, vercel] = await Promise.all([
    read("app/lib/department-export.ts"),
    read("app/api/cron/nightly-department-exports/route.ts"),
    read("vercel.json"),
  ]);
  assert.match(delivery, /url\.protocol !== "https:"/);
  assert.match(delivery, /x-preplan-signature/);
  assert.match(delivery, /password hashes/);
  assert.match(delivery, /raw webhook payloads/);
  assert.doesNotMatch(delivery, /SELECT \* FROM/);
  assert.match(cron, /CRON_SECRET/);
  assert.match(vercel, /0 7 \* \* \*/);
});

test("department webhooks require signatures and preserve mapped-not-dispatched status", async () => {
  const [cad, resend] = await Promise.all([
    read("app/api/webhooks/cad/[departmentId]/route.ts"),
    read("app/api/webhooks/resend/[departmentId]/route.ts"),
  ]);
  assert.match(cad, /verifyCadSignature/);
  assert.match(cad, /mapped_not_dispatched/);
  assert.match(resend, /webhooks\.verify/);
  assert.match(resend, /resend_receiving_address/);
  assert.match(resend, /mapped_not_dispatched/);
});
