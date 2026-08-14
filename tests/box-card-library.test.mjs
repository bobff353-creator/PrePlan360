import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

test("owner Box Cards are grouped, importable, editable, and downloadable", async () => {
  const [html, script, css, demoPage, ownerPage] = await Promise.all([
    read("public/fireflow-360-demo.html"),
    read("public/box-cards-upgrade.js"),
    read("public/box-cards-upgrade.css"),
    read("app/demo/page.tsx"),
    read("app/owner/demo/page.tsx"),
  ]);

  assert.match(html, /box-cards-upgrade\.css/);
  assert.match(html, /box-cards-upgrade\.js/);
  assert.match(script, /GROUPED BOX CARD LIBRARY/);
  assert.match(script, /Box Card groups by town/);
  assert.match(script, /Transform a source into an editable Box Card draft/);
  assert.match(script, /\.pdf,.png,.jpg/);
  assert.match(script, /indexedDB\.open/);
  assert.match(script, /Download editable/);
  assert.match(script, /Download CSV/);
  assert.match(script, /Print \/ Save PDF/);
  assert.match(script, /syncLegacyCards/);
  assert.match(script, /assignmentCells/);
  assert.match(script, /decodeURIComponent/);
  assert.match(script, /oninput="bcSetCell/);
  assert.match(css, /\.bc-groups/);
  assert.match(demoPage, /module === "box-cards"/);
  assert.match(demoPage, /requireOwnerUser/);
  assert.match(demoPage, /isOwner\(owner\.userId\)/);
  assert.match(ownerPage, /Open Box Card workbench/);
});

test("only owner demo edits while public and department builds stay protected", async () => {
  const [script, departmentPage, propagation] = await Promise.all([
    read("public/box-cards-upgrade.js"),
    read("app/d/[slug]/page.tsx"),
    read("foundation/propagation.json"),
  ]);

  assert.match(script, /insideVerifiedOwnerDemo/);
  assert.match(script, /window\.parent\.location\.href/);
  assert.match(script, /const admin = params\.get\("view"\) !== "readonly" && insideVerifiedOwnerDemo\(\)/);
  assert.match(script, /if \(!admin\) return/);
  assert.match(script, /if \(!admin \|\| !confirm/);
  assert.match(departmentPage, /<DocumentsFoundation owner=\{owner\}/);
  assert.match(departmentPage, /data-box-card-release="owner-preview"/);
  assert.match(departmentPage, /aria-label="Box Card publishing status"/);
  assert.match(departmentPage, /Department records not published/);
  assert.match(departmentPage, /Only the signed-in, verified platform owner can build drafts/);
  assert.match(propagation, /"box-cards-and-documents"/);
  assert.match(propagation, /public\/box-cards-upgrade\.js/);
  assert.match(propagation, /app\/d\/\[slug\]\/documents-workspace\.tsx/);
});

test("department Box Cards use real town groups, protected edits, and downloads", async () => {
  const [workspace, stickneyWorkspace, styles] = await Promise.all([
    read("app/d/[slug]/documents-workspace.tsx"),
    read("app/d/[slug]/stickney-workspace.tsx"),
    read("app/stickney-workspace.css"),
  ]);

  assert.match(stickneyWorkspace, /<DocumentsWorkspace/);
  assert.match(workspace, /new Set\(boxCards\.map/);
  assert.match(workspace, /Box Card groups by town/);
  assert.match(workspace, /role="tab"/);
  assert.match(workspace, /data-grouped-box-cards="active"/);
  assert.match(workspace, /if \(!editable\) return null/);
  assert.match(workspace, /Download original/);
  assert.match(workspace, /Download editable/);
  assert.match(workspace, /Print \/ Save PDF/);
  assert.match(workspace, /never delete or rewrite the source/);
  assert.match(styles, /\.box-group-tabs/);
  assert.match(styles, /\.department-box-grid/);
});
