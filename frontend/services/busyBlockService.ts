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

export type BusyBlockType = "DAILY" | "WEEKLY" | "ONCE";

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
  /** All time windows for this block. Each tuple is a separate scheduled interval. */
  times?: Array<{ startTime: string; endTime: string }>;
  /** WEEKLY only: per-day schedule — supersedes daysOfWeek + times[] when present */
  weeklySchedule?: Array<{ dayOfWeek: number; times: Array<{ startTime: string; endTime: string }> }>;

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
  /** All time windows — each { startTime, endTime } in HH:MM. Omit for FULL_DAY. */
  times?: Array<{ startTime: string; endTime: string }>;
  /** WEEKLY only: per-day schedule — one entry per day with its own times[] */
  weeklySchedule?: Array<{ dayOfWeek: number; times: Array<{ startTime: string; endTime: string }> }>;
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
  const { blockType, date, daysOfWeek = [], times = [],
          weeklySchedule, bufferBeforeMinutes = 0, bufferAfterMinutes = 0 } = payload;

  if (blockType === "WEEKLY" && !weeklySchedule?.length && !daysOfWeek.length)
    return "Select at least one day of the week";
  if (blockType === "ONCE" && !date)
    return "Date is required for a one-time block";
  if (blockType === "FULL_DAY" && !date && !daysOfWeek.length)
    return "Provide a date (one-time) or days of week (recurring) for a day-off";

  // Validate weeklySchedule entries when present
  if (blockType === "WEEKLY" && weeklySchedule?.length) {
    for (let d = 0; d < weeklySchedule.length; d++) {
      const entry = weeklySchedule[d];
      if (!Array.isArray(entry.times) || entry.times.length === 0)
        return `Day ${d + 1} in weekly schedule has no time ranges`;
      for (let i = 0; i < entry.times.length; i++) {
        const { startTime, endTime } = entry.times[i];
        if (!startTime || !HH_MM.test(startTime)) return `Day ${d + 1} range ${i + 1}: start time must be HH:MM`;
        if (!endTime   || !HH_MM.test(endTime))   return `Day ${d + 1} range ${i + 1}: end time must be HH:MM`;
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        if (eh * 60 + em <= sh * 60 + sm) return `Day ${d + 1} range ${i + 1}: end time must be after start time`;
      }
    }
  } else if (blockType !== "FULL_DAY") {
    if (!times.length) return "Add at least one time range";
    for (let i = 0; i < times.length; i++) {
      const { startTime, endTime } = times[i];
      if (!startTime || !HH_MM.test(startTime)) return `times[${i}]: start time must be HH:MM`;
      if (!endTime   || !HH_MM.test(endTime))   return `times[${i}]: end time must be HH:MM`;
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      if (eh * 60 + em <= sh * 60 + sm) return `times[${i}]: end time must be after start time`;
    }
    // Overlap check
    const sorted = [...times].sort((a, b) => {
      const [ah, am] = a.startTime.split(":").map(Number);
      const [bh, bm] = b.startTime.split(":").map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });
    for (let i = 1; i < sorted.length; i++) {
      const [eh, em] = sorted[i - 1].endTime.split(":").map(Number);
      const [sh, sm] = sorted[i].startTime.split(":").map(Number);
      if (sh * 60 + sm < eh * 60 + em)
        return `Time ranges overlap: ${sorted[i - 1].startTime}\u2013${sorted[i - 1].endTime} and ${sorted[i].startTime}\u2013${sorted[i].endTime}`;
    }
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

// ──────────────────────────────────────────────────────────────────────────────
// Display helpers
// ──────────────────────────────────────────────────────────────────────────────

const _DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function _isoToTimePart(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "00:00";
  }
}

/**
 * Return a short human-readable summary for a BusyBlock row.
 * Works for all block types including legacy documents.
 */
export function blockSummary(block: BusyBlock): string {
  if (block.blockType === "ONCE") {
    const dateStr = block.date ? new Date(block.date).toISOString().slice(0, 10) : "";
    const timesStr = (block.times ?? []).map((t) => `${t.startTime}–${t.endTime}`).join(", ");
    return timesStr ? `${dateStr} ∣ ${timesStr}` : dateStr || "Once";
  }
  if (block.blockType === "WEEKLY") {
    if (block.weeklySchedule?.length) {
      return block.weeklySchedule
        .map((e) => {
          const t = (e.times ?? []).map((t) => `${t.startTime}–${t.endTime}`).join(", ");
          return `${_DAY_SHORT[e.dayOfWeek]} ∣ ${t}`;
        })
        .join("  •  ");
    }
    const days = (block.daysOfWeek ?? []).map((d) => _DAY_SHORT[d]).join(", ");
    const timesStr = (block.times ?? []).map((t) => `${t.startTime}–${t.endTime}`).join(", ");
    return timesStr ? `${days} ∣ ${timesStr}` : days || "Weekly";
  }
  if (block.blockType === "DAILY") {
    const timesStr = (block.times ?? []).map((t) => `${t.startTime}–${t.endTime}`).join(", ");
    return timesStr ? `Every day ∣ ${timesStr}` : "Every day";
  }
  // Legacy
  if (block.start && block.end) {
    return `${_isoToTimePart(block.start)} – ${_isoToTimePart(block.end)}`;
  }
  return "";
}

export const BLOCK_TYPE_LABEL: Record<BusyBlockType, string> = {
  DAILY:  "Every day",
  WEEKLY: "Weekly",
  ONCE:   "Specific date",
};
