// src/utils/dateUtils.js
// Date/time utility functions used by scheduling algorithms.

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pad a number with leading zeros.
 * @param {number|string} value - Value to pad
 * @param {number} length - Desired length (default 2)
 * @returns {string}
 */
export function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

/**
 * Format a date as local date-time string (YYYY-MM-DD HH:mm).
 * @param {Date} date - The date to format
 * @returns {string}
 */
export function formatLocalDateTime(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format a date as local date string (YYYY-MM-DD).
 * @param {Date} date - The date to format
 * @returns {string}
 */
export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Parse a date-only string (YYYY-MM-DD) into a Date object.
 * @param {string} input - Date string in YYYY-MM-DD format
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDateOnly(input) {
  if (!DATE_ONLY_REGEX.test(input)) return null;
  const parsed = new Date(`${input}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
 * Get the start of day (UTC midnight) for a date.
 * Always uses UTC so that date keys like .toISOString().slice(0,10) are
 * consistent with the Python scheduler, which works exclusively in UTC.
 * @param {Date} date - The date
 * @returns {Date} UTC midnight of that date
 */
export function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Add days to a date using millisecond arithmetic so the result is always
 * exactly N × 24 h ahead in UTC (no DST/local-time drift).
 * @param {Date} date - The starting date
 * @param {number} days - Days to add
 * @returns {Date}
 */
export function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Check if a date is in the future (compared to today at midnight).
 * @param {Date} date - The date to check
 * @returns {boolean}
 */
export function isFutureDate(date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date > now;
}
