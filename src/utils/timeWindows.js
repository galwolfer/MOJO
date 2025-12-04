// src/utils/timeWindows.js
// Utility helpers for working with time windows.

/**
 * Build a working hours window for a given date.
 * @param {Date} date - The date to build the window for
 * @param {object} workingHours - Working hours config {startHour, startMinute, endHour, endMinute}
 * @returns {{ start: Date, end: Date }}
 */
export function buildWorkingWindow(date, workingHours) {
  const start = new Date(date);
  start.setHours(workingHours.startHour, workingHours.startMinute, 0, 0);
  const end = new Date(date);
  end.setHours(workingHours.endHour, workingHours.endMinute, 0, 0);
  return { start, end };
}
