import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("demo Respond keeps the desktop command view on one screen", async () => {
  const [script, styles] = await Promise.all([
    read("public/respond-upgrade.js"),
    read("public/respond-upgrade.css"),
  ]);
  assert.match(script, /rspCommandDeck\(match\)/);
  assert.match(script, /rsp-command-grid/);
  assert.match(script, /Construction/);
  assert.match(script, /Hydrant status/);
  assert.match(script, /Critical hazards/);
  assert.match(script, /A-side view/);
  assert.match(script, /Current CAD notes/);
  assert.match(script, /Exact-address history/);
  assert.match(script, /Area history/);
  assert.match(script, /map_action=pano/);
  assert.match(script, /No building hazards, systems, Knox, hydrants, or fire-flow values are inferred/);
  assert.match(styles, /#main:has\(\.respond-upgrade\)\{overflow:hidden/);
  assert.match(styles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.rsp-command-context\{grid-column:1\/-1/);
});

test("all department Respond pages inherit the compact editable foundation", async () => {
  const [component, styles] = await Promise.all([
    read("app/d/[slug]/module-builder.tsx"),
    read("app/module-builder.css"),
  ]);
  assert.match(component, /<RespondWorkspace/);
  assert.match(component, /CAD not connected/);
  assert.match(component, /Preplan intelligence/);
  assert.match(component, /A-side view/);
  assert.match(component, /Current CAD notes/);
  assert.match(component, /Exact-address history/);
  assert.match(component, /Area history/);
  assert.match(component, /Locate for Street View/);
  assert.match(component, /Configure Respond and manage records/);
  assert.match(styles, /\.dept-app-content:has\(\.respond-department-workspace\)/);
  assert.match(styles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.respond-department-context\{grid-column:1\/-1/);
});
