"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { StickneyScheduleAssignment } from "@/db/stickney";
import { scheduleDisplayName } from "./schedule-format";

const SHIFT_COLORS = [
  "#8b1e24",
  "#111318",
  "#c89b2c",
  "#2569bd",
  "#d96b22",
] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ScheduleGroup = {
  id: string;
  date: string;
  name: string;
  start: string;
  end: string;
  color: string;
  assignments: StickneyScheduleAssignment[];
};

function colorFor(name: string, saved?: string) {
  if (
    saved &&
    SHIFT_COLORS.includes(saved.toLowerCase() as (typeof SHIFT_COLORS)[number])
  )
    return saved.toLowerCase();
  let hash = 0;
  for (const character of name)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return SHIFT_COLORS[hash % SHIFT_COLORS.length];
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthDate(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
}

function calendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dayLabel(value: string) {
  return calendarDate(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function groupRows(rows: StickneyScheduleAssignment[]) {
  const groups = new Map<string, ScheduleGroup>();
  for (const row of rows) {
    const key = [
      row.work_date,
      row.shift_name,
      row.start_time,
      row.end_time,
    ].join("|");
    const existing = groups.get(key);
    if (existing) {
      existing.assignments.push(row);
      if (!existing.color && row.shift_color)
        existing.color = colorFor(row.shift_name, row.shift_color);
      continue;
    }
    groups.set(key, {
      id: key,
      date: row.work_date,
      name: scheduleDisplayName(row.shift_name, row.start_time, row.end_time),
      start: row.start_time,
      end: row.end_time,
      color: colorFor(row.shift_name, row.shift_color),
      assignments: [row],
    });
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.start.localeCompare(b.start) ||
      a.name.localeCompare(b.name),
  );
}

export default function ScheduleCalendar({
  rows,
  today,
}: {
  rows: StickneyScheduleAssignment[];
  today: string;
}) {
  const groups = useMemo(() => groupRows(rows), [rows]);
  const initialMonth = groups.some((group) =>
    group.date.startsWith(today.slice(0, 7)),
  )
    ? today.slice(0, 7)
    : groups[0]?.date.slice(0, 7) || today.slice(0, 7);
  const [month, setMonth] = useState(initialMonth);
  const [slides, setSlides] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const byDate = useMemo(
    () => Map.groupBy(groups, (group) => group.date),
    [groups],
  );
  const calendarDays = useMemo(() => {
    const first = monthDate(month);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlides((current) => {
        const next = { ...current };
        let changed = false;
        for (const [date, schedules] of byDate) {
          if (schedules.length < 2) continue;
          next[date] = ((current[date] || 0) + 1) % schedules.length;
          changed = true;
        }
        return changed ? next : current;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [byDate]);

  useEffect(() => {
    if (!selectedDate) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedDate(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedDate]);

  function moveMonth(delta: number) {
    const next = monthDate(month);
    next.setMonth(next.getMonth() + delta);
    setMonth(monthKey(next));
  }

  function moveSlide(date: string, count: number, delta: number) {
    setSlides((current) => ({
      ...current,
      [date]: ((current[date] || 0) + delta + count) % count,
    }));
  }

  function moveSelectedDay(delta: number) {
    if (!selectedDate) return;
    const next = calendarDate(selectedDate);
    next.setDate(next.getDate() + delta);
    const nextDate = dateKey(next);
    setSelectedDate(nextDate);
    setMonth(nextDate.slice(0, 7));
  }

  const label = monthDate(month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  // This shared renderer mirrors the demo's slide cadence across every department.
  return (
    <section
      className="schedule-calendar"
      aria-label={`${label} schedule calendar`}
    >
      <header className="schedule-calendar-head">
        <div>
          <span>CALENDAR VIEW</span>
          <h2>{label}</h2>
          <p>
            Shift colors follow the saved shift setup. Multiple schedules rotate
            inside their day instead of crowding the calendar.
          </p>
        </div>
        <nav aria-label="Calendar month controls">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button type="button" onClick={() => setMonth(today.slice(0, 7))}>
            Today
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="Next month"
          >
            ›
          </button>
        </nav>
      </header>
      <div className="schedule-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="schedule-calendar-grid">
        {calendarDays.map((day) => {
          const date = dateKey(day);
          const schedules = byDate.get(date) || [];
          const activeIndex = Math.min(
            slides[date] || 0,
            Math.max(0, schedules.length - 1),
          );
          const active = schedules[activeIndex];
          const outside = monthKey(day) !== month;
          return (
            <article
              className={`${outside ? "outside" : ""} ${date === today ? "today" : ""}`}
              key={date}
            >
              <header>
                <button
                  type="button"
                  className="schedule-calendar-date"
                  onClick={() => setSelectedDate(date)}
                  aria-label={`Open day view for ${dayLabel(date)}`}
                >
                  <time dateTime={date}>{day.getDate()}</time>
                </button>
                {schedules.length > 1 ? (
                  <span>
                    {activeIndex + 1}/{schedules.length}
                  </span>
                ) : null}
              </header>
              {active ? (
                <div
                  className="schedule-calendar-slide"
                  style={{ "--shift-color": active.color } as CSSProperties}
                >
                  <b>{active.name}</b>
                  <small>
                    {active.start || "Start not set"}
                    {active.end ? `–${active.end}` : ""}
                  </small>
                  <strong>{active.assignments.length} assigned</strong>
                  <p>
                    {active.assignments
                      .slice(0, 3)
                      .map((row) => row.employee_name)
                      .join(" · ") || "No employees assigned"}
                  </p>
                </div>
              ) : (
                <span className="schedule-calendar-empty">No schedule</span>
              )}
              {schedules.length > 1 ? (
                <footer>
                  <button
                    type="button"
                    onClick={() => moveSlide(date, schedules.length, -1)}
                    aria-label={`Previous schedule on ${date}`}
                  >
                    ‹
                  </button>
                  <div aria-label={`${schedules.length} schedules on ${date}`}>
                    {schedules.map((schedule, index) => (
                      <button
                        type="button"
                        className={index === activeIndex ? "active" : ""}
                        key={schedule.id}
                        onClick={() =>
                          setSlides((current) => ({
                            ...current,
                            [date]: index,
                          }))
                        }
                        aria-label={`Show ${schedule.name}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => moveSlide(date, schedules.length, 1)}
                    aria-label={`Next schedule on ${date}`}
                  >
                    ›
                  </button>
                </footer>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className="schedule-calendar-note">
        Slides advance every 5 seconds when a day has more than one schedule.
        Select a date for its complete day view, or use the arrows and dots to
        change the calendar card immediately.
      </p>
      {selectedDate ? (
        <div
          className="schedule-day-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDate(null);
          }}
        >
          <section
            className="schedule-day-view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-day-title"
          >
            <header className="schedule-day-head">
              <div>
                <span>DAY VIEW</span>
                <h2 id="schedule-day-title">{dayLabel(selectedDate)}</h2>
                <p>
                  {(byDate.get(selectedDate) || []).length} schedule
                  {(byDate.get(selectedDate) || []).length === 1 ? "" : "s"}
                  {" · "}
                  {(byDate.get(selectedDate) || []).reduce(
                    (count, schedule) => count + schedule.assignments.length,
                    0,
                  )}{" "}
                  assigned
                </p>
              </div>
              <button type="button" onClick={() => setSelectedDate(null)}>
                Close
              </button>
            </header>
            <nav className="schedule-day-nav" aria-label="Day controls">
              <button type="button" onClick={() => moveSelectedDay(-1)}>
                Previous day
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(today);
                  setMonth(today.slice(0, 7));
                }}
              >
                Today
              </button>
              <button type="button" onClick={() => moveSelectedDay(1)}>
                Next day
              </button>
            </nav>
            <div className="schedule-day-content">
              {(byDate.get(selectedDate) || []).length ? (
                (byDate.get(selectedDate) || []).map((schedule) => (
                  <article
                    className="schedule-day-shift"
                    style={
                      { "--shift-color": schedule.color } as CSSProperties
                    }
                    key={schedule.id}
                  >
                    <header>
                      <div>
                        <span>SCHEDULE</span>
                        <h3>{schedule.name}</h3>
                      </div>
                      <b>
                        {schedule.start || "Start not set"}
                        {schedule.end ? `–${schedule.end}` : ""}
                      </b>
                    </header>
                    <div className="schedule-day-roster">
                      {schedule.assignments.length ? (
                        schedule.assignments.map((assignment) => (
                          <div key={assignment.id}>
                            <strong>{assignment.employee_name}</strong>
                            <span>
                              {[assignment.role, assignment.rank]
                                .filter(Boolean)
                                .join(" · ") || "Position not entered"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p>No employees assigned.</p>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="schedule-day-empty">
                  <strong>No schedules for this date.</strong>
                  <p>
                    This day has no saved schedule or staffing assignments.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
