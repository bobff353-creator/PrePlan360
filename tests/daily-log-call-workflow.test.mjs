import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

function workflowContext(source) {
  const values = new Map();
  let noteText = "";
  const context = {
    console,
    Date,
    Math,
    Object,
    Array,
    Set,
    Map,
    URLSearchParams,
    location: { search: "?owner=1" },
    current: "not-log",
    render() {},
    head() { return ""; },
    footer() { return ""; },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, value); },
    },
    document: {
      getElementById(id) {
        return id.startsWith("dl-call-note-input-") ? { value: noteText } : null;
      },
    },
    window: { print() {}, addEventListener() {} },
    PREPLANS: [{ id: "main", name: "Main Street School", addr: "100 Main Street" }],
    IMPORTS: [{ name: "Main Street Annex", addr: "104 Main Street" }],
    FLEET: [["E-1", "Engine", "in_service"], ["T-2", "Truck", "in_service"], ["M-3", "Medic", "in_service"]],
  };
  vm.runInNewContext(`${source}\n;globalThis.__dailyCallWorkflow={dlSetDate,dlAddCall,dlRecord,dlAddressMatches,dlSelectAddress,dlToggleUnit,dlAddCallNote,dlCurrentCadNotes,dlCalls};`, context);
  return {
    api: context.__dailyCallWorkflow,
    setNote(value) { noteText = value; },
  };
}

test("Daily Log calls match preplans, select several apparatus, and publish timestamped CAD notes", async () => {
  const source = await read("public/daily-log-demo.js");
  const { api, setNote } = workflowContext(source);
  const date = "2026-08-14";
  api.dlSetDate(date);
  api.dlAddCall();
  const record = api.dlRecord(date);
  const call = record.calls[0];

  assert.deepEqual(Array.from(api.dlAddressMatches("100 main"), (item) => item.name), ["Main Street School"]);
  api.dlSelectAddress(call.id, "preplan-main");
  assert.equal(call.address, "100 Main Street");
  assert.equal(call.preplanId, "main");

  api.dlToggleUnit(call.id, "E-1", true);
  api.dlToggleUnit(call.id, "T-2", true);
  assert.deepEqual(Array.from(call.unitIds), ["E-1", "T-2"]);
  assert.equal(call.units, "E-1, T-2");

  setNote("Primary search complete; checking attic access.");
  api.dlAddCallNote(call.id);
  const notes = api.dlCurrentCadNotes("100 Main St");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, "Primary search complete; checking attic access.");
  assert.match(notes[0].time, /^\d{6}$/);

  const markup = api.dlCalls(record);
  assert.match(markup, /Type to search preplans|Preplan · Main Street School/);
  assert.match(markup, /Responding units/);
  assert.match(markup, /Add timestamped note/);
  assert.match(markup, /Updates appear in Respond CAD notes/);
});

test("all department apps inherit the server-backed Daily Log call workflow", async () => {
  const [foundation, page, workspace, route, respond] = await Promise.all([
    read("db/foundation.ts"),
    read("app/d/[slug]/page.tsx"),
    read("app/d/[slug]/daily-log-workspace.tsx"),
    read("app/api/departments/[id]/daily-log/route.ts"),
    read("app/d/[slug]/respond-cad-notes.tsx"),
  ]);
  assert.match(foundation, /key: "daily-log", label: "Daily Log"/);
  assert.match(foundation, /insertMissingModules/);
  assert.match(page, /<DailyLogWorkspace/);
  assert.match(page, /loadStickneyModule\("fleet", department\.id\)/);
  assert.match(page, /listDepartmentPreplans/);
  assert.match(workspace, /Type to search saved preplans and prior addresses/);
  assert.match(workspace, /Responding units/);
  assert.match(workspace, /Add timestamped note/);
  assert.match(route, /module_key='daily-log'/);
  assert.match(route, /action === "note"/);
  assert.match(route, /record_status='archived'/);
  assert.match(respond, /setInterval\(refresh, 5000\)/);
});
