/**
 * Frontend service for BusyBlock CRUD operations.
 *
 * Two block types mirror the backend schema:
 *
 *  ONE-TIME  (isRecurring = false)
 *    start / end — full ISO datetimes for the unavailable window.
 *
 *  RECURRING (isRecurring = true)
 *    start — reference datetime: date = recurrence activation date, time = daily start time
 *    end   — reference datetime: same date as start, time = daily end time
 *    recurrence.daysOfWeek — [0..6], 0 = Sunday
 *    recurrence.endDate    — ISO date string or null (ongoing)
 *
 * All API calls: GET / POST / PUT / DELETE /api/busy-blocks
 */
import { get, post, put, del } from "./httpClient";

// ──────────────────────────────────────────────────────────────────────────────
// Domain types
// ──────────────────────────────────────────────────────────────────────────────

export interface BusyBlockRecurrence {
  /** Weekday indices: 0 = Sun, 1 = Mon, …, 6 = Sat */
  daysOfWeek: number[];
  /** ISO date string or null = ongoing forever */
  endDate: string | null;
}

export interface BusyBlock {
  _id: string;
  title: string;
  /** ISO datetime string */
  start: string;
  /** ISO datetime string */
  end: string;
  isRecurring: boolean;
  recurrence: BusyBlockRecurrence | null;
  source: "manual" | "calendar";
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBusyBlockPayload {
  title?: string;
  /** Full ISO datetime (one-time) or reference date + daily time (recurring) */
  start: string;
  end: string;
  isRecurring?: boolean;
  recurrence?: {
    daysOfWeek: number[];
    endDate?: string | null;
  };
  source?: "manual";
}

export interface UpdateBusyBlockPayload {
  title?: string;
  start?: string;
  end?: string;
  isRecurring?: boolean;
  recurrence?: {
    daysOfWeek: number[];
    endDate?: string | null;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Pure domain helpers (no I/O)
// ──────────────────────────────────────────────────────────────────────────────

/** Normalise a raw server response so start/end are always valid ISO strings. */
export function normalizeBusyBlock(raw: BusyBlock): BusyBlock {
  return {
    ...raw,
    isRecurring: Boolean(raw.isRecurring),
    start: new Date(raw.start).toISOString(),
    end: new Date(raw.end).toISOString(),
    recurrence: raw.recurrence
      ? {
          daysOfWeek: raw.recurrence.daysOfWeek ?? [],
          endDate: raw.recurrence.endDate
            ? new Date(raw.recurrence.endDate).toISOString()
            : null,
        }
      : null,
  };
}

/**
 * Validate a one-time block's start/end before sending to the server.
 * Returns an error string or null when valid.
 */
export function validateBusyBlock(start: string, end: string): string | null {
  if (!start) return "Start date and time are required";
  if (!end) return "End date and time are required";
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime())) return "Invalid start date/time";
  if (isNaN(e.getTime())) return "Invalid end date/time";
  if (e <= s) return "End time must be after start time";
  return null;
}

/**
 * Validate a recurring block's time range (time portion only).
 * Returns an error string or null when valid.
 */
export function validateRecurringBlock(
  startTime: string,
  endTime: string,
  daysOfWeek: number[]
): string | null {
  if (!startTime) return "Start time is required";
  if (!endTime) return "End time is required";
  if (!daysOfWeek.length) return "Select at least one day of the week";

  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return "Invalid time format — use HH:MM";

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return "End time must be after start time";
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// API calls
// ──────────────────────────────────────────────────────────────────────────────

/** List all active busy blocks (one-time + recurring). */
export async function listBusyBlocks(): Promise<BusyBlock[]> {
  const data = await get<{ busyBlocks: BusyBlock[] }>("/busy-blocks");
  return (data.busyBlocks || []).map(normalizeBusyBlock);
}

/** Create a new busy block (one-time or recurring). */
export async function createBusyBlock(payload: CreateBusyBlockPayload): Promise<BusyBlock> {
  // Client-side validation
  if (!payload.isRecurring) {
    const err = validateBusyBlock(payload.start, payload.end);
    if (err) throw new Error(err);
  }
  const data = await post<{ busyBlock: BusyBlock }>("/busy-blocks", payload);
  return normalizeBusyBlock(data.busyBlock);
}

/** Update an existing busy block. */
export async function updateBusyBlock(
  id: string,
  payload: UpdateBusyBlockPayload
): Promise<BusyBlock> {
  if (!payload.isRecurring && payload.start && payload.end) {
    const err = validateBusyBlock(payload.start, payload.end);
    if (err) throw new Error(err);
  }
  const data = await put<{ busyBlock: BusyBlock }>(`/busy-blocks/${id}`, payload);
  return normalizeBusyBlock(data.busyBlock);
}

/** Delete a busy block by ID. */
export async function deleteBusyBlock(id: string): Promise<void> {
  await del<{ success: boolean }>(`/busy-blocks/${id}`);
}
