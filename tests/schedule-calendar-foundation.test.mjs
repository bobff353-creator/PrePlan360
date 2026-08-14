import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calendarShiftDateLabel,
  nextCalendarShift,
  normalizeImportedScheduleText,
  scheduleDisplayName,
  scheduleStaffingLabel,
  scheduleStaffingSummary,
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
  assert.match(source, /open shift/);
  assert.match(source, /Verify roles/);
  assert.match(source, /coverage\.total < coverage\.minimum/);
});

test("shared department calendar groups schedule rows and offers slide controls", async () => {
  const [calendar, workspace, route, propagation, foundation, editor, migration, requestUi, requestApi, requestMigration] = await Promise.all([
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
    readFile(new URL("../app/d/[slug]/schedule-requests-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/departments/[id]/schedule-requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0018_department_schedule_requests.sql", import.meta.url), "utf8"),
  ]);
  assert.match(calendar, /Map\.groupBy\(groups/);
  assert.match(calendar, /window\.setInterval/);
  assert.match(calendar, /Shift colors follow the saved shift setup/);
  assert.match(calendar, /setSelectedDate\(date\)/);
  assert.match(calendar, /className=\"schedule-day-view\"/);
  assert.match(calendar, /assignment\.role, assignment\.rank/);
  assert.match(calendar, /minimumStaffing > 0/);
  assert.match(calendar, /scheduleStaffingLabel/);
  assert.match(calendar, /openShifts/);
  assert.match(calendar, /eligibleAssignmentIds/);
  assert.match(calendar, /UPCOMING SHIFTS/);
  assert.match(calendar, /Calendar view/);
  assert.match(calendar, /List view/);
  assert.match(workspace, /name="shift_color"/);
  assert.match(workspace, /rows\.filter\(eligible\)/);
  assert.match(route, /data\.shift_color/);
  assert.match(propagation, /schedule-calendar\.tsx/);
  assert.match(foundation, /minimum_staffing/);
  assert.match(editor, /name="minimum_staffing"/);
  assert.match(migration, /ADD `minimum_staffing`/);
  assert.match(requestUi, /Request time off/);
  assert.match(requestUi, /Request a shift trade/);
  assert.match(requestUi, /Accept trade/);
  assert.match(requestApi, /Only the receiving employee may accept this trade/);
  assert.match(requestApi, /status='pending_approval'/);
  assert.match(requestApi, /source assignment was preserved/);
  assert.match(requestMigration, /CREATE TABLE department_schedule_requests/);
});

test("demo employee scheduling supports request, acceptance, and upcoming list actions", async () => {
  const [requests, html] = await Promise.all([
    readFile(new URL("../public/schedule-requests.js", import.meta.url), "utf8"),
    readFile(new URL("../public/fireflow-360-demo.html", import.meta.url), "utf8"),
  ]);
  assert.match(requests, /function schrqSaveTimeOff/);
  assert.match(requests, /function schrqSaveTrade/);
  assert.match(requests, /function schrqAcceptTrade/);
  assert.match(requests, /The receiving employee must accept before scheduling approval/);
  assert.match(requests, /Calendar or list view/);
  assert.match(requests, /SCHX\.timeOff/);
  assert.match(requests, /SCHX\.trades/);
  assert.match(html, /schedule-requests\.js/);
  assert.match(html, /\$\{t\.status==='pending'\?` <button class="btn"/);
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

test("calendar separates saved assignments, open shifts, and role qualification", () => {
  const importedRoleMismatch = scheduleStaffingSummary(4, 0, 4);
  assert.equal(scheduleStaffingLabel(importedRoleMismatch), "Verify roles · 0/4");
  assert.equal(importedRoleMismatch.openShifts, 0);

  const vacancy = scheduleStaffingSummary(3, 3, 4);
  assert.equal(scheduleStaffingLabel(vacancy), "1 open shift");
  assert.equal(vacancy.openShifts, 1);

  const unconfiguredMinimum = scheduleStaffingSummary(4, 0, 0);
  assert.equal(scheduleStaffingLabel(unconfiguredMinimum), "4 assigned");
  assert.equal(unconfiguredMinimum.openShifts, 0);
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
