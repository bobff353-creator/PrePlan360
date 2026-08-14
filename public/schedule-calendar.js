let schxCalendarMonth = "";
let schxCalendarSlides = {};

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
        const names = shift
          ? shift.assignments
              .map((assignment) => rstMember(assignment.memberId)?.name)
              .filter(Boolean)
          : [];
        return (
          '<article class="' +
          (schxMonthKey(day) !== schxCalendarMonth ? "outside " : "") +
          (date === today ? "today" : "") +
          '"><header><time datetime="' +
          date +
          '">' +
          day.getDate() +
          "</time>" +
          (items.length > 1
            ? `<span>${slide + 1}/${items.length}</span>`
            : "") +
          "</header>" +
          (shift
            ? '<button class="schx-calendar-slide" style="--shift-color:' +
              color +
              '" onclick="schxSelect(\'' +
              shift.id +
              "\')\"><b>" +
              schxEsc(shift.name) +
              "</b><small>" +
              schxEsc(template ? template.start : "Start not set") +
              (template?.end ? `–${schxEsc(template.end)}` : "") +
              "</small><strong>" +
              shift.assignments.length +
              " assigned</strong><p>" +
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
    '</div><p class="schx-calendar-note">Slides advance every 5 seconds when a day has more than one schedule. Use the arrows or dots to change it immediately.</p></section>'
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
