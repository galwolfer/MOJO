// src/services/calendarUtils.js

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function clampDate(target, min, max) {
  return new Date(Math.min(Math.max(target.getTime(), min.getTime()), max.getTime()));
}

export function isBeforeOrEqual(a, b) {
  return a.getTime() <= b.getTime();
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
