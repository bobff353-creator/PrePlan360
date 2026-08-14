"use client";

import { useState } from "react";
import type { StickneyDuty, StickneyModuleData } from "@/db/stickney";

type Props = { departmentId: string; sourceName: string; sourceKey: string; data: StickneyModuleData; editable: boolean; supportSessionId: string };
type View = "today" | "weekly" | "chores";
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const segments = ["morning", "afternoon", "night"];
const segmentLabels: Record<string, string> = { morning: "Morning · 6a–Noon", afternoon: "Afternoon · Noon–6p", night: "Night · 6p–6a" };
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function DailyDutiesWorkspace({ departmentId, sourceName, sourceKey, data, editable, supportSessionId }: Props) {
  const [view, setView] = useState<View>("today");
  const duties = data.duties ?? [];
  const context = data.dutyContext ?? { date: "", dayOfWeek: 0, segment: "morning" };
  const today = duties.filter((duty) => Number(duty.day_of_week) === context.dayOfWeek);
  const completed = today.filter((duty) => duty.completed_date === context.date);
  const current = today.find((duty) => duty.shift_key.toLowerCase() === context.segment);
  const assigned = today.filter((duty) => duty.assigned_to).length;
  const formattedDate = context.date ? new Date(`${context.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Today";

  return <section className="duties-foundation">
    <div className="duties-source"><div><i/><span><b>{sourceKey === "fermilab" ? "Copied" : "Live"} {sourceName} Daily Duties</b><small>Real weekly station rotation with audited department overlays</small></span></div><strong>Source preserved</strong></div>
    <div className="duties-kpis"><article><span>Today complete</span><b>{completed.length}/{today.length}</b><small>{today.length - completed.length} open</small></article><article><span>Current segment</span><b>{titleCase(context.segment)}</b><small>Chicago local time</small></article><article><span>{dayNames[context.dayOfWeek]}</span><b className="duty-name">{current?.duty || "No duty entered"}</b><small>Now due</small></article><article><span>Chore assignments</span><b>{assigned}</b><small>{assigned ? `${today.length - assigned} unassigned` : "No assignees recorded"}</small></article></div>
    <div className="duties-tabs" role="tablist" aria-label="Daily duty views">{[["today","Today's Roster"],["weekly","Weekly Schedule"],["chores","Station Chores"]].map(([key, text]) => <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key as View)}>{text}</button>)}</div>
    {view === "today" ? <TodayView departmentId={departmentId} duties={today} context={context} formattedDate={formattedDate} editable={editable} supportSessionId={supportSessionId}/> : null}
    {view === "weekly" ? <WeeklyView departmentId={departmentId} duties={duties} context={context} editable={editable} supportSessionId={supportSessionId}/> : null}
    {view === "chores" ? <ChoresView departmentId={departmentId} duties={today} context={context} formattedDate={formattedDate} editable={editable} supportSessionId={supportSessionId}/> : null}
    <p className="duties-footer">The original recurring duties remain in {sourceName}. Completions, assignments, added duties, and owner edits in this build are stored as audited PrePlan 360 overlays.</p>
  </section>;
}

function TodayView({ departmentId, duties, context, formattedDate, editable, supportSessionId }: { departmentId: string; duties: StickneyDuty[]; context: NonNullable<StickneyModuleData["dutyContext"]>; formattedDate: string; editable: boolean; supportSessionId: string }) {
  const done = duties.filter((duty) => duty.completed_date === context.date).length;
  const percent = duties.length ? Math.round((done / duties.length) * 100) : 0;
  return <div className="duties-panel"><header><div><span>TODAY&apos;S DUTIES</span><h2>{dayNames[context.dayOfWeek]} Duty Roster — {formattedDate}</h2><p>Only this department&apos;s recorded duties for today are shown.</p></div><b>{done}/{duties.length}</b></header>{duties.length ? <div className="duties-list">{sortDuties(duties).map((duty) => <article key={duty.id} className={duty.completed_date === context.date ? "complete" : ""}><div className="duty-check" aria-label={duty.completed_date === context.date ? "Complete" : "Open"}>{duty.completed_date === context.date ? "✓" : ""}</div><div><b>{duty.duty}</b><span>{[duty.detail, duty.due_time, duty.assigned_to || "Unassigned"].filter(Boolean).join(" · ")}</span><small>{duty.category || "Recurring station duty"}</small></div>{editable ? <div className="duty-actions"><DutyCompletionForm departmentId={departmentId} duty={duty} date={context.date} supportSessionId={supportSessionId}/><details><summary>Edit</summary><DutyForm departmentId={departmentId} duty={duty} supportSessionId={supportSessionId}/></details></div> : null}</article>)}</div> : <Empty title="No duties for today" text="No recurring department duties are assigned to this day."/>}<div className="duties-progress"><span style={{ width: `${percent}%` }}/><b>{percent}% complete</b></div>{editable ? <details className="duties-add"><summary>+ Add duty</summary><DutyForm departmentId={departmentId} duty={null} supportSessionId={supportSessionId} defaultDay={context.dayOfWeek}/></details> : null}</div>;
}

function WeeklyView({ departmentId, duties, context, editable, supportSessionId }: { departmentId: string; duties: StickneyDuty[]; context: NonNullable<StickneyModuleData["dutyContext"]>; editable: boolean; supportSessionId: string }) {
  return <div className="duties-panel"><header><div><span>WEEKLY SCHEDULE</span><h2>Weekly duty schedule — day × shift segment</h2><p>The current day and segment are highlighted.</p></div><b>{duties.length}</b></header><div className="duties-table"><table><thead><tr><th>Day</th>{segments.map((segment) => <th key={segment}>{segmentLabels[segment]}</th>)}</tr></thead><tbody>{dayNames.map((day, dayIndex) => <tr key={day} className={dayIndex === context.dayOfWeek ? "today" : ""}><th>{shortDays[dayIndex]}{dayIndex === context.dayOfWeek ? <small>Today</small> : null}</th>{segments.map((segment) => { const rows = sortDuties(duties.filter((duty) => Number(duty.day_of_week) === dayIndex && duty.shift_key.toLowerCase() === segment)); const now = dayIndex === context.dayOfWeek && segment === context.segment; return <td key={segment} className={now ? "now" : ""}>{rows.length ? rows.map((duty) => <div key={duty.id}><b>{duty.duty}</b>{now ? <em>Now</em> : null}{editable ? <details><summary>Edit</summary><DutyForm departmentId={departmentId} duty={duty} supportSessionId={supportSessionId}/></details> : null}</div>) : <span>Not entered</span>}</td>; })}</tr>)}</tbody></table></div><p className="duties-note">Each cell comes from the department&apos;s recurring duty records. Owner edits remain specific to this department build.</p></div>;
}

function ChoresView({ departmentId, duties, context, formattedDate, editable, supportSessionId }: { departmentId: string; duties: StickneyDuty[]; context: NonNullable<StickneyModuleData["dutyContext"]>; formattedDate: string; editable: boolean; supportSessionId: string }) {
  return <div className="duties-panel"><header><div><span>STATION CHORES</span><h2>Station chore rotation — {formattedDate}</h2><p>Today&apos;s real duty rotation and recorded assignments.</p></div><b>{duties.length}</b></header>{duties.length ? <div className="duties-table chores"><table><thead><tr><th>Segment</th><th>Duty</th><th>Assigned</th><th>Status</th><th>Manage</th></tr></thead><tbody>{sortDuties(duties).map((duty) => <tr key={duty.id}><td>{titleCase(duty.shift_key)}</td><td><b>{duty.duty}</b></td><td>{duty.assigned_to || "Unassigned"}</td><td><em className={duty.completed_date === context.date ? "ready" : "open"}>{duty.completed_date === context.date ? "Complete" : "Open"}</em></td><td>{editable ? <details><summary>Edit</summary><DutyForm departmentId={departmentId} duty={duty} supportSessionId={supportSessionId}/></details> : "View only"}</td></tr>)}</tbody></table></div> : <Empty title="No station chores today" text="No recurring department duties are assigned to this day."/>}<p className="duties-note">Assignments are not auto-generated. They remain “Unassigned” until an authorized department user records a real crew assignment.</p></div>;
}

function DutyCompletionForm({ departmentId, duty, date, supportSessionId }: { departmentId: string; duty: StickneyDuty; date: string; supportSessionId: string }) {
  const complete = duty.completed_date === date;
  return <form method="post" action={`/api/departments/${departmentId}/stickney-records`}><DutyHiddenFields duty={duty} supportSessionId={supportSessionId}/><input type="hidden" name="completed_date" value={complete ? "" : date}/><button type="submit">{complete ? "Reopen" : "Mark complete"}</button></form>;
}

function DutyHiddenFields({ duty, supportSessionId }: { duty: StickneyDuty; supportSessionId: string }) {
  return <><input type="hidden" name="record_type" value="duty"/><input type="hidden" name="record_id" value={duty.id}/><input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="day_of_week" value={duty.day_of_week}/><input type="hidden" name="shift_key" value={duty.shift_key}/><input type="hidden" name="duty" value={duty.duty}/><input type="hidden" name="detail" value={duty.detail || ""}/><input type="hidden" name="category" value={duty.category || ""}/><input type="hidden" name="assigned_to" value={duty.assigned_to || ""}/><input type="hidden" name="due_time" value={duty.due_time || ""}/></>;
}

function DutyForm({ departmentId, duty, supportSessionId, defaultDay = 0 }: { departmentId: string; duty: StickneyDuty | null; supportSessionId: string; defaultDay?: number }) {
  return <form className="duty-form" method="post" action={`/api/departments/${departmentId}/stickney-records`}><input type="hidden" name="record_type" value="duty"/><input type="hidden" name="record_id" value={duty?.id || "new"}/><input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="completed_date" value={duty?.completed_date || ""}/><label>Day<select name="day_of_week" defaultValue={String(duty?.day_of_week ?? defaultDay)}>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Segment<select name="shift_key" defaultValue={duty?.shift_key || "morning"}>{segments.map((segment) => <option key={segment} value={segment}>{titleCase(segment)}</option>)}</select></label><label className="wide">Duty<textarea name="duty" rows={3} required defaultValue={duty?.duty || ""}/></label><label className="wide">Detail<textarea name="detail" rows={2} defaultValue={duty?.detail || ""}/></label><label>Category<input name="category" defaultValue={duty?.category || ""}/></label><label>Assigned to<input name="assigned_to" defaultValue={duty?.assigned_to || ""}/></label><label>Due time<input name="due_time" type="time" defaultValue={duty?.due_time || ""}/></label><button type="submit">{duty ? "Save duty" : "Add duty"}</button></form>;
}

function sortDuties(duties: StickneyDuty[]) { return duties.toSorted((a, b) => segments.indexOf(a.shift_key.toLowerCase()) - segments.indexOf(b.shift_key.toLowerCase())); }
function Empty({ title, text }: { title: string; text: string }) { return <div className="duties-empty"><b>{title}</b><span>{text}</span></div>; }
