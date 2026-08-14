import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

test("owner demo loads a usable Inspection development workbench", async () => {
  const [html, script, css, demoPage, ownerPage] = await Promise.all([
    read("public/fireflow-360-demo.html"),
    read("public/inspections-owner.js"),
    read("public/inspections-owner.css"),
    read("app/demo/page.tsx"),
    read("app/owner/demo/page.tsx"),
  ]);

  assert.match(html, /inspections-owner\.css/);
  assert.match(html, /inspections-owner\.js/);
  assert.match(script, /preplan360\.inspectionOwner\.v1/);
  assert.match(script, /Inspections · Owner Build/);
  assert.match(script, /Owner workbench available/);
  assert.match(script, /Start draft inspection/);
  assert.match(script, /Admin studio/);
  assert.match(script, /localStorage\.setItem/);
  assert.match(css, /\.insp-dev/);
  assert.match(demoPage, /module === "inspections"/);
  assert.match(ownerPage, /Open Inspection workbench/);
});

test("public and department views keep Inspection records protected", async () => {
  const [script, viewOnly, departmentPage, propagation] = await Promise.all([
    read("public/inspections-owner.js"),
    read("public/view-only-demo.js"),
    read("app/d/[slug]/page.tsx"),
    read("foundation/propagation.json"),
  ]);

  assert.match(script, /params\.get\("view"\) === "readonly"/);
  assert.match(script, /if \(readOnly\) return/);
  assert.match(viewOnly, /view-only-demo/);
  assert.match(departmentPage, /<ComingSoon owner=\{owner\}/);
  assert.match(departmentPage, /Department publishing locked/);
  assert.match(departmentPage, /data-inspection-release="owner-preview"/);
  assert.match(departmentPage, /remain protected from every department/);
  assert.match(propagation, /"inspections"/);
  assert.match(propagation, /public\/inspections-owner\.js/);
  assert.match(propagation, /app\/d\/\[slug\]\/page\.tsx/);
});
