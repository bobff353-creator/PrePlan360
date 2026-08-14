import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calendarShiftDateLabel,
  nextCalendarShift,
  normalizeImportedScheduleText,
  scheduleDisplayName,
} from "../app/d/[slug]/schedule-format.ts";

test("demo calendar uses saved shift colors and rotates crowded days", async () => {
  const source = await readFile(
    new URL("../public/schedule-calendar.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /function schxCalendar\(/);
  assert.match(source, /schxTemplate\(shift\.templateId\)/);
  assert.match(source, /schxCalendarAutoTick/);
  assert.match(source, /Multiple schedules rotate/);
  assert.match(source, /function schxCalendarOpenDay/);
  assert.match(source, /class=\"schx-day-view\"/);
  assert.match(source, /Open schedule/);
  assert.match(source, /schxCoverage\(shift\)/);
  assert.match(source, /BELOW MINIMUM/);
  assert.match(source, /coverage\.total < coverage\.minimum/);
});

test("shared department calendar groups schedule rows and offers slide controls", async () => {
  const [calendar, workspace, route, propagation, foundation, editor, migration] = await Promise.all([
    readFile(
      new URL("../app/d/[slug]/schedule-calendar.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/d/[slug]/stickney-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/departments/[id]/stickney-records/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../foundation/propagation.json", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../db/foundation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/owner/demo/foundation-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0017_schedule_minimum_staffing.sql", import.meta.url), "utf8"),
  ]);
  assert.match(calendar, /Map\.groupBy\(groups/);
  assert.match(calendar, /window\.setInterval/);
  assert.match(calendar, /Shift colors follow the saved shift setup/);
  assert.match(calendar, /setSelectedDate\(date\)/);
  assert.match(calendar, /className=\"schedule-day-view\"/);
  assert.match(calendar, /assignment\.role, assignment\.rank/);
  assert.match(calendar, /minimumStaffing > 0/);
  assert.match(calendar, /BELOW MINIMUM/);
  assert.match(calendar, /eligibleAssignmentIds/);
  assert.match(workspace, /name="shift_color"/);
  assert.match(workspace, /rows\.filter\(eligible\)/);
  assert.match(route, /data\.shift_color/);
  assert.match(propagation, /schedule-calendar\.tsx/);
  assert.match(foundation, /minimum_staffing/);
  assert.match(editor, /name="minimum_staffing"/);
  assert.match(migration, /ADD `minimum_staffing`/);
});

test("Stickney imported shift names decode cleanly without repeating their saved times", () => {
  assert.equal(
    normalizeImportedScheduleText("Imported 18:00\u00e2\u20ac\u201c06:00"),
    "Imported 18:00–06:00",
  );
  assert.equal(
    scheduleDisplayName("Imported 18:00\u00e2\u20ac\u201c06:00", "18:00", "06:00"),
    "Imported shift",
  );
  assert.equal(scheduleDisplayName("Red 1", "18:00", "06:00"), "Red 1");
});

test("Live Ops selects the next calendar start and groups its assigned members", () => {
  const rows = [
    { id: "past", work_date: "2026-08-14", shift_name: "Gold", start_time: "06:00", end_time: "12:00", employee_id: "one" },
    { id: "next-1", work_date: "2026-08-14", shift_name: "Imported 18:00\u00e2\u20ac\u201c06:00", start_time: "18:00", end_time: "06:00", employee_id: "two" },
    { id: "next-2", work_date: "2026-08-14", shift_name: "Imported 18:00\u00e2\u20ac\u201c06:00", start_time: "18:00", end_time: "06:00", employee_id: "three" },
    { id: "later", work_date: "2026-08-15", shift_name: "Black", start_time: "07:00", end_time: "12:00", employee_id: "four" },
  ];
  const now = new Date("2026-08-14T12:30:00");
  const next = nextCalendarShift(rows, now);
  assert.equal(next?.shiftName, "Imported shift");
  assert.equal(next?.startTime, "18:00");
  assert.equal(next?.assignmentCount, 2);
  assert.equal(calendarShiftDateLabel(next?.workDate || "", now), "Today");
});
