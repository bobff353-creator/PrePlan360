const LEGACY_PUNCTUATION: ReadonlyArray<readonly [string, string]> = [
  ["\u00e2\u20ac\u201c", "–"],
  ["\u00e2\u20ac\u201d", "—"],
  ["\u00e2\u20ac\u2122", "’"],
  ["\u00c2\u00b7", "·"],
  ["\u00c2\u00a0", " "],
];

export function normalizeImportedScheduleText(value: string) {
  let normalized = String(value || "");
  for (const [legacy, punctuation] of LEGACY_PUNCTUATION) {
    normalized = normalized.replaceAll(legacy, punctuation);
  }
  return normalized.replace(/\s+/g, " ").trim();
}

export function scheduleDisplayName(name: string, start: string, end: string) {
  const normalized = normalizeImportedScheduleText(name);
  let label = normalized;
  if (start && end) {
    for (const separator of ["–", "—", "-"]) {
      const range = `${start}${separator}${end}`;
      if (label.toLocaleLowerCase().endsWith(range.toLocaleLowerCase())) {
        label = label.slice(0, -range.length).trim();
        break;
      }
    }
  }
  label = label.replace(/[\s:|/–—-]+$/g, "").trim();
  if (/^imported(?:\s+shift)?$/i.test(label)) return "Imported shift";
  return label || normalized || "Unnamed shift";
}

export type ScheduleStaffingSummary = {
  assigned: number;
  qualified: number;
  minimum: number;
  openShifts: number;
  belowMinimum: boolean;
  hasQualificationGap: boolean;
};

export function scheduleStaffingSummary(
  assignedCount: number,
  qualifiedCount: number,
  minimumStaffing: number,
): ScheduleStaffingSummary {
  const assigned = Math.max(0, Math.trunc(Number(assignedCount) || 0));
  const qualified = Math.min(
    assigned,
    Math.max(0, Math.trunc(Number(qualifiedCount) || 0)),
  );
  const minimum = Math.max(0, Math.trunc(Number(minimumStaffing) || 0));
  return {
    assigned,
    qualified,
    minimum,
    openShifts: minimum > 0 ? Math.max(0, minimum - assigned) : 0,
    belowMinimum: minimum > 0 && qualified < minimum,
    hasQualificationGap: qualified < assigned,
  };
}

export function scheduleStaffingLabel(summary: ScheduleStaffingSummary) {
  if (summary.openShifts > 0) {
    return `${summary.openShifts} open shift${summary.openShifts === 1 ? "" : "s"}`;
  }
  if (summary.belowMinimum && summary.hasQualificationGap) {
    return `Verify roles · ${summary.qualified}/${summary.minimum}`;
  }
  return `${summary.assigned} assigned`;
}

export type CalendarScheduleRow = {
  id: string;
  work_date: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  employee_id?: string;
};

export type NextCalendarShift = {
  id: string;
  workDate: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  assignmentCount: number;
  startsAt: Date;
};

function calendarTime(value: string) {
  const match = String(value || "").match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return "";
  const hour = Number(match[1]);
  if (hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function nextCalendarShift(rows: CalendarScheduleRow[], now: Date) {
  const groups = new Map<string, NextCalendarShift & { assignments: Set<string> }>();
  for (const row of rows) {
    const startTime = calendarTime(row.start_time);
    const endTime = calendarTime(row.end_time);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.work_date) || !startTime) continue;
    const startsAt = new Date(`${row.work_date}T${startTime}:00`);
    if (!Number.isFinite(startsAt.getTime())) continue;
    const shiftName = scheduleDisplayName(row.shift_name, startTime, endTime);
    const key = [row.work_date, shiftName, startTime, endTime].join("|");
    const assignmentId = row.employee_id || row.id;
    const existing = groups.get(key);
    if (existing) {
      existing.assignments.add(assignmentId);
      existing.assignmentCount = existing.assignments.size;
      continue;
    }
    groups.set(key, {
      id: key,
      workDate: row.work_date,
      shiftName,
      startTime,
      endTime,
      assignmentCount: 1,
      startsAt,
      assignments: new Set([assignmentId]),
    });
  }
  const match = [...groups.values()]
    .filter((shift) => shift.startsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.shiftName.localeCompare(b.shiftName))[0];
  if (!match) return null;
  return {
    id: match.id,
    workDate: match.workDate,
    shiftName: match.shiftName,
    startTime: match.startTime,
    endTime: match.endTime,
    assignmentCount: match.assignmentCount,
    startsAt: match.startsAt,
  };
}

export function calendarShiftDateLabel(workDate: string, now: Date) {
  if (workDate === localDateKey(now)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (workDate === localDateKey(tomorrow)) return "Tomorrow";
  const date = new Date(`${workDate}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : workDate;
}
