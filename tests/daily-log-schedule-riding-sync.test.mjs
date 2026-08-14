import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

function dailyLogContext(source) {
  const date = "2026-08-14";
  const values = new Map([
    ["fireflow360.dailyLog.demo.v1", JSON.stringify({
      [date]: {
        date,
        createdAt: "2026-08-14T00:00:00.000Z",
        updatedAt: "2026-08-14T00:00:00.000Z",
        staffing: [],
        calls: [{ id: "saved-call", reportNumber: "26-100" }],
        notes: "Saved before schedule approval",
        equipment: {},
        signIn: false,
        signOut: false,
        staffingSource: "none",
        scheduleName: "",
      },
    })],
  ]);
  const members = [
    { id: "officer", name: "Chief A. Morgan", rank: "Chief" },
    { id: "driver", name: "FF J. Mercer", rank: "Firefighter" },
    { id: "medic", name: "FF/PM S. Hale", rank: "Firefighter / Paramedic" },
    { id: "unscheduled", name: "FF Not Scheduled", rank: "Firefighter" },
  ];
  const templates = [
    { id: "day", start: "07:00", end: "19:00", minimum: 2 },
    { id: "night", start: "19:00", end: "07:00", minimum: 1 },
  ];
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
    window: { print() {} },
    current: "not-log",
    render() {},
    head() { return ""; },
    footer() { return ""; },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, value); },
    },
    rstEsc(value) { return String(value ?? ""); },
    rstMember(id) { return members.find((member) => member.id === id) || null; },
    schxTemplate(id) { return templates.find((template) => template.id === id) || null; },
    SCHX: {
      templates,
      shifts: [
        { id: "draft", templateId: "day", date, name: "Draft shift", status: "draft", assignments: [{ memberId: "unscheduled", role: "Firefighter", unit: "E-9" }] },
        { id: "day-shift", templateId: "day", date, name: "Day tour", status: "approved", assignments: [{ memberId: "officer", role: "Officer", unit: "C-1" }, { memberId: "driver", role: "Driver / Engineer", unit: "E-1" }] },
        { id: "night-shift", templateId: "night", date, name: "Night tour", status: "approved", assignments: [{ memberId: "medic", role: "Medic", unit: "M-1" }] },
      ],
    },
  };
  vm.runInNewContext(`${source}\n;globalThis.__dailyLogTest={dlScheduled,dlRecord,dlSetDate,dlEmployeeOptions,dlRidingSummary};`, context);
  return { api: context.__dailyLogTest, date };
}

test("approved calendar shifts hydrate a previously empty Daily Log with saved role, unit, and hours", async () => {
  const source = await read("public/daily-log-demo.js");
  const { api, date } = dailyLogContext(source);
  const scheduled = api.dlScheduled(date);

  assert.deepEqual(Array.from(scheduled.shifts, (shift) => shift.id), ["day-shift", "night-shift"]);
  assert.deepEqual(Array.from(scheduled.rows, (row) => row.position), ["Officer", "Driver / Engineer", "Medic"]);
  assert.deepEqual(Array.from(scheduled.rows, (row) => `${row.timeIn}-${row.timeOut}`), ["0700-1900", "0700-1900", "1900-0700"]);

  const record = api.dlRecord(date);
  assert.equal(record.staffingSource, "approved_schedule");
  assert.equal(record.staffing.length, 3);
  assert.equal(record.calls[0].id, "saved-call");
  assert.equal(record.notes, "Saved before schedule approval");
});

test("Daily Log name adjustments feed Live Ops and employee choices stay limited to that date", async () => {
  const source = await read("public/daily-log-demo.js");
  const { api, date } = dailyLogContext(source);
  const record = api.dlRecord(date);
  record.staffing[1].memberId = "medic";
  api.dlSetDate(date);

  const choices = api.dlEmployeeOptions(record);
  assert.deepEqual(Array.from(choices, (member) => member.id).sort(), ["driver", "medic", "officer"]);
  assert.equal(api.dlRidingSummary(date).assignments[1].name, "FF/PM S. Hale");
  assert.equal(api.dlRidingSummary(date).officer.name, "Chief A. Morgan");
  assert.equal(api.dlRidingSummary(date).minimum, 3);
});

test("the owner and department Live Ops boards both render schedule-backed riding roles", async () => {
  const [demoBoard, departmentBoard, stickney] = await Promise.all([
    read("public/live-ops-custom.js"),
    read("app/d/[slug]/live-ops-board.tsx"),
    read("db/stickney.ts"),
  ]);

  assert.match(demoBoard, /typeof dlRidingSummary === "function"/);
  assert.match(demoBoard, /Daily Log name and unit adjustments appear here/);
  assert.doesNotMatch(demoBoard, /DEMO_RIDING\.map/);
  assert.match(departmentBoard, /rank: item\.rank/);
  assert.match(departmentBoard, /item\.role} \$\{item\.rank}/);
  assert.match(stickney, /where s\.status='filled' and en\.entry_date='\$\{today\}'/);
});
