let schrqUpcomingMode = "calendar";

function schrqLastName(member) {
  return member.name.trim().split(/\s+/).pop().replace(/[^a-z]/gi, "");
}

function schrqEnsureStore() {
  let changed = false;
  if (!Array.isArray(SCHX.timeOff)) {
    SCHX.timeOff = TIMEOFF.map((record) => ({ ...record, id: record.id || schxId("timeoff") }));
    changed = true;
  } else if (SCHX.timeOff.some((record) => !record.id)) {
    SCHX.timeOff = SCHX.timeOff.map((record) => ({ ...record, id: record.id || schxId("timeoff") }));
    changed = true;
  }
  if (!Array.isArray(SCHX.trades)) {
    SCHX.trades = TRADES.map((record) => ({ ...record, id: record.id || schxId("trade") }));
    changed = true;
  } else if (SCHX.trades.some((record) => !record.id)) {
    SCHX.trades = SCHX.trades.map((record) => ({ ...record, id: record.id || schxId("trade") }));
    changed = true;
  }
  TIMEOFF = SCHX.timeOff;
  TRADES = SCHX.trades;
  if (changed) localStorage.setItem(SCHX_KEY, JSON.stringify(SCHX));
}

function schrqPersist(message) {
  SCHX.timeOff = TIMEOFF;
  SCHX.trades = TRADES;
  if (message) SCHX.audit.unshift({ at: new Date().toISOString(), text: message });
  SCHX.audit = SCHX.audit.slice(0, 60);
  localStorage.setItem(SCHX_KEY, JSON.stringify(SCHX));
  render();
}

function schrqOpenTimeOff(employeeId) {
  schxModal = { type: "timeoff", employeeId };
  render();
}

function schrqOpenTrade(employeeId) {
  schxModal = { type: "trade", employeeId };
  render();
}

function schrqSaveTimeOff() {
  const employee = rstMember(schxModal.employeeId);
  const type = schxRead("schrq_to_type");
  const from = schxRead("schrq_to_from");
  const to = schxRead("schrq_to_to") || from;
  const hours = Math.max(1, Math.min(720, schxNum("schrq_to_hours", 24)));
  if (!employee || !from || to < from) {
    alert("Select a valid time-off date range.");
    return;
  }
  if (!rstEmploymentActiveOn(employee, from) || !rstEmploymentActiveOn(employee, to)) {
    alert("The request is outside this employee's employment dates.");
    return;
  }
  TIMEOFF.unshift({
    id: schxId("timeoff"),
    employeeId: employee.id,
    emp: schrqLastName(employee),
    type,
    from,
    to,
    hrs: hours,
    status: "pending",
    bal: "not_connected",
    note: schxRead("schrq_to_note"),
    createdAt: new Date().toISOString(),
  });
  schxModal = null;
  schrqPersist(employee.name + " submitted a " + type.toLowerCase() + " time-off request.");
}

function schrqTradeTargets(employee, shift) {
  const role = shift.assignments.find((assignment) => assignment.memberId === employee.id)?.role || "";
  return ROSTER.members.filter(
    (member) =>
      member.id !== employee.id &&
      rstEmploymentActiveOn(member, shift.date) &&
      schxEligibleRoles(member).includes(role),
  );
}

function schrqTradeShiftChanged(employeeId) {
  const employee = rstMember(employeeId);
  const shift = schxShift(schxRead("schrq_tr_shift"));
  const select = document.getElementById("schrq_tr_target");
  if (!employee || !shift || !select) return;
  select.innerHTML = '<option value="">Select employee</option>' + schrqTradeTargets(employee, shift)
    .map((target) => '<option value="' + target.id + '">' + schxEsc(target.name + " - " + schxEligibleRoles(target).join(", ")) + "</option>")
    .join("");
}

function schrqSaveTrade() {
  const employee = rstMember(schxModal.employeeId);
  const shift = schxShift(schxRead("schrq_tr_shift"));
  const assignment = shift?.assignments.find((item) => item.memberId === employee?.id);
  const scope = schxRead("schrq_tr_scope") === "department" ? "department" : "employee";
  const target = scope === "employee" ? rstMember(schxRead("schrq_tr_target")) : null;
  if (!employee || !shift || !assignment) {
    alert("Select one of this employee's upcoming assignments.");
    return;
  }
  if (scope === "employee" && (!target || !schrqTradeTargets(employee, shift).some((member) => member.id === target.id))) {
    alert("Select another employee who is eligible for this role and date.");
    return;
  }
  TRADES.unshift({
    id: schxId("trade"),
    shiftId: shift.id,
    fromMemberId: employee.id,
    toMemberId: target?.id || "",
    targetScope: scope,
    from: schrqLastName(employee),
    to: target ? schrqLastName(target) : "Department eligible pool",
    date: shift.date,
    role: assignment.role,
    status: target ? "awaiting_acceptance" : "open",
    note: schxRead("schrq_tr_note"),
    createdAt: new Date().toISOString(),
  });
  schxModal = null;
  schrqPersist(employee.name + " requested a shift trade for " + schxLabelDate(shift.date) + ".");
}

function schrqEmployeeEligibleForTrade(employee, trade) {
  const shift = schxShift(trade.shiftId);
  return Boolean(
    shift &&
      employee.id !== trade.fromMemberId &&
      rstEmploymentActiveOn(employee, shift.date) &&
      schxEligibleRoles(employee).includes(trade.role),
  );
}

function schrqAcceptTrade(id, employeeId) {
  const trade = TRADES.find((record) => record.id === id);
  const employee = rstMember(employeeId);
  if (!trade || !employee || !["open", "awaiting_acceptance"].includes(trade.status)) return;
  if (trade.targetScope === "employee" && trade.toMemberId !== employee.id) {
    alert("This trade was offered to another employee.");
    return;
  }
  if (!schrqEmployeeEligibleForTrade(employee, trade)) {
    alert("This employee is not eligible for the trade role and date.");
    return;
  }
  trade.toMemberId = employee.id;
  trade.to = schrqLastName(employee);
  trade.status = "pending";
  trade.acceptedAt = new Date().toISOString();
  schrqPersist(employee.name + " accepted the trade; scheduling approval is required.");
}

function schrqDeclineTrade(id, employeeId) {
  const trade = TRADES.find((record) => record.id === id);
  if (!trade || trade.status !== "awaiting_acceptance" || trade.toMemberId !== employeeId) return;
  trade.status = "declined";
  trade.reviewedAt = new Date().toISOString();
  schrqPersist((rstMember(employeeId)?.name || "The receiving employee") + " declined the trade.");
}

function schrqTradeActions(employee) {
  const actionable = TRADES.filter(
    (trade) =>
      ["open", "awaiting_acceptance"].includes(trade.status) &&
      (trade.targetScope === "department" || trade.toMemberId === employee.id) &&
      schrqEmployeeEligibleForTrade(employee, trade),
  );
  if (!actionable.length) return "";
  return (
    '<div class="schrq-incoming"><span class="modtitle">AVAILABLE TO YOU</span>' +
    actionable
      .map(
        (trade) =>
          '<article><div><b>' +
          schxEsc(trade.from) +
          " needs " +
          schxEsc(trade.date) +
          '</b><small>' +
          schxEsc(trade.role) +
          " - " +
          schxEsc(trade.note || "No note") +
          '</small></div><button class="btn pri" onclick="schrqAcceptTrade(\'' +
          trade.id +
          "','" +
          employee.id +
          '\')">Accept</button>' +
          (trade.targetScope === "employee"
            ? '<button class="btn" onclick="schrqDeclineTrade(\'' +
              trade.id +
              "','" +
              employee.id +
              '\')">Decline</button>'
            : "") +
          "</article>",
      )
      .join("") +
    "</div>"
  );
}

function schrqTimeOffModal(employee) {
  return (
    '<div class="schx-modal" onclick="if(event.target===this)schxClose()"><div class="schx-modal-card"><div class="schx-modal-head"><div><b>Request time off</b><div class="muted" style="font-size:10px">' +
    schxEsc(employee.name) +
    ' - device-local demo request</div></div><button class="btn" onclick="schxClose()">Close</button></div><div class="schx-modal-body"><div class="schx-form"><div class="schx-field"><label>Type</label><select id="schrq_to_type" class="searchbox"><option>Vacation</option><option>Sick</option><option>Floating</option><option>Recovery</option><option>Other</option></select></div><div class="schx-field"><label>Hours</label><input id="schrq_to_hours" class="searchbox" type="number" min="1" max="720" value="24"></div><div class="schx-field"><label>First day</label><input id="schrq_to_from" class="searchbox" type="date" value="' +
    schxDate(1) +
    '"></div><div class="schx-field"><label>Last day</label><input id="schrq_to_to" class="searchbox" type="date" value="' +
    schxDate(1) +
    '"></div><div class="schx-field wide"><label>Reason or note</label><textarea id="schrq_to_note" class="searchbox" rows="3"></textarea></div></div><div class="schx-truth" style="margin-top:12px">Submitting creates a pending request. It does not remove a schedule assignment until a scheduling administrator reviews staffing.</div><div class="schx-modal-actions"><button class="btn" onclick="schxClose()">Cancel</button><button class="btn pri" onclick="schrqSaveTimeOff()">Submit request</button></div></div></div></div>'
  );
}

function schrqTradeModal(employee) {
  const shifts = schxUpcoming().filter((shift) => shift.assignments.some((assignment) => assignment.memberId === employee.id));
  const first = shifts[0];
  const targets = first ? schrqTradeTargets(employee, first) : [];
  return (
    '<div class="schx-modal" onclick="if(event.target===this)schxClose()"><div class="schx-modal-card"><div class="schx-modal-head"><div><b>Request a shift trade</b><div class="muted" style="font-size:10px">' +
    schxEsc(employee.name) +
    ' - receiver acceptance required</div></div><button class="btn" onclick="schxClose()">Close</button></div><div class="schx-modal-body"><div class="schx-form"><div class="schx-field wide"><label>Your upcoming assignment</label><select id="schrq_tr_shift" class="searchbox" onchange="schrqTradeShiftChanged(\'' +
    employee.id +
    '\')">' +
    shifts.map((shift) => '<option value="' + shift.id + '">' + schxEsc(schxLabelDate(shift.date) + " - " + shift.name) + "</option>").join("") +
    '</select></div><div class="schx-field"><label>Offer to</label><select id="schrq_tr_scope" class="searchbox"><option value="employee">One employee</option><option value="department">Anyone eligible in department</option></select></div><div class="schx-field"><label>Employee</label><select id="schrq_tr_target" class="searchbox"><option value="">Select employee</option>' +
    targets.map((target) => '<option value="' + target.id + '">' + schxEsc(target.name + " - " + schxEligibleRoles(target).join(", ")) + "</option>").join("") +
    '</select></div><div class="schx-field wide"><label>Trade note</label><textarea id="schrq_tr_note" class="searchbox" rows="3"></textarea></div></div>' +
    (shifts.length ? "" : '<div class="schx-truth">This employee has no upcoming assignment available to trade.</div>') +
    '<div class="schx-truth" style="margin-top:12px">A direct offer goes to one qualified employee. A department offer may be accepted by any employee qualified for the role and active on that date. Scheduling approval remains required.</div><div class="schx-modal-actions"><button class="btn" onclick="schxClose()">Cancel</button><button class="btn pri" onclick="schrqSaveTrade()" ' +
    (shifts.length ? "" : "disabled") +
    ">Send trade request</button></div></div></div></div>"
  );
}

schrqEnsureStore();

const schrqOriginalModal = schxModalHtml;
schxModalHtml = function () {
  if (schxModal?.type === "timeoff") {
    const employee = rstMember(schxModal.employeeId);
    return employee ? schrqTimeOffModal(employee) : "";
  }
  if (schxModal?.type === "trade") {
    const employee = rstMember(schxModal.employeeId);
    return employee ? schrqTradeModal(employee) : "";
  }
  return schrqOriginalModal();
};

const schrqOriginalEmployeeView = schxEmployeeView;
schxEmployeeView = function () {
  const employee = schxEmployee();
  if (!employee) return schrqOriginalEmployeeView();
  let html = schrqOriginalEmployeeView();
  const timeHeader = '<div class="schx-record-head"><div><span class="modtitle">REQUEST RECORD</span><h3>Time off</h3></div></div>';
  const tradeHeader = '<div class="schx-record-head"><div><span class="modtitle">TRADE RECORD</span><h3>Shift trades</h3></div></div>';
  html = html
    .replace("Read-only personal view of assignments, requests, and approval status", "Personal schedule, requests, trade offers, and approval status")
    .replace('<span class="pill p-ready">Read only</span>', '<span class="pill p-ready">Employee actions enabled</span>')
    .replace(timeHeader, '<div class="schx-record-head"><div><span class="modtitle">REQUEST RECORD</span><h3>Time off</h3></div><button class="btn pri schx-no-print" onclick="schrqOpenTimeOff(\'' + employee.id + '\')">Request time off</button></div>')
    .replace(tradeHeader, '<div class="schx-record-head"><div><span class="modtitle">TRADE RECORD</span><h3>Shift trades</h3></div><button class="btn pri schx-no-print" onclick="schrqOpenTrade(\'' + employee.id + '\')">Request trade</button></div>' + schrqTradeActions(employee))
    .replace("Employee View does not expose shift-building, assignment, approval, or rule controls.", "Employee View allows time-off and trade actions but does not expose shift-building, assignment, approval, or rule controls.");
  return html;
};

toReview = function (index, decision) {
  const request = TIMEOFF[index];
  if (!request || request.status !== "pending") return;
  request.status = decision;
  request.reviewedAt = new Date().toISOString();
  schrqPersist(request.emp + " time-off request " + decision + ".");
};

trReview = function (index, decision) {
  const trade = TRADES[index];
  if (!trade || trade.status !== "pending") {
    alert("The receiving employee must accept before scheduling approval.");
    return;
  }
  if (decision === "approved") {
    const shift = schxShift(trade.shiftId);
    const assignment = shift?.assignments.find((item) => item.memberId === trade.fromMemberId);
    const receiver = rstMember(trade.toMemberId);
    if (!shift || !assignment || !receiver || !schrqEmployeeEligibleForTrade(receiver, trade)) {
      alert("The accepted trade is no longer eligible.");
      return;
    }
    assignment.memberId = receiver.id;
    shift.status = "approved";
    shift.approvedAt = new Date().toISOString();
  }
  trade.status = decision;
  trade.reviewedAt = new Date().toISOString();
  schrqPersist(trade.from + " shift trade " + decision + ".");
};

function schrqOpenUpcoming() {
  schxTab = "upcoming";
  render();
}

function schrqUpcomingSetMode(mode) {
  schrqUpcomingMode = mode;
  render();
}

function schrqUpcomingList() {
  const shifts = schxUpcoming();
  return '<div class="schrq-upcoming-list">' + (shifts.length ? shifts.map((shift) => {
    const coverage = schxCoverage(shift);
    return '<article class="' + (coverage.ready ? "" : "gap") + '"><time>' + schxEsc(schxLabelDate(shift.date)) + '</time><div><h3>' + schxEsc(shift.name) + '</h3><p>' + coverage.total + "/" + coverage.minimum + " eligible - " + schxEsc(shift.assignments.map((assignment) => rstMember(assignment.memberId)?.name).filter(Boolean).join(" - ") || "No employees assigned") + '</p></div>' + schxStatusBadge(shift) + '<button class="btn" onclick="schxCalendarOpenDay(\'' + shift.date + '\')">Open day</button></article>';
  }).join("") : '<div class="schx-empty">No upcoming shifts are saved.</div>') + "</div>";
}

function schrqUpcomingPage() {
  const shifts = schxUpcoming();
  return head("Station", "Upcoming Shifts", "Calendar and list views of dated department schedules") + '<div class="schedule-upgrade"><div class="schrq-upcoming-head"><div><span class="modtitle">UPCOMING SHIFTS</span><h2>' + shifts.length + ' scheduled</h2><p>Use the calendar for month context or the list for a compact shift-by-shift view.</p></div><div class="schx-actions"><button class="btn" onclick="schxGo(\'calendar\')">Back to Scheduling</button><button class="btn ' + (schrqUpcomingMode === "calendar" ? "pri" : "") + '" onclick="schrqUpcomingSetMode(\'calendar\')">Calendar view</button><button class="btn ' + (schrqUpcomingMode === "list" ? "pri" : "") + '" onclick="schrqUpcomingSetMode(\'list\')">List view</button></div></div>' + (schrqUpcomingMode === "calendar" ? schxCalendar() : schrqUpcomingList()) + '<div class="footer-note">Upcoming shift totals use saved dated schedules. Coverage counts only active employees assigned to roles they are marked able to work.</div></div>' + schxModalHtml();
}

const schrqOriginalViewSched = viewSched;
viewSched = function () {
  if (schxTab === "upcoming") return schrqUpcomingPage();
  const html = schrqOriginalViewSched();
  const upcoming = schxUpcoming().length;
  const original = '<div class="schx-kpi"><small>Upcoming shifts</small><strong>' + upcoming + "</strong></div>";
  const action = '<button class="schx-kpi schrq-kpi-action" onclick="schrqOpenUpcoming()"><small>Upcoming shifts</small><strong>' + upcoming + '</strong><span>Calendar or list view</span></button>';
  return html.replace(original, action);
};
