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

export type BusyBlockType = "DAILY" | "WEEKLY" | "ONCE" | "FULL_DAY";

/** Legacy recurrence sub-document (present on old records only) */
export interface BusyBlockRecurrence {
  /** Weekday indices: 0 = Sun, 1 = Mon, …, 6 = Sat */
  daysOfWeek: number[];
  /** ISO date string or null = ongoing forever */
  endDate: string | null;
}

export interface BusyBlock {
  _id: string;
  title: string;

  /** Discriminator — null on legacy documents */
  blockType: BusyBlockType | null;

  // Date targeting
  /** ISO datetime — ONCE / one-time FULL_DAY */
  date?: string | null;
  /** WEEKLY / recurring FULL_DAY: 0=Sun … 6=Sat */
  daysOfWeek?: number[];
  /** ISO datetime or null = no expiry (DAILY / WEEKLY / recurring FULL_DAY) */
  recurrenceEndDate?: string | null;

  // Times (HH:MM UTC) — absent for FULL_DAY
  startTime?: string | null;
  endTime?: string | null;

  // Buffer
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;

  // Legacy fields (present on old documents)
  start?: string;
  end?: string;
  isRecurring?: boolean;
  recurrence?: BusyBlockRecurrence | null;

  source: "manual" | "calendar";
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBusyBlockPayload {
  title?: string;
  blockType: BusyBlockType;
  /** YYYY-MM-DD or ISO — ONCE / one-time FULL_DAY */
  date?: string;
  /** WEEKLY / recurring FULL_DAY */
  daysOfWeek?: number[];
  /** ISO date or null = no expiry */
  recurrenceEndDate?: string | null;
  /** HH:MM — omit for FULL_DAY */
  startTime?: string;
  endTime?: string;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  source?: "manual";
}

export type UpdateBusyBlockPayload = Partial<Omit<CreateBusyBlockPayload, "blockType">> & {
  blockType?: BusyBlockType;
};

// ──────────────────────────────────────────────────────────────────────────────
// Pure domain helpers (no I/O)
// ──────────────────────────────────────────────────────────────────────────────

/** Normalise a raw server response — ensure numeric buffers are always present. */
export function normalizeBusyBlock(raw: BusyBlock): BusyBlock {
  return {
    ...raw,
    bufferBeforeMinutes: raw.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes:  raw.bufferAfterMinutes  ?? 0,
    daysOfWeek: raw.daysOfWeek ?? [],
    // Normalise legacy fields if present
    isRecurring: Boolean(raw.isRecurring),
    start: raw.start ? new Date(raw.start).toISOString() : undefined,
    end:   raw.end   ? new Date(raw.end).toISOString()   : undefined,
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
 * Client-side validation for a new-style block.
 * Returns an error string or null when valid.
 */
export function validateBusyBlockPayload(payload: CreateBusyBlockPayload): string | null {
  const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const { blockType, date, daysOfWeek = [], startTime, endTime,
          bufferBeforeMinutes = 0, bufferAfterMinutes = 0 } = payload;

  if (blockType === "WEEKLY" && !daysOfWeek.length)
    return "Select at least one day of the week";
  if (blockType === "ONCE" && !date)
    return "Date is required for a one-time block";
  if (blockType === "FULL_DAY" && !date && !daysOfWeek.length)
    return "Provide a date (one-time) or days of week (recurring) for a day-off";
  if (blockType !== "FULL_DAY") {
    if (!startTime || !HH_MM.test(startTime)) return "Start time must be HH:MM";
    if (!endTime   || !HH_MM.test(endTime))   return "End time must be HH:MM";
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) return "End time must be after start time";
  }
  if (bufferBeforeMinutes < 0 || bufferBeforeMinutes > 120) return "Buffer before must be 0–120 min";
  if (bufferAfterMinutes  < 0 || bufferAfterMinutes  > 120) return "Buffer after must be 0–120 min";
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

/** Create a new busy block. */
export async function createBusyBlock(payload: CreateBusyBlockPayload): Promise<BusyBlock> {
  const err = validateBusyBlockPayload(payload);
  if (err) throw new Error(err);
  const data = await post<{ busyBlock: BusyBlock }>("/busy-blocks", payload);
  return normalizeBusyBlock(data.busyBlock);
}

/** Update an existing busy block. */
export async function updateBusyBlock(
  id: string,
  payload: UpdateBusyBlockPayload
): Promise<BusyBlock> {
  const data = await put<{ busyBlock: BusyBlock }>(`/busy-blocks/${id}`, payload);
  return normalizeBusyBlock(data.busyBlock);
}

/** Delete a busy block by ID. */
export async function deleteBusyBlock(id: string): Promise<void> {
  await del<{ success: boolean }>(`/busy-blocks/${id}`);
}
