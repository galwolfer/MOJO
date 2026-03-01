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

export function validateEditableSessions(sessions: EditableSession[]): string | null {
  // Validate basic session structure
  for (const session of sessions) {
    if (!session.date || !session.startTime || !session.endTime) {
      return "All session fields (date, start time, end time) are required";
    }

    // Basic time validation
    if (session.startTime >= session.endTime) {
      return "Start time must be before end time";
    }
  }

  return null;
}
