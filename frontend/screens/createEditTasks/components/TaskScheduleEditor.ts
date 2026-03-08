// Utility functions for scheduling used by EditTask

export type EditableSession = {
  id?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

export function toLocalDateStr(dt?: string) {
  return dt || "";
}

export function toLocalTimeStr(dt?: string) {
  return dt || "";
}

export function combineLocalDateTime(date: string, time: string): Date {
  if (!date || !time) return new Date();

  // Parse date (YYYY-MM-DD) and time (HH:MM)
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  // Create a Date object in local time
  const dt = new Date(year, month - 1, day, hour, minute, 0);

  return dt;
}

/**
 * Combine a start date + end time into an end Date, automatically handling
 * overnight sessions without requiring the caller to supply a separate end date.
 *
 * Rule: if the end time (as minutes from midnight) is strictly less than OR
 * equal to the start time, the session crosses midnight — the end lands on
 * the next calendar day.
 *
 * Examples:
 *   date="2026-03-08", start="21:00", end="05:00"  → 2026-03-09T05:00 (overnight)
 *   date="2026-03-08", start="09:00", end="17:00"  → 2026-03-08T17:00 (same day)
 *   date="2026-03-08", start="22:00", end="22:00"  → treated as next day (zero duration would be caught by validation)
 */
export function combineEndDateTime(date: string, startTime: string, endTime: string): Date {
  if (!date || !startTime || !endTime) return new Date();

  const [year, month, day] = date.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  const startMinutes = sh * 60 + sm;
  const endMinutes   = eh * 60 + em;

  // If end is at or before start in wall-clock minutes → next calendar day
  const dayOffset = endMinutes <= startMinutes ? 1 : 0;

  return new Date(year, month - 1, day + dayOffset, eh, em, 0);
}

export function validateEditableSessions(sessions: EditableSession[]): string | null {
  // Validate basic session structure
  for (const session of sessions) {
    if (!session.date || !session.startTime || !session.endTime) {
      return "All session fields (date, start time, end time) are required";
    }

    // Intentionally NOT rejecting endTime < startTime: that is a valid overnight
    // session (e.g. 21:00 → 05:00 spans midnight). The payload builder uses
    // combineEndDateTime() which bumps the end to the next calendar day in that case.
  }

  return null;
}
