import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

async function demoRules() {
  const [roster, schedule] = await Promise.all([readFile(new URL("../public/roster-upgrade.js", import.meta.url), "utf8"), readFile(new URL("../public/schedule-upgrade.js", import.meta.url), "utf8")]);
  const storage = new Map();
  const context = {
    CREW: [],
    render() {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    console,
  };
  vm.runInNewContext(`${roster}\n${schedule}\nglobalThis.rules={rstEmploymentActiveOn,rstPayrollEmployeesForPeriod,schxEligibleRoles,schxAssignmentEligible,ROSTER,SCHX};`, context);
  return context.rules;
}

test("last day is inclusive and later schedule dates are excluded", async () => {
  const { rstEmploymentActiveOn } = await demoRules();
  const employee = {
    status: "active",
    hireDate: "2026-01-01",
    endDate: "2026-08-13",
  };
  assert.equal(rstEmploymentActiveOn(employee, "2026-08-13"), true);
  assert.equal(rstEmploymentActiveOn(employee, "2026-08-14"), false);
  assert.equal(rstEmploymentActiveOn(employee, "2025-12-31"), false);
});

test("schedule counts only employment-date and qualified-role assignments", async () => {
  const { ROSTER, SCHX, schxAssignmentEligible, schxEligibleRoles } = await demoRules();
  const employee = {
    id: "member-1",
    name: "FF A. Test",
    status: "active",
    hireDate: "2020-01-01",
    endDate: "2026-08-13",
    workRoles: ["Medic", "Firefighter"],
    riding: "Medic",
  };
  ROSTER.members.push(employee);
  const shift = { date: "2026-08-13" };
  assert.deepEqual([...schxEligibleRoles(employee)], ["Medic", "Firefighter"]);
  assert.equal(schxAssignmentEligible(shift, { memberId: employee.id, role: "Medic" }), true);
  assert.equal(schxAssignmentEligible(shift, { memberId: employee.id, role: "Officer" }), false);
  assert.equal(schxAssignmentEligible({ ...shift, date: "2026-08-14" }, { memberId: employee.id, role: "Medic" }), false);
  assert.ok(Array.isArray(SCHX.shifts), "schedule store remains intact");
});

test("payroll keeps overlapping history and excludes periods after employment ends", async () => {
  const { ROSTER, rstPayrollEmployeesForPeriod } = await demoRules();
  ROSTER.members.push({
    id: "member-1",
    name: "FF A. Test",
    status: "active",
    hireDate: "2020-01-01",
    endDate: "2026-08-13",
    workRoles: ["Firefighter"],
  });
  const payroll = [{ id: "test", name: "A. Test" }];
  assert.equal(rstPayrollEmployeesForPeriod(payroll, "2026-08-03", "2026-08-16", "2026-08-13").length, 1);
  assert.equal(rstPayrollEmployeesForPeriod(payroll, "2026-08-03", "2026-08-16", "2026-08-14").length, 0);
});
