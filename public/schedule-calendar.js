let schxCalendarMonth = "";
let schxCalendarSlides = {};
let schxCalendarDay = "";

function schxMonthDate(value) {
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, 1, 12);
}

function schxMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function schxDayKey(date) {
  return `${schxMonthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function schxCalendarGroups() {
  const groups = new Map();
  SCHX.shifts
    .slice()
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
    )
    .forEach((shift) => {
      const rows = groups.get(shift.date) || [];
      rows.push(shift);
      groups.set(shift.date, rows);
    });
  return groups;
}

function schxCalendarMove(delta) {
  const current = schxMonthDate(schxCalendarMonth || schxDate(0).slice(0, 7));
  current.setMonth(current.getMonth() + delta);
  schxCalendarMonth = schxMonthKey(current);
  render();
}

function schxCalendarToday() {
  schxCalendarMonth = schxDate(0).slice(0, 7);
  render();
}

function schxCalendarSlide(date, index) {
  schxCalendarSlides[date] = index;
  render();
}

function schxCalendarStep(date, delta) {
  const count = (schxCalendarGroups().get(date) || []).length;
  if (count < 2) return;
  schxCalendarSlides[date] =
    ((schxCalendarSlides[date] || 0) + delta + count) % count;
  render();
}

function schxCalendarOpenDay(date) {
  schxCalendarDay = date;
  render();
}

function schxCalendarCloseDay() {
  schxCalendarDay = "";
  render();
}

function schxCalendarMoveDay(delta) {
  if (!schxCalendarDay) return;
  const next = new Date(schxCalendarDay + "T12:00:00");
  next.setDate(next.getDate() + delta);
  schxCalendarDay = schxDayKey(next);
  schxCalendarMonth = schxCalendarDay.slice(0, 7);
  render();
}

function schxCalendarOpenShift(id) {
  schxCalendarDay = "";
  schxSelect(id);
}

function schxCalendarStaffing(shift) {
  const coverage = schxCoverage(shift);
  const assigned = shift.assignments.length;
  const minimum = Math.max(0, Number(coverage.minimum) || 0);
  const openShifts = minimum > 0 ? Math.max(0, minimum - assigned) : 0;
  const belowMinimum = minimum > 0 && coverage.total < minimum;
  return {
    assigned,
    qualified: coverage.total,
    minimum,
    openShifts,
    belowMinimum,
    hasQualificationGap: coverage.total < assigned,
  };
}

function schxCalendarStaffingLabel(staffing) {
  if (staffing.openShifts > 0)
    return `${staffing.openShifts} open shift${staffing.openShifts === 1 ? "" : "s"}`;
  if (staffing.belowMinimum && staffing.hasQualificationGap)
    return `Verify roles · ${staffing.qualified}/${staffing.minimum}`;
  return `${staffing.assigned} assigned`;
}

function schxCalendarDayView(groups) {
  if (!schxCalendarDay) return "";
  const items = groups.get(schxCalendarDay) || [];
  const assigned = items.reduce(
    (count, shift) => count + shift.assignments.length,
    0,
  );
  const coverageGaps = items.filter((shift) => {
    const coverage = schxCoverage(shift);
    return coverage.total < coverage.minimum;
  }).length;
  return (
    '<div class="schx-day-overlay" role="presentation" onclick="if(event.target===this)schxCalendarCloseDay()"><section class="schx-day-view" role="dialog" aria-modal="true" aria-labelledby="schx-day-title"><header class="schx-day-head"><div><span class="modtitle">DAY VIEW</span><h2 id="schx-day-title">' +
    schxEsc(schxLabelDate(schxCalendarDay)) +
    "</h2><p>" +
    items.length +
    " schedule" +
    (items.length === 1 ? "" : "s") +
    " · " +
    assigned +
    " assigned" +
    (coverageGaps ? " · " + coverageGaps + " below minimum" : "") +
    '</p></div><button class="btn" onclick="schxCalendarCloseDay()">Close</button></header><nav class="schx-day-nav" aria-label="Day controls"><button class="btn" onclick="schxCalendarMoveDay(-1)">Previous day</button><button class="btn" onclick="schxCalendarOpenDay(schxDate(0))">Today</button><button class="btn" onclick="schxCalendarMoveDay(1)">Next day</button></nav><div class="schx-day-content">' +
    (items.length
      ? items
          .map((shift) => {
            const template = schxTemplate(shift.templateId);
            const color = schxColorHex(template?.color);
            const staffing = schxCalendarStaffing(shift);
            const belowMinimum = staffing.belowMinimum;
            return (
              '<article class="schx-day-shift ' +
              (belowMinimum ? "below-minimum" : "") +
              '" style="--shift-color:' +
              color +
              '"><header><div><span class="modtitle">SCHEDULE</span><h3>' +
              schxEsc(shift.name) +
              '</h3></div><div class="schx-day-coverage"><b>' +
              schxEsc(template?.start || "Start not set") +
              (template?.end ? "–" + schxEsc(template.end) : "") +
              "</b>" +
              (belowMinimum
                ? "<span>" +
                  schxEsc(
                    staffing.openShifts
                      ? schxCalendarStaffingLabel(staffing) +
                          " · " +
                          staffing.assigned +
                          " assigned"
                      : schxCalendarStaffingLabel(staffing),
                  ) +
                  "</span>"
                : "<small>Minimum met · " +
                  staffing.assigned +
                  " assigned</small>") +
              '</div></header><div class="schx-day-roster">' +
              (shift.assignments.length
                ? shift.assignments
                    .map((assignment) => {
                      const member = rstMember(assignment.memberId);
                      const details = [
                        assignment.role,
                        member?.rank,
                        assignment.unit,
                      ].filter(Boolean);
                      const eligible = schxAssignmentEligible(shift, assignment);
                      return (
                        '<div class="' +
                        (eligible ? "" : "not-eligible") +
                        '"><strong>' +
                        schxEsc(member?.name || "Roster member unavailable") +
                        "</strong><span>" +
                        schxEsc(details.join(" · ") || "Position not entered") +
                        "</span>" +
                        (eligible
                          ? ""
                          : "<em>Does not count: date or role conflict</em>") +
                        "</div>"
                      );
                    })
                    .join("")
                : "<p>No employees assigned.</p>") +
              '</div><footer><button class="btn" onclick="schxCalendarOpenShift(\'' +
              shift.id +
              "')\">Open schedule</button></footer></article>"
            );
          })
          .join("")
      : '<div class="schx-day-empty"><strong>No schedules for this date.</strong><p>This day has no saved schedule or staffing assignments.</p></div>') +
    "</div></section></div>"
  );
}

function schxCalendar() {
  const groups = schxCalendarGroups();
  const today = schxDate(0);
  if (!schxCalendarMonth) {
    schxCalendarMonth = SCHX.shifts.some((shift) =>
      shift.date.startsWith(today.slice(0, 7)),
    )
      ? today.slice(0, 7)
      : SCHX.shifts[0]?.date.slice(0, 7) || today.slice(0, 7);
  }
  const first = schxMonthDate(schxCalendarMonth);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const label = first.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  return (
    '<section class="schx-calendar"><header class="schx-calendar-head"><div><span class="modtitle">CALENDAR VIEW</span><h2>' +
    label +
    '</h2><p>Shift colors follow the shift builder. Multiple schedules rotate inside their day instead of crowding the calendar.</p></div><nav><button class="btn" onclick="schxCalendarMove(-1)" aria-label="Previous month">‹</button><button class="btn" onclick="schxCalendarToday()">Today</button><button class="btn" onclick="schxCalendarMove(1)" aria-label="Next month">›</button></nav></header><div class="schx-calendar-weekdays">' +
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .map((day) => `<span>${day}</span>`)
      .join("") +
    '</div><div class="schx-calendar-grid">' +
    days
      .map((day) => {
        const date = schxDayKey(day);
        const items = groups.get(date) || [];
        const slide = Math.min(
          schxCalendarSlides[date] || 0,
          Math.max(0, items.length - 1),
        );
        const shift = items[slide];
        const template = shift ? schxTemplate(shift.templateId) : null;
        const color = schxColorHex(template?.color);
        const staffing = shift ? schxCalendarStaffing(shift) : null;
        const belowMinimum = Boolean(staffing?.belowMinimum);
        const names = shift
          ? shift.assignments
              .map((assignment) => rstMember(assignment.memberId)?.name)
              .filter(Boolean)
          : [];
        return (
          '<article class="' +
          (schxMonthKey(day) !== schxCalendarMonth ? "outside " : "") +
          (date === today ? "today " : "") +
          (belowMinimum ? "coverage-warning" : "") +
          '"><header><button class="schx-calendar-date" onclick="schxCalendarOpenDay(\'' +
          date +
          '\')" aria-label="Open day view for ' +
          schxEsc(schxLabelDate(date)) +
          '"><time datetime="' +
          date +
          '">' +
          day.getDate() +
          "</time></button>" +
          (items.length > 1
            ? `<span>${slide + 1}/${items.length}</span>`
            : "") +
          "</header>" +
          (shift
            ? '<button class="schx-calendar-slide ' +
              (belowMinimum ? "below-minimum" : "") +
              '" style="--shift-color:' +
              color +
              '" onclick="schxSelect(\'' +
              shift.id +
              "\')\"><b>" +
              schxEsc(shift.name) +
              "</b><small>" +
              schxEsc(template ? template.start : "Start not set") +
              (template?.end ? `–${schxEsc(template.end)}` : "") +
              "</small>" +
              (staffing.openShifts ||
              (belowMinimum && staffing.hasQualificationGap)
                ? '<span class="schx-coverage-warning">' +
                  schxEsc(schxCalendarStaffingLabel(staffing)) +
                  "</span>"
                : "<strong>" +
                  schxEsc(schxCalendarStaffingLabel(staffing)) +
                  "</strong>") +
              "<p>" +
              schxEsc(
                names.slice(0, 3).join(" · ") || "No employees assigned",
              ) +
              "</p></button>"
            : '<span class="schx-calendar-empty">No schedule</span>') +
          (items.length > 1
            ? "<footer><button onclick=\"schxCalendarStep('" +
              date +
              '\',-1)" aria-label="Previous schedule">‹</button><div>' +
              items
                .map(
                  (item, index) =>
                    '<button class="' +
                    (index === slide ? "active" : "") +
                    '" onclick="schxCalendarSlide(\'' +
                    date +
                    "'," +
                    index +
                    ')" aria-label="Show ' +
                    schxEsc(item.name) +
                    '"></button>',
                )
                .join("") +
              "</div><button onclick=\"schxCalendarStep('" +
              date +
              '\',1)" aria-label="Next schedule">›</button></footer>'
            : "") +
          "</article>"
        );
      })
      .join("") +
    '</div><p class="schx-calendar-note">Slides advance every 5 seconds when a day has more than one schedule. Select a date for its complete day view, or use the arrows and dots to change the calendar card immediately. Red coverage warnings use each shift template\'s saved minimum; only date- and role-qualified assignments count.</p>' +
    schxCalendarDayView(groups) +
    "</section>"
  );
}

function schxCalendarAutoTick() {
  if (current !== "sched" || schxTab !== "calendar") return;
  let changed = false;
  schxCalendarGroups().forEach((items, date) => {
    if (items.length < 2) return;
    schxCalendarSlides[date] =
      ((schxCalendarSlides[date] || 0) + 1) % items.length;
    changed = true;
  });
  if (changed) render();
}

const schxOriginalViewSched = viewSched;
viewSched = function () {
  if (schxTab !== "calendar") return schxOriginalViewSched();
  const upcoming = schxUpcoming();
  const pending = SCHX.shifts.filter(
    (shift) => shift.status === "pending",
  ).length;
  const gaps = upcoming.filter((shift) => !schxCoverage(shift).ready).length;
  const admins = schxAdmins().length;
  return (
    head(
      "Station",
      "Scheduling",
      "Dynamic calendar / shift builder / shared roster assignments",
    ) +
    '<div class="schedule-upgrade"><div class="schx-source"><div class="source"><i></i><div><b>Roster-connected scheduling workspace</b><div class="muted" style="font-size:11px">Dated shifts and approvals are stored only on this device in the demo</div></div></div><div class="schx-actions schx-no-print"><button class="btn" onclick="schxGo(\'employee\')">Employee view</button><button class="btn" onclick="schxPrint()">Print schedule records</button><span class="pill p-warn">Identity not verified</span></div></div><div class="schx-kpis"><div class="schx-kpi"><small>Upcoming shifts</small><strong>' +
    upcoming.length +
    '</strong></div><div class="schx-kpi ' +
    (pending ? "warn" : "") +
    '"><small>Pending approval</small><strong>' +
    pending +
    '</strong></div><div class="schx-kpi ' +
    (gaps ? "fire" : "") +
    '"><small>Coverage gaps</small><strong>' +
    gaps +
    '</strong></div><div class="schx-kpi ' +
    (!admins ? "fire" : "") +
    '"><small>Designated approvers</small><strong>' +
    admins +
    '</strong></div></div><div class="schx-tabs schx-no-print">' +
    [
      ["calendar", "Calendar"],
      ["employee", "Employee view"],
      ["builder", "Shift builder"],
      ["assignments", "Assignments"],
      ["approvals", "Approvals"],
      ["requests", "Requests & overtime"],
    ]
      .map(
        (tab) =>
          '<button class="' +
          (schxTab === tab[0] ? "active" : "") +
          '" onclick="schxGo(\'' +
          tab[0] +
          "\')\">" +
          tab[1] +
          "</button>",
      )
      .join("") +
    "</div>" +
    schxCalendar() +
    '<div class="footer-note">Roster and Scheduling share the same device-local employee records. Shift creation, assignments, approval status, and selected approver are not synchronized to payroll or an authenticated department directory.</div></div>' +
    schxModalHtml()
  );
};

schxTab = "calendar";
if (typeof window !== "undefined")
  window.setInterval(schxCalendarAutoTick, 5000);
if (typeof window !== "undefined")
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && schxCalendarDay) schxCalendarCloseDay();
  });
