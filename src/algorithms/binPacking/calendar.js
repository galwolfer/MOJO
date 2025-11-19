// src/services/calendar.js
// Calendar utility helpers for finding free intervals and working with busy blocks.

import { addMinutes, clampDate, isBeforeOrEqual } from "./calendarUtils.js";

export function buildWorkingWindow(date, workingHours) {
  const start = new Date(date);
  start.setHours(workingHours.startHour, workingHours.startMinute, 0, 0);
  const end = new Date(date);
  end.setHours(workingHours.endHour, workingHours.endMinute, 0, 0);
  return { start, end };
}

export function normalizeBusyBlocks(busyBlocks = [], dayStart, dayEnd) {
  const normalized = busyBlocks
    .map((block) => ({
      start: clampDate(new Date(block.start), dayStart, dayEnd),
      end: clampDate(new Date(block.end), dayStart, dayEnd),
    }))
    .filter((block) => block.end > block.start)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const block of normalized) {
    const last = merged[merged.length - 1];
    if (!last || block.start > last.end) {
      merged.push({ ...block });
    } else {
      last.end = new Date(Math.max(last.end.getTime(), block.end.getTime()));
    }
  }
  return merged;
}

export function getFreeIntervalsForDay(date, workingHours, busyBlocks = []) {
  const window = buildWorkingWindow(date, workingHours);
  const normalizedBusy = normalizeBusyBlocks(busyBlocks, window.start, window.end);

  const free = [];
  let cursor = window.start;

  for (const block of normalizedBusy) {
    if (block.start > cursor) {
      free.push({ start: cursor, end: block.start });
    }
    if (block.end > cursor) {
      cursor = block.end;
    }
  }

  if (cursor < window.end) {
    free.push({ start: cursor, end: window.end });
  }

  return free;
}

export function findSlot(freeIntervals, durationMinutes) {
  for (const interval of freeIntervals) {
    const available = (interval.end - interval.start) / 60000;
    if (available >= durationMinutes) {
      return {
        start: interval.start,
        end: addMinutes(interval.start, durationMinutes),
      };
    }
  }
  return null;
}

export function subtractInterval(intervals, intervalToRemove) {
  const result = [];
  for (const interval of intervals) {
    if (intervalToRemove.start >= interval.end || intervalToRemove.end <= interval.start) {
      result.push(interval);
      continue;
    }
    if (intervalToRemove.start > interval.start) {
      result.push({ start: interval.start, end: intervalToRemove.start });
    }
    if (intervalToRemove.end < interval.end) {
      result.push({ start: intervalToRemove.end, end: interval.end });
    }
  }
  return result.sort((a, b) => a.start - b.start);
}
