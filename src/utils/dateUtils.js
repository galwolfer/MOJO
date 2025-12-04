// src/utils/dateUtils.js
// Date/time utility functions used by scheduling algorithms.

/**
 * Add minutes to a date.
 * @param {Date} date - The starting date
 * @param {number} minutes - Minutes to add
 * @returns {Date}
 */
export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Get the start of day (midnight) for a date.
 * @param {Date} date - The date
 * @returns {Date}
 */
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Add days to a date.
 * @param {Date} date - The starting date
 * @param {number} days - Days to add
 * @returns {Date}
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
