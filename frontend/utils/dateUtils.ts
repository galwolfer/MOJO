/**
 * Date Utility Functions
 *
 * Centralized date helpers used across calendar, task service, and UI components.
 * Avoids UTC conversion pitfalls by operating on local date parts only.
 */

/**
 * Convert a local Date to a YYYY-MM-DD string without UTC conversion.
 *
 * @param date - The date to format
 * @returns A string in "YYYY-MM-DD" format using the local timezone
 *
 * @example
 * getLocalDateString(new Date(2026, 1, 19)) // "2026-02-19"
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Strip the time portion from a Date, returning midnight of the same day.
 *
 * @param date - The date to strip
 * @returns A new Date at 00:00:00.000 on the same calendar day
 *
 * @example
 * stripTime(new Date("2026-02-19T14:30:00")) // Date at 2026-02-19T00:00:00
 */
export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
