// src/services/planner.js
// Schedules task durations into available calendar slots.

import { getFreeIntervalsForDay, subtractInterval, findSlot, buildWorkingWindow } from "./calendar.js";
import { addDays, startOfDay, addMinutes } from "./calendarUtils.js";

const DEFAULT_WORKING_HOURS = {
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
};

const DEFAULT_BREAK_MINUTES = 15;

const toDateKey = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function planTasks(tasks, { busyBlocksByDate = {}, workingHours = DEFAULT_WORKING_HOURS, planningHorizonDays = 14 } = {}) {
  const today = startOfDay(new Date());
  const horizonEnd = addDays(today, planningHorizonDays);

  const sorted = [...tasks].sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate) : horizonEnd;
    const bDue = b.dueDate ? new Date(b.dueDate) : horizonEnd;
    if (aDue.getTime() !== bDue.getTime()) return aDue - bDue;
    return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
  });

  const plan = [];
  const unscheduled = [];

  for (const task of sorted) {
    let remaining = task.estimatedDuration || 0;
    if (!remaining) continue;

    const dueDate = task.dueDate ? startOfDay(new Date(task.dueDate)) : horizonEnd;
    let cursor = today;

    let freeCache = {};
    let scheduledMinutes = 0;

    while (cursor <= dueDate && cursor <= horizonEnd && remaining > 0) {
      const dateKey = toDateKey(cursor);
      const workingWindow = buildWorkingWindow(cursor, workingHours);
      if (!freeCache[dateKey]) {
        freeCache[dateKey] = getFreeIntervalsForDay(cursor, workingHours, busyBlocksByDate[dateKey] || []);
      }

      let freeIntervals = freeCache[dateKey];
      if (!freeIntervals.length) {
        cursor = addDays(cursor, 1);
        continue;
      }

      const chunkSize = Math.min(
        remaining,
        task.canSplit ? Math.max(task.minChunk || 30, 15) : remaining
      );

      const slot = findSlot(freeIntervals, chunkSize);
      if (!slot) {
        cursor = addDays(cursor, 1);
        continue;
      }

      plan.push({
        taskId: task._id,
        title: task.title,
        date: dateKey,
        start: slot.start,
        end: slot.end,
        minutes: chunkSize,
      });

      scheduledMinutes += chunkSize;
      remaining -= chunkSize;
      freeCache[dateKey] = subtractInterval(freeIntervals, slot);
      busyBlocksByDate[dateKey] = (busyBlocksByDate[dateKey] || []).concat(slot);

      if (DEFAULT_BREAK_MINUTES > 0 && slot.end < workingWindow.end) {
        const breakEnd = addMinutes(slot.end, DEFAULT_BREAK_MINUTES);
        const breakInterval = {
          start: slot.end,
          end: breakEnd > workingWindow.end ? workingWindow.end : breakEnd,
        };
        busyBlocksByDate[dateKey].push(breakInterval);
        freeCache[dateKey] = subtractInterval(freeCache[dateKey], breakInterval);
      }

      if (!task.canSplit && remaining > 0) {
        break;
      }

      if (remaining > 0 && task.canSplit) {
        cursor = addDays(cursor, 1);
        continue;
      }
    }

    if (remaining > 0) {
      unscheduled.push({
        taskId: task._id,
        title: task.title,
        remainingMinutes: remaining,
      });
    }
  }

  return { plan, unscheduled };
}
