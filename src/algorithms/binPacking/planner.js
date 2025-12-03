// src/services/planner.js
// Schedules task durations into available calendar slots.

import { getFreeIntervalsForDay, subtractInterval, buildWorkingWindow } from "./calendar.js";
import { addDays, startOfDay, addMinutes } from "./calendarUtils.js";
import { TaskSchedule } from "../../models/TaskSchedule.js";

const DEFAULT_WORKING_HOURS = {
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
};

const DEFAULT_BREAK_MINUTES = 15;
const MIN_SPLIT_CHUNK = 15;

const clampMinutes = (value, min, max) => Math.max(min, Math.min(max, value));

const minutesBetween = (start, end) => Math.max(0, Math.round((end - start) / 60000));

const enumerateDates = (start, end) => {
  const dates = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    dates.push({ date: cursor, dateKey: toDateKey(cursor) });
    cursor = addDays(cursor, 1);
  }
  return dates;
};

const ensureWorkingWindow = (cache, dateKey, date, workingHours) => {
  if (!cache[dateKey]) {
    cache[dateKey] = buildWorkingWindow(date, workingHours);
  }
  return cache[dateKey];
};

const ensureFreeIntervals = (cache, dateKey, date, workingHours, busyBlocksByDate) => {
  if (!cache[dateKey]) {
    cache[dateKey] = getFreeIntervalsForDay(date, workingHours, busyBlocksByDate[dateKey] || []);
  }
  return cache[dateKey];
};

const pickBestFitSlot = ({ candidateDates, chunkMinutes, freeCache, busyBlocksByDate, workingHours, workingWindowCache }) => {
  let best = null;

  for (const { date, dateKey } of candidateDates) {
    const intervals = ensureFreeIntervals(freeCache, dateKey, date, workingHours, busyBlocksByDate);
    if (!intervals.length) continue;

    for (const interval of intervals) {
      const available = minutesBetween(interval.start, interval.end);
      if (available < chunkMinutes) continue;

      const leftover = available - chunkMinutes;
      if (
        !best ||
        date.getTime() < best.date.getTime() ||
        (date.getTime() === best.date.getTime() && leftover < best.leftover) ||
        (
          date.getTime() === best.date.getTime() &&
          leftover === best.leftover &&
          interval.start.getTime() < best.interval.start.getTime()
        )
      ) {
        const window = ensureWorkingWindow(workingWindowCache, dateKey, date, workingHours);
        best = {
          date,
          dateKey,
          interval,
          leftover,
          workingWindow: window,
        };
      }
    }
  }

  if (!best) return null;

  const start = best.interval.start;
  const end = addMinutes(start, chunkMinutes);
  return {
    date: best.date,
    dateKey: best.dateKey,
    start,
    end,
    workingWindow: best.workingWindow,
  };
};

const determineChunkSize = (task, remaining) => {
  const type = task.taskType || (task.canSplit ? "in_parts" : "perfect");
  if (type === "leaky" && Number.isFinite(task.minMinutes)) {
    return Math.min(remaining, Math.max(MIN_SPLIT_CHUNK, task.minMinutes));
  }
  if (type === "perfect" || !task.canSplit) {
    return remaining;
  }
  if (type === "in_parts" && Number.isFinite(task.chunkMinutes)) {
    return Math.min(remaining, Math.max(MIN_SPLIT_CHUNK, Math.round(task.chunkMinutes)));
  }
  return task.canSplit ? Math.min(remaining, Math.max(task.minChunk || MIN_SPLIT_CHUNK, MIN_SPLIT_CHUNK)) : remaining;
};

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
    const effectiveType = task.taskType || (task.canSplit ? "in_parts" : "perfect");

    if (effectiveType === "leaky") {
      const targetMin = Math.max(task.minMinutes || MIN_SPLIT_CHUNK, MIN_SPLIT_CHUNK);
      const targetMax = task.maxMinutes && task.maxMinutes >= targetMin ? task.maxMinutes : remaining;
      remaining = clampMinutes(remaining, targetMin, targetMax);
    }

    const dueDate = task.dueDate ? startOfDay(new Date(task.dueDate)) : horizonEnd;
    const rangeEnd = dueDate < horizonEnd ? dueDate : horizonEnd;
    const candidateDates = enumerateDates(today, rangeEnd);

    let freeCache = {};
    let workingWindowCache = {};

    while (remaining > 0) {
      const chunkSize = determineChunkSize(task, remaining);
      if (!chunkSize) break;

      const slot = pickBestFitSlot({
        candidateDates,
        chunkMinutes: chunkSize,
        freeCache,
        busyBlocksByDate,
        workingHours,
        workingWindowCache,
      });

      if (!slot) break;

      plan.push({
        taskId: task._id,
        title: task.taskname || task.title,
        date: slot.dateKey,
        start: slot.start,
        end: slot.end,
        minutes: chunkSize,
      });

      remaining -= chunkSize;
      const slotInterval = { start: slot.start, end: slot.end };
      freeCache[slot.dateKey] = subtractInterval(freeCache[slot.dateKey], slotInterval);
      if (!busyBlocksByDate[slot.dateKey]) busyBlocksByDate[slot.dateKey] = [];
      busyBlocksByDate[slot.dateKey].push(slotInterval);

      if (DEFAULT_BREAK_MINUTES > 0 && slot.end < slot.workingWindow.end) {
        const breakEndCandidate = addMinutes(slot.end, DEFAULT_BREAK_MINUTES);
        const breakInterval = {
          start: slot.end,
          end: breakEndCandidate > slot.workingWindow.end ? slot.workingWindow.end : breakEndCandidate,
        };
        if (breakInterval.end > breakInterval.start) {
          busyBlocksByDate[slot.dateKey].push(breakInterval);
          freeCache[slot.dateKey] = subtractInterval(freeCache[slot.dateKey], breakInterval);
        }
      }

      if (!task.canSplit && remaining > 0) break;
    }

    if (remaining > 0) {
      unscheduled.push({
        taskId: task._id,
        title: task.taskname || task.title,
        remainingMinutes: remaining,
      });
    }
  }

  return { plan, unscheduled };
}

export async function persistPlan(userId, plan) {
  if (!plan.length) return;

  const docs = plan.map((slot) => ({
    userId,
    taskId: slot.taskId,
    start: slot.start,
    end: slot.end,
    minutes: slot.minutes,
  }));

  await TaskSchedule.insertMany(docs);
}
