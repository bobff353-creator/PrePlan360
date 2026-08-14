/* Fictional Daily Log demo. Device-local only; no live department records. */
const DL_KEY = "fireflow360.dailyLog.demo.v1";
const DL_EQUIPMENT = ["Knox Box keys", "Portable radios", "Thermal imaging cameras", "Gas detectors"];
let dlDate = new Date().toISOString().slice(0, 10);
let dlOpenNoteId = "";
let dlOpenUnitsId = "";

function dlLoad() {
  try {
    const value = JSON.parse(localStorage.getItem(DL_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (error) {
    return {};
  }
}

let DL_RECORDS = dlLoad();

function dlOwnerEditable() {
  return new URLSearchParams(location.search).get("view") !== "readonly";
}

function dlDepartment() {
  return typeof ownerDept === "function" ? ownerDept() : null;
}

function dlEquipmentAccountabilityVisible() {
  const department = dlDepartment();
  return !dlOwnerEditable() || !department || !department.values || department.values.dailyLogEquipmentAccountability !== false;
}

function dlSetEquipmentAccountability(visible) {
  const department = dlDepartment();
  if (department && typeof ownerSet === "function") ownerSet("dailyLogEquipmentAccountability", Boolean(visible));
  render();
}

function dlId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

function dlEsc(value) {
  return typeof rstEsc === "function"
    ? rstEsc(value)
    : String(value == null ? "" : value).replace(/[&<>\"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character];
    });
}

function dlDateLabel(value) {
  return new Date(value + "T12:00:00").toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dlMember(id) {
  return typeof rstMember === "function" ? rstMember(id) : null;
}

function dlMilitary(value, fallback) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 4 ? digits : fallback;
}

function dlNormalizeAddress(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(boulevard)\b/g, "blvd")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dlAddressCatalog() {
  const preplans = typeof PREPLANS === "undefined" ? [] : PREPLANS.map(function (plan, index) {
    return {
      id: "preplan-" + (plan.id || index),
      address: plan.addr || plan.address || "",
      name: plan.name || "Saved preplan",
      kind: "Preplan",
      preplanId: plan.id || "",
    };
  });
  const imports = typeof IMPORTS === "undefined" ? [] : IMPORTS.map(function (item, index) {
    return {
      id: "import-" + index,
      address: item.addr || item.address || "",
      name: item.name || "Imported property",
      kind: "Address record",
      preplanId: "",
    };
  });
  const savedAddresses = typeof DL_RECORDS === "undefined" ? [] : Object.keys(DL_RECORDS).flatMap(function (date) {
    const record = DL_RECORDS[date];
    return record && Array.isArray(record.calls) ? record.calls.map(function (call, index) {
      return {
        id: "saved-" + date + "-" + (call.id || index),
        address: call.address || "",
        name: call.reportNumber ? "Prior call " + call.reportNumber : "Prior Daily Log address",
        kind: "Saved address",
        preplanId: "",
      };
    }) : [];
  });
  const seen = new Set();
  return preplans.concat(imports, savedAddresses).filter(function (item) {
    const key = dlNormalizeAddress(item.address);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dlAddressMatches(value) {
  const query = dlNormalizeAddress(value);
  if (!query) return dlAddressCatalog().slice(0, 5);
  return dlAddressCatalog().filter(function (item) {
    return dlNormalizeAddress(item.address).includes(query) || dlNormalizeAddress(item.name).includes(query);
  }).slice(0, 5);
}

function dlUnitCatalog() {
  const source = typeof FLEET === "undefined" ? [] : FLEET;
  return source.map(function (unit) {
    if (Array.isArray(unit)) return { id: String(unit[0] || ""), label: String(unit[1] || "Apparatus") };
    return { id: String(unit.id || unit.unit || unit.name || ""), label: String(unit.type || unit.kind || unit.label || "Apparatus") };
  }).filter(function (unit) { return unit.id; });
}

function dlCallUnits(call) {
  if (Array.isArray(call.unitIds)) return call.unitIds.map(String).filter(Boolean);
  return String(call.units || "").split(",").map(function (unit) { return unit.trim(); }).filter(Boolean);
}

function dlNoteTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "----";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replaceAll(":", "");
}

function dlTemplate(shift) {
  if (typeof schxTemplate === "function") return schxTemplate(shift.templateId);
  if (typeof SCHX === "undefined") return null;
  return SCHX.templates.find(function (template) { return template.id === shift.templateId; }) || null;
}

function dlScheduleName(shifts) {
  return shifts.map(function (shift) { return shift.name; }).filter(Boolean).join(" + ");
}

function dlScheduled(date) {
  const shifts = typeof SCHX === "undefined"
    ? []
    : SCHX.shifts
      .filter(function (shift) { return shift.date === date && shift.status === "approved"; })
      .sort(function (a, b) {
        const aTemplate = dlTemplate(a);
        const bTemplate = dlTemplate(b);
        const aStart = aTemplate && aTemplate.start ? aTemplate.start : "99:99";
        const bStart = bTemplate && bTemplate.start ? bTemplate.start : "99:99";
        return aStart.localeCompare(bStart) || String(a.name || "").localeCompare(String(b.name || ""));
      });
  const rows = [];

  shifts.forEach(function (shift, shiftIndex) {
    const template = dlTemplate(shift);
    const timeIn = dlMilitary(template && template.start, "0700");
    const timeOut = dlMilitary(template && template.end, "0700");
    const assignments = Array.isArray(shift.assignments) ? shift.assignments : [];

    assignments.forEach(function (assignment, index) {
      const member = dlMember(assignment.memberId);
      const position = assignment.role || (member && member.rank) || "Additional staffing";
      rows.push({
        id: dlId("staff"),
        positionKey: "schedule-" + shift.id + "-" + (index + 1),
        position,
        unit: assignment.unit || "Unassigned",
        memberId: assignment.memberId,
        scheduledMemberId: assignment.memberId,
        sourceShiftId: shift.id,
        sourceShiftName: shift.name || "Approved shift " + (shiftIndex + 1),
        timeIn,
        timeOut,
        actingOfficer: false,
      });
    });
  });

  return {
    shift: shifts[0] || null,
    shifts,
    rows,
    scheduleName: dlScheduleName(shifts),
  };
}

function dlBlankRecord(date) {
  const scheduled = dlScheduled(date);
  return {
    date,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    staffing: scheduled.rows,
    calls: [],
    notes: "",
    equipment: Object.fromEntries(DL_EQUIPMENT.map(function (item) { return [item, "Present"]; })),
    signIn: false,
    signOut: false,
    staffingSource: scheduled.shift ? "approved_schedule" : "none",
    scheduleName: scheduled.scheduleName,
  };
}

function dlReconcileRecord(date, record) {
  const scheduled = dlScheduled(date);
  if (!scheduled.shift || record.staffingSource === "approved_schedule") return record;

  const savedStaffing = Array.isArray(record.staffing) ? record.staffing : [];
  record.staffing = scheduled.rows.concat(savedStaffing);
  record.staffingSource = "approved_schedule";
  record.scheduleName = scheduled.scheduleName;
  record.updatedAt = new Date().toISOString();
  record.lastMessage = "Approved schedule staffing added";
  DL_RECORDS[date] = record;
  localStorage.setItem(DL_KEY, JSON.stringify(DL_RECORDS));
  return record;
}

function dlRecord(date) {
  if (!DL_RECORDS[date]) DL_RECORDS[date] = dlBlankRecord(date);
  return dlReconcileRecord(date, DL_RECORDS[date]);
}

function dlSave(message) {
  const record = dlRecord(dlDate);
  record.updatedAt = new Date().toISOString();
  record.lastMessage = message || "All changes saved on this device";
  localStorage.setItem(DL_KEY, JSON.stringify(DL_RECORDS));
  render();
}

function dlSetDate(value) {
  dlDate = value || dlDate;
  render();
}

function dlSetStaff(rowId, key, value) {
  const row = dlRecord(dlDate).staffing.find(function (item) { return item.id === rowId; });
  if (!row) return;
  row[key] = value;
  dlSave("Staffing updated");
}

function dlAddStaff() {
  const record = dlRecord(dlDate);
  record.staffing.push({
    id: dlId("staff"),
    positionKey: "backstep",
    position: "Backstep / Additional",
    unit: "Unassigned",
    memberId: "",
    timeIn: "0700",
    timeOut: "0700",
    actingOfficer: false,
  });
  dlSave("Backstep row added");
}

function dlRemoveStaff(id) {
  const record = dlRecord(dlDate);
  record.staffing = record.staffing.filter(function (row) { return row.id !== id; });
  dlSave("Staffing row removed");
}

function dlAddCall() {
  const call = { id: dlId("call"), reportNumber: "", timeOut: "", timeIn: "", units: "", unitIds: [], address: "", preplanId: "", type: "EMS", notes: [] };
  dlRecord(dlDate).calls.push(call);
  dlOpenNoteId = "";
  dlOpenUnitsId = "";
  dlSave("Call row added");
}

function dlSetCall(id, key, value) {
  const row = dlRecord(dlDate).calls.find(function (item) { return item.id === id; });
  if (!row) return;
  row[key] = value;
  dlSave("Call record updated");
}

function dlRemoveCall(id) {
  const record = dlRecord(dlDate);
  record.calls = record.calls.filter(function (row) { return row.id !== id; });
  if (dlOpenNoteId === id) dlOpenNoteId = "";
  if (dlOpenUnitsId === id) dlOpenUnitsId = "";
  dlSave("Call row removed");
}

function dlAddressInput(id, value) {
  const row = dlRecord(dlDate).calls.find(function (item) { return item.id === id; });
  if (!row) return;
  row.address = value;
  const exact = dlAddressCatalog().find(function (item) { return dlNormalizeAddress(item.address) === dlNormalizeAddress(value); });
  row.preplanId = exact ? exact.preplanId : "";
  row.updatedAt = new Date().toISOString();
  dlRecord(dlDate).updatedAt = row.updatedAt;
  localStorage.setItem(DL_KEY, JSON.stringify(DL_RECORDS));
  dlRenderAddressSuggestions(id, value);
}

function dlRenderAddressSuggestions(id, value) {
  if (typeof document === "undefined") return;
  const panel = document.getElementById("dl-address-suggestions-" + id);
  if (!panel) return;
  const matches = dlAddressMatches(value);
  panel.innerHTML = matches.map(function (item) {
    return '<button type="button" onmousedown="event.preventDefault()" onclick="dlSelectAddress(\'' + dlEsc(id) + "','" + dlEsc(item.id) + '\')"><span><b>' + dlEsc(item.address) + "</b><small>" + dlEsc(item.name) + '</small></span><em class="' + (item.preplanId ? "preplan" : "address") + '">' + dlEsc(item.kind) + "</em></button>";
  }).join("") || '<div class="dl-address-empty">Keep typing or use the entered address.</div>';
  panel.classList.add("open");
}

function dlCloseAddressSuggestions(id) {
  setTimeout(function () {
    if (typeof document === "undefined") return;
    const panel = document.getElementById("dl-address-suggestions-" + id);
    if (panel) panel.classList.remove("open");
  }, 120);
}

function dlSelectAddress(callId, catalogId) {
  const item = dlAddressCatalog().find(function (candidate) { return candidate.id === catalogId; });
  if (!item) return;
  const row = dlRecord(dlDate).calls.find(function (call) { return call.id === callId; });
  if (!row) return;
  row.address = item.address;
  row.preplanId = item.preplanId;
  dlSave(item.preplanId ? "Preplan address selected" : "Saved address selected");
}

function dlToggleUnit(callId, unitId, checked) {
  const call = dlRecord(dlDate).calls.find(function (item) { return item.id === callId; });
  if (!call) return;
  const selected = new Set(dlCallUnits(call));
  if (checked) selected.add(unitId);
  else selected.delete(unitId);
  call.unitIds = Array.from(selected);
  call.units = call.unitIds.join(", ");
  dlOpenUnitsId = callId;
  dlSave("Responding units updated");
}

function dlSetUnitPicker(callId, open) {
  if (open) dlOpenUnitsId = callId;
  else if (dlOpenUnitsId === callId) dlOpenUnitsId = "";
}

function dlToggleCallNotes(callId) {
  dlOpenNoteId = dlOpenNoteId === callId ? "" : callId;
  dlOpenUnitsId = "";
  render();
}

function dlAddCallNote(callId) {
  if (typeof document === "undefined") return;
  const input = document.getElementById("dl-call-note-input-" + callId);
  const text = input && "value" in input ? String(input.value || "").trim() : "";
  if (!text) return;
  const call = dlRecord(dlDate).calls.find(function (item) { return item.id === callId; });
  if (!call) return;
  if (!Array.isArray(call.notes)) call.notes = [];
  call.notes.push({ id: dlId("note"), text: text.slice(0, 1000), at: new Date().toISOString() });
  dlOpenNoteId = callId;
  dlSave("Timestamped call note added");
}

function dlCurrentCadNotes(address, reportNumber) {
  const normalized = dlNormalizeAddress(address);
  const records = Object.keys(DL_RECORDS).sort().reverse();
  const matches = [];
  records.forEach(function (date) {
    const record = DL_RECORDS[date];
    const calls = record && Array.isArray(record.calls) ? record.calls : [];
    calls.forEach(function (call) {
      const reportMatches = reportNumber && call.reportNumber === reportNumber;
      const addressMatches = normalized && dlNormalizeAddress(call.address) === normalized;
      if (!reportMatches && !addressMatches) return;
      (Array.isArray(call.notes) ? call.notes : []).forEach(function (note) {
        matches.push({ id: note.id, at: note.at, time: dlNoteTime(note.at), text: note.text, reportNumber: call.reportNumber || "", address: call.address || "" });
      });
    });
  });
  return matches.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
}

function dlSetNotes(value) {
  dlRecord(dlDate).notes = value;
  dlSave("Shift notes updated");
}

function dlEquipment(item) {
  const record = dlRecord(dlDate);
  const states = ["Present", "Missing", "Out of service"];
  const index = states.indexOf(record.equipment[item] || "Present");
  record.equipment[item] = states[(index + 1) % states.length];
  dlSave("Equipment accountability updated");
}

function dlSign(mode) {
  const record = dlRecord(dlDate);
  if (mode === "in") record.signIn = !record.signIn;
  else if (record.signIn) record.signOut = !record.signOut;
  dlSave(mode === "in" ? "Officer sign-in updated" : "Officer sign-out updated");
}

function dlPrint() {
  window.print();
}

function dlRecordDemoDispatch() {
  const date = new Date().toISOString().slice(0, 10);
  const record = dlRecord(date);
  if (record.calls.some(function (call) { return call.reportNumber === "DEMO-CAD-001"; })) return;
  const now = new Date();
  const time = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
  record.calls.unshift({
    id: dlId("call"),
    reportNumber: "DEMO-CAD-001",
    timeOut: time,
    timeIn: "",
    units: "E-1204, T-1211, M-1231",
    unitIds: ["E-1204", "T-1211", "M-1231"],
    address: "1200 Ember Ridge Blvd",
    preplanId: "rm",
    type: "Structure Fire",
    notes: [],
  });
  record.updatedAt = new Date().toISOString();
  record.lastMessage = "Fictional CAD call added from Respond";
  DL_RECORDS[date] = record;
  localStorage.setItem(DL_KEY, JSON.stringify(DL_RECORDS));
}

function dlEmployeeOptions(record) {
  const scheduled = dlScheduled(dlDate).rows.map(function (row) { return row.memberId; });
  const saved = record.staffing.map(function (row) { return row.memberId; }).filter(Boolean);
  return Array.from(new Set(scheduled.concat(saved))).map(dlMember).filter(Boolean);
}

function dlRidingAssignments(date) {
  const selected = date || new Date().toISOString().slice(0, 10);
  const record = DL_RECORDS[selected] ? dlRecord(selected) : null;
  const staffing = record && record.staffing.length ? record.staffing : dlScheduled(selected).rows;

  return staffing.filter(function (row) { return row.memberId; }).map(function (row) {
    const member = dlMember(row.memberId);
    return {
      id: row.id,
      position: row.position,
      unit: row.unit || "Unassigned",
      memberId: row.memberId,
      name: member ? member.name : "Scheduled employee unavailable",
      rank: member ? member.rank : "",
      shiftName: row.sourceShiftName || (record && record.scheduleName) || "Approved schedule",
    };
  });
}

function dlRidingSummary(date) {
  const selected = date || new Date().toISOString().slice(0, 10);
  const assignments = dlRidingAssignments(selected);
  const scheduled = dlScheduled(selected);
  const minimum = scheduled.shifts.reduce(function (total, shift) {
    const template = dlTemplate(shift);
    return total + Number((template && template.minimum) || 0);
  }, 0);
  const officer = assignments.find(function (assignment) {
    return /officer|chief|captain|lieutenant|command/i.test((assignment.position || "") + " " + (assignment.rank || ""));
  });

  return {
    assignments,
    count: assignments.length,
    minimum,
    officer,
    scheduleName: scheduled.scheduleName || (DL_RECORDS[selected] && DL_RECORDS[selected].scheduleName) || "",
  };
}

function dlStaffingTable(record) {
  const employees = dlEmployeeOptions(record);
  const rows = record.staffing.length
    ? record.staffing.map(function (row, index) {
      const person = dlMember(row.memberId);
      const positionMeta = person && person.rank ? "<small>" + dlEsc(person.rank) + "</small>" : "";
      const employeeOptions = employees.map(function (employee) {
        return '<option value="' + employee.id + '" ' + (employee.id === row.memberId ? "selected" : "") + ">" + dlEsc(employee.name) + " · " + dlEsc(employee.rank) + "</option>";
      }).join("");
      const remove = row.positionKey === "backstep" ? '<button class="btn" onclick="dlRemoveStaff(\'' + row.id + '\')">Remove</button>' : "";
      return '<tr><td class="mono">' + (index + 1) + '</td><td><span class="dl-position"><b>' + dlEsc(row.position) + "</b>" + positionMeta + '</span></td><td><select aria-label="Employee for ' + dlEsc(row.position) + '" onchange="dlSetStaff(\'' + row.id + '\',\'memberId\',this.value)"><option value="">Select scheduled employee</option>' + employeeOptions + '</select></td><td><input value="' + dlEsc(row.unit) + '" onchange="dlSetStaff(\'' + row.id + '\',\'unit\',this.value)"></td><td><input class="mono" inputmode="numeric" maxlength="4" value="' + dlEsc(row.timeIn) + '" onchange="dlSetStaff(\'' + row.id + '\',\'timeIn\',this.value)"></td><td><input class="mono" inputmode="numeric" maxlength="4" value="' + dlEsc(row.timeOut) + '" onchange="dlSetStaff(\'' + row.id + '\',\'timeOut\',this.value)"></td><td><input type="checkbox" ' + (row.actingOfficer ? "checked" : "") + ' onchange="dlSetStaff(\'' + row.id + '\',\'actingOfficer\',this.checked)"></td><td>' + remove + "</td></tr>";
    }).join("")
    : '<tr><td colspan="8"><div class="dl-empty">No approved schedule assignments are available for this date.</div></td></tr>';
  return '<div class="dl-table-wrap"><table class="dl-table"><thead><tr><th>Spot</th><th>Required position</th><th>Employee</th><th>Unit</th><th>In</th><th>Out</th><th>AO</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>";
}

function dlCalls(record) {
  if (!record.calls.length) return '<div class="dl-empty">No calls recorded for this operational date.</div>';
  return '<div class="dl-call-list">' + record.calls.map(function (call, index) {
    const types = ["Fire", "EMS", "MVA", "HazMat", "Mutual Aid", "Structure Fire", "Special"].map(function (type) {
      return `<option value="${dlEsc(type)}" ${type === call.type ? "selected" : ""}>${dlEsc(type)}</option>`;
    }).join("");
    const selectedUnits = dlCallUnits(call);
    const unitOptions = dlUnitCatalog().map(function (unit) {
      return `<label><input type="checkbox" ${selectedUnits.includes(unit.id) ? "checked" : ""} onchange="dlToggleUnit('${dlEsc(call.id)}','${dlEsc(unit.id)}',this.checked)"><span><b>${dlEsc(unit.id)}</b><small>${dlEsc(unit.label)}</small></span></label>`;
    }).join("");
    const unitSummary = selectedUnits.length
      ? selectedUnits.map(function (unit) { return `<b>${dlEsc(unit)}</b>`; }).join("")
      : "<span>Select units</span>";
    const exactAddress = dlAddressCatalog().find(function (item) {
      return dlNormalizeAddress(item.address) === dlNormalizeAddress(call.address);
    });
    const addressStatus = exactAddress
      ? `<small class="dl-preplan-match ${exactAddress.preplanId ? "matched" : "saved"}">${dlEsc(exactAddress.kind)} · ${dlEsc(exactAddress.name)}</small>`
      : '<small class="dl-preplan-match">Type to search preplans and saved addresses</small>';
    const notes = Array.isArray(call.notes) ? call.notes : [];
    const noteRows = notes.length
      ? notes.map(function (note) { return `<div class="dl-call-note"><time>${dlEsc(dlNoteTime(note.at))}</time><p>${dlEsc(note.text)}</p></div>`; }).join("")
      : '<div class="dl-call-note-empty">No timestamped notes yet.</div>';
    const notepad = dlOpenNoteId === call.id
      ? `<div class="dl-call-notepad"><header><div><span>LIVE CALL NOTES</span><b>${dlEsc(call.reportNumber || call.address || "Unnumbered response")}</b></div><em>Updates appear in Respond CAD notes</em></header><div class="dl-call-note-stream">${noteRows}</div><div class="dl-call-note-compose"><textarea id="dl-call-note-input-${dlEsc(call.id)}" rows="3" maxlength="1000" placeholder="Add a factual incident update…"></textarea><button class="btn pri" type="button" onclick="dlAddCallNote('${dlEsc(call.id)}')">Add timestamped note</button></div></div>`
      : "";
    return `<article class="dl-call-record">
      <header><div><span class="mono">#${index + 1}</span><b>Response record</b></div><button class="btn" type="button" onclick="dlRemoveCall('${dlEsc(call.id)}')">Remove</button></header>
      <div class="dl-call-fields">
        <label><span>Report</span><input value="${dlEsc(call.reportNumber)}" onchange="dlSetCall('${dlEsc(call.id)}','reportNumber',this.value)"></label>
        <label><span>Out</span><input class="mono" inputmode="numeric" maxlength="4" value="${dlEsc(call.timeOut)}" onchange="dlSetCall('${dlEsc(call.id)}','timeOut',this.value)"></label>
        <label><span>In</span><input class="mono" inputmode="numeric" maxlength="4" value="${dlEsc(call.timeIn)}" onchange="dlSetCall('${dlEsc(call.id)}','timeIn',this.value)"></label>
        <label><span>Type</span><select onchange="dlSetCall('${dlEsc(call.id)}','type',this.value)">${types}</select></label>
        <label class="dl-call-address"><span>Address</span><div class="dl-address-input"><input autocomplete="off" value="${dlEsc(call.address)}" onfocus="dlRenderAddressSuggestions('${dlEsc(call.id)}',this.value)" oninput="dlAddressInput('${dlEsc(call.id)}',this.value)" onchange="dlSetCall('${dlEsc(call.id)}','address',this.value)" onblur="dlCloseAddressSuggestions('${dlEsc(call.id)}')"><div class="dl-address-suggestions" id="dl-address-suggestions-${dlEsc(call.id)}"></div></div>${addressStatus}</label>
        <div class="dl-call-units"><span>Responding units</span><details ${dlOpenUnitsId === call.id ? "open" : ""} ontoggle="dlSetUnitPicker('${dlEsc(call.id)}',this.open)"><summary><span class="dl-unit-summary">${unitSummary}</span><em>${selectedUnits.length} selected</em></summary><div class="dl-unit-options">${unitOptions || '<div class="dl-address-empty">No apparatus entered for this department.</div>'}</div></details></div>
        <button class="dl-call-note-toggle ${dlOpenNoteId === call.id ? "active" : ""}" type="button" aria-label="Open timestamped notes for response ${index + 1}" onclick="dlToggleCallNotes('${dlEsc(call.id)}')"><span>+</span><small>Notes</small><b>${notes.length}</b></button>
      </div>${notepad}
    </article>`;
  }).join("") + "</div>";
}

viewDailyLog = function () {
  const record = dlRecord(dlDate);
  const showEquipment = dlEquipmentAccountabilityVisible();
  const equipmentIssues = Object.values(record.equipment).filter(function (value) { return value !== "Present"; }).length;
  const updated = new Date(record.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const department = dlDepartment();
  const departmentName = department && department.name ? department.name : "this department";
  const visibilityControl = dlOwnerEditable()
    ? `<div class="dl-visibility-control"><div><span>DEPARTMENT DAILY LOG</span><b>Equipment Accountability is ${showEquipment ? "shown" : "hidden"}</b><small>${dlEsc(departmentName)} only · hiding changes the layout, not saved checklist values.</small></div><button class="btn" onclick="dlSetEquipmentAccountability(${showEquipment ? "false" : "true"})">${showEquipment ? "Hide for department" : "Show for department"}</button></div>`
    : "";
  const scheduleNotice = record.staffingSource === "approved_schedule"
    ? '<div class="dl-prefill"><b>Prefilled from ' + dlEsc(record.scheduleName || "the approved Department Schedule") + "</b><span>Only employees assigned for this selected date are offered. Saved historical staffing remains visible on its original log.</span></div>"
    : '<div class="dl-prefill warning"><b>No approved dated shift found</b><span>This log remains empty until the selected date has an approved schedule assignment.</span></div>';
  const equipmentKpi = showEquipment
    ? '<article class="' + (equipmentIssues ? "attention" : "") + '"><span>Equipment issues</span><b>' + equipmentIssues + "</b><small>" + (equipmentIssues ? "Handoff attention required" : "All items present") + "</small></article>"
    : "";
  const equipmentPanel = showEquipment
    ? '<section class="card dl-section"><div class="dl-section-head"><div><span class="modtitle">EQUIPMENT ACCOUNTABILITY</span><h2>Officer handoff check</h2></div></div><div class="dl-equipment">' + DL_EQUIPMENT.map(function (item) {
      const status = record.equipment[item] || "Present";
      return '<button class="' + (status === "Present" ? "ready" : "issue") + '" onclick="dlEquipment(\'' + dlEsc(item) + '\')"><span>' + dlEsc(item) + "</span><b>" + dlEsc(status) + "</b></button>";
    }).join("") + "</div></section>"
    : "";

  return head("Station", "Daily Logbook", "One operational date · approved staffing · responses · officer handoff")
    + '<div class="daily-log-demo"><section class="dl-heading"><div><span class="modtitle">OPERATIONAL RECORD</span><h2>' + dlDateLabel(dlDate) + "</h2><p>Record LOG-" + dlDate.replaceAll("-", "") + ' · 0700 to 0700 operational day</p></div><div class="dl-heading-actions"><label><span>Log date</span><input type="date" value="' + dlDate + '" onchange="dlSetDate(this.value)"></label><button class="btn" onclick="dlPrint()">Print daily log</button><span class="pill p-ready">Saved ' + updated + "</span></div></section>"
    + '<div class="dl-truth"><div><i></i><span><b>Fictional, device-local Daily Log</b><small>No live department, CAD, payroll, or personnel system is connected.</small></span></div><span class="pill p-warn">Demo record</span></div>'
    + visibilityControl
    + scheduleNotice
    + '<div class="dl-kpis ' + (showEquipment ? "" : "equipment-hidden") + '"><article><span>Scheduled staffing</span><b>' + record.staffing.filter(function (row) { return row.memberId; }).length + "</b><small>" + dlEsc(record.scheduleName || "No approved shift") + '</small></article><article><span>Calls recorded</span><b>' + record.calls.length + "</b><small>" + (record.calls.length ? "Linked to this operational date" : "No responses entered") + "</small></article>" + equipmentKpi + '<article><span>Officer approval</span><b class="dl-kpi-text">' + (record.signOut ? "Completed" : record.signIn ? "Signed in" : "Pending") + "</b><small>" + (record.signOut ? "Shift closed" : record.signIn ? "Awaiting sign-out" : "Start-of-shift review") + "</small></article></div>"
    + '<section class="card dl-section"><div class="dl-section-head"><div><span class="modtitle">SCHEDULED STAFFING</span><h2>Personnel working this date</h2><p>Approved schedule assignments prefill the record; actual staffing can be corrected in the interactive demo.</p></div><button class="btn" onclick="dlAddStaff()">+ Add backstep</button></div>' + dlStaffingTable(record) + '<div class="dl-handoff"><button class="btn ' + (record.signIn ? "approved" : "") + '" onclick="dlSign(\'in\')">' + (record.signIn ? "✓ Officer signed in" : "Officer sign in") + '</button><button class="btn ' + (record.signOut ? "approved" : "") + '" ' + (!record.signIn ? "disabled" : "") + ' onclick="dlSign(\'out\')">' + (record.signOut ? "✓ Shift approved" : "Officer sign out") + "</button></div></section>"
    + '<section class="card dl-section"><div class="dl-section-head"><div><span class="modtitle">CALLS & RESPONSES</span><h2>Operational activity</h2><p>Four-digit military times, responding units, address, and call classification.</p></div><button class="btn pri" onclick="dlAddCall()">+ Add call</button></div>' + dlCalls(record) + "</section>"
    + '<div class="dl-lower ' + (showEquipment ? "" : "equipment-hidden") + '"><section class="card dl-section"><div class="dl-section-head"><div><span class="modtitle">SHIFT NOTES</span><h2>Handoff and follow-up</h2></div></div><textarea rows="7" placeholder="Equipment issues, coverage changes, station activity, and follow-up items…" onchange="dlSetNotes(this.value)">' + dlEsc(record.notes) + "</textarea></section>" + equipmentPanel + "</div>" + footer() + "</div>";
};

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", function (event) {
    if (event.key !== DL_KEY) return;
    DL_RECORDS = dlLoad();
    if (current === "respond" || current === "log") render();
  });
}

if (current === "log" || current === "board" || current === "respond") render();
