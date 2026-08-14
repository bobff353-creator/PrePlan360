import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

test("owner policy library avoids long pages and opens one policy at a time", async () => {
  const [loader, script, css] = await Promise.all([
    read("public/box-cards-upgrade.js"),
    read("public/policies-upgrade.js"),
    read("public/policies-upgrade.css"),
  ]);

  assert.match(loader, /policies-upgrade\.css/);
  assert.match(loader, /policies-upgrade\.js/);
  assert.match(script, /const PAGE_SIZE = 6/);
  assert.match(script, /Search or filter first, then open one document at a time/);
  assert.match(script, /Policy categories/);
  assert.match(script, /Search policy documents/);
  assert.match(script, /allowReadonlySearch/);
  assert.match(script, /role="dialog"/);
  assert.match(script, /plOpen/);
  assert.match(script, /Print \/ Save PDF/);
  assert.match(script, /insideVerifiedOwnerDemo/);
  assert.match(script, /if \(!admin\) return/);
  assert.match(css, /\.pl-policy-list/);
  assert.match(css, /max-height:calc\(100vh - 36px\)/);
});

test("department policy library searches, pages, and opens real policy bodies", async () => {
  const [workspace, route, styles, propagation] = await Promise.all([
    read("app/d/[slug]/documents-workspace.tsx"),
    read("app/d/[slug]/page.tsx"),
    read("app/stickney-workspace.css"),
    read("foundation/propagation.json"),
  ]);

  assert.match(workspace, /const policyPageSize = 8/);
  assert.match(workspace, /Find a policy, SOG, or SOP/);
  assert.match(workspace, /Policy categories/);
  assert.match(workspace, /setSelectedPolicyId\(policy\.id\)/);
  assert.match(workspace, /role="dialog"/);
  assert.match(workspace, /selectedPolicy\.body/);
  assert.match(workspace, /if \(!editable\) return null/);
  assert.match(styles, /\.department-policy-list/);
  assert.match(styles, /\.department-policy-reader/);
  assert.match(route, /Policy and grouped Box Card foundation ready/);
  assert.match(route, /searchable, paged policy library with a focused document reader/);
  assert.match(propagation, /public\/policies-upgrade\.js/);
  assert.match(propagation, /app\/d\/\[slug\]\/documents-workspace\.tsx/);
});
