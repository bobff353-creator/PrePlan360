import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
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
});

test("shared department calendar groups schedule rows and offers slide controls", async () => {
  const [calendar, workspace, route, propagation] = await Promise.all([
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
  ]);
  assert.match(calendar, /Map\.groupBy\(groups/);
  assert.match(calendar, /window\.setInterval/);
  assert.match(calendar, /Shift colors follow the saved shift setup/);
  assert.match(workspace, /name="shift_color"/);
  assert.match(route, /data\.shift_color/);
  assert.match(propagation, /schedule-calendar\.tsx/);
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
