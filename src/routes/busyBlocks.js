/*
 * File: src/routes/busyBlocks.js
 * Purpose: CRUD HTTP endpoints for busy blocks / time-off rules.
 *
 * New-style POST / PUT body (blockType present):
 * ─────────────────────────────────────────────
 *  DAILY    { blockType:"DAILY",    times:[{startTime,endTime}], recurrenceEndDate?, bufferBeforeMinutes?, bufferAfterMinutes?, title? }
 *  WEEKLY   { blockType:"WEEKLY",   daysOfWeek, times:[{startTime,endTime}], recurrenceEndDate?, buffer…, title? }
 *  ONCE     { blockType:"ONCE",     date, times:[{startTime,endTime}], buffer…, title? }
 *  FULL_DAY { blockType:"FULL_DAY", date? OR daysOfWeek, recurrenceEndDate?, buffer…, title? }
 *
 * Legacy POST / PUT body (no blockType — kept for backward compat):
 * ──────────────────────────────────────────────────────────────────
 *  One-time  (isRecurring = false): { title?, start, end, source? }
 *  Recurring (isRecurring = true):  { title?, start, end, isRecurring: true,
 *                                     recurrence: { daysOfWeek, endDate? }, source? }
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  createBusyBlock,
  getUpcomingBusyBlocks,
  updateBusyBlock,
  deleteBusyBlock,
} from "../services/taskService.js";
import { BusyBlock } from "../models/BusyBlock.js";
import { triggerSchedulerUpdate } from "../services/schedulingService.js";

const router = Router();
router.use(requireAuth);

// ── Shared helpers ──────────────────────────────────────────────────────────

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_TYPES = ["DAILY", "WEEKLY", "ONCE", "FULL_DAY"];

/**
 * Validate a new-style block payload. Returns an error string or null.
 */
function validateNewBlock({ blockType, date, daysOfWeek = [], times = [],
                            weeklySchedule, bufferBeforeMinutes = 0, bufferAfterMinutes = 0 }) {
  if (!VALID_TYPES.includes(blockType))
    return `blockType must be one of ${VALID_TYPES.join(", ")}`;

  if (blockType === "WEEKLY" && !(weeklySchedule?.length) && (!Array.isArray(daysOfWeek) || !daysOfWeek.length))
    return "For WEEKLY blocks, provide weeklySchedule or daysOfWeek";

  if (blockType === "FULL_DAY" && !date && (!Array.isArray(daysOfWeek) || !daysOfWeek.length))
    return "FULL_DAY blocks require either date (one-time) or daysOfWeek (recurring)";

  if ((blockType === "ONCE" || (blockType === "FULL_DAY" && date && !(daysOfWeek?.length))) && !date)
    return "date is required for ONCE blocks and one-time FULL_DAY blocks";

  if (date && isNaN(new Date(date).getTime()))
    return "Invalid date value";

  if (blockType !== "FULL_DAY" && !(blockType === "WEEKLY" && weeklySchedule?.length)) {
    if (!Array.isArray(times) || times.length === 0)
      return "At least one time entry is required (times must be a non-empty array)";
    for (let i = 0; i < times.length; i++) {
      const { startTime, endTime } = times[i] || {};
      if (!startTime || !HH_MM_RE.test(startTime)) return `times[${i}].startTime must be HH:MM`;
      if (!endTime   || !HH_MM_RE.test(endTime))   return `times[${i}].endTime must be HH:MM`;
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      if (eh * 60 + em <= sh * 60 + sm) return `times[${i}]: endTime must be after startTime`;
    }
    // Overlap check: sort by start, verify consecutive pairs don't overlap
    const sorted = [...times].sort((a, b) => {
      const [ah, am] = a.startTime.split(":").map(Number);
      const [bh, bm] = b.startTime.split(":").map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });
    for (let i = 1; i < sorted.length; i++) {
      const [eh, em] = sorted[i - 1].endTime.split(":").map(Number);
      const [sh, sm] = sorted[i].startTime.split(":").map(Number);
      if (sh * 60 + sm < eh * 60 + em)
        return `Time ranges overlap: ${sorted[i - 1].startTime}-${sorted[i - 1].endTime} and ${sorted[i].startTime}-${sorted[i].endTime}`;
    }
  }

  if ((bufferBeforeMinutes ?? 0) < 0 || (bufferBeforeMinutes ?? 0) > 120)
    return "bufferBeforeMinutes must be 0–120";
  if ((bufferAfterMinutes ?? 0) < 0 || (bufferAfterMinutes ?? 0) > 120)
    return "bufferAfterMinutes must be 0–120";

  return null;
}

// ── Legacy helpers (kept for backward compat) ─────────────────────────────

function parseRequiredDate(value, fieldName) {
  if (!value) return { date: null, error: `${fieldName} is required` };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { date: null, error: `Invalid date format for ${fieldName}` };
  return { date: d, error: null };
}

function parseOptionalDate(value) {
  if (value === undefined || value === null) return { date: undefined, error: null };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { date: null, error: "Invalid date format" };
  return { date: d, error: null };
}

function validateRecurrencePayload(recurrence) {
  if (!recurrence || !Array.isArray(recurrence.daysOfWeek) || recurrence.daysOfWeek.length === 0) {
    return "Recurring blocks require at least one day of week in recurrence.daysOfWeek";
  }
  if (recurrence.daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return "recurrence.daysOfWeek must be integers 0–6 (0=Sun … 6=Sat)";
  }
  return null;
}

function parseRecurrence(recurrence) {
  return {
    daysOfWeek: recurrence.daysOfWeek,
    endDate: recurrence.endDate ? new Date(recurrence.endDate) : null,
  };
}

// ── GET /api/busy-blocks ────────────────────────────────────────────────────
// Returns all active blocks: one-time (end > now) + recurring (not expired).
router.get("/", async (req, res, next) => {
  try {
    const blocks = await getUpcomingBusyBlocks(req.user.userId);
    res.json({ success: true, busyBlocks: blocks });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/busy-blocks ───────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      title = "",
      blockType,
      date,
      daysOfWeek = [],
      recurrenceEndDate = null,
      times = [],
      weeklySchedule,
      bufferBeforeMinutes = 0,
      bufferAfterMinutes = 0,
      source = "manual",
      // Legacy fields
      start, end, isRecurring = false, recurrence,
    } = req.body;

    // ── New-style block ──────────────────────────────────────────────────────
    if (blockType) {
      const validTimes = Array.isArray(times) ? times : [];

      const err = validateNewBlock({ blockType, date, daysOfWeek, times: validTimes,
                                     weeklySchedule, bufferBeforeMinutes, bufferAfterMinutes });
      if (err) return res.status(400).json({ success: false, error: err });

      const block = await BusyBlock.create({
        userId, title, blockType,
        date: (blockType === "ONCE" || blockType === "FULL_DAY") && date ? new Date(date) : null,
        daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        weeklySchedule: Array.isArray(weeklySchedule) ? weeklySchedule : [],
        times:     blockType !== "FULL_DAY" ? validTimes : [],
        bufferBeforeMinutes: Number(bufferBeforeMinutes) || 0,
        bufferAfterMinutes:  Number(bufferAfterMinutes)  || 0,
        source,
      });
      triggerSchedulerUpdate(userId, "busy-block-create", "busyBlocks API").catch(() => {});
      return res.status(201).json({ success: true, busyBlock: block });
    }

    // ── Legacy path (isRecurring / start+end) ────────────────────────────────
    const { date: startDate, error: startErr } = parseRequiredDate(start, "start");
    if (startErr) return res.status(400).json({ success: false, error: startErr });

    const { date: endDate, error: endErr } = parseRequiredDate(end, "end");
    if (endErr) return res.status(400).json({ success: false, error: endErr });

    let parsedRecurrence = null;

    if (!isRecurring) {
      if (endDate <= startDate) {
        return res.status(400).json({ success: false, error: "end must be after start" });
      }
      const overlap = await BusyBlock.findOne({
        userId,
        isRecurring: { $ne: true },
        blockType: null,
        start: { $lt: endDate },
        end: { $gt: startDate },
      });
      if (overlap) {
        return res.status(409).json({
          success: false,
          error: "This time range overlaps with an existing busy block",
        });
      }
    } else {
      const recErr = validateRecurrencePayload(recurrence);
      if (recErr) return res.status(400).json({ success: false, error: recErr });
      parsedRecurrence = parseRecurrence(recurrence);
    }

    const block = await createBusyBlock({
      userId, title,
      start: startDate,
      end: endDate,
      isRecurring: Boolean(isRecurring),
      recurrence: parsedRecurrence,
      source,
    });
    triggerSchedulerUpdate(userId, "busy-block-create", "busyBlocks API").catch(() => {});
    res.status(201).json({ success: true, busyBlock: block });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/busy-blocks/:id ────────────────────────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const blockId = req.params.id;

    const block = await BusyBlock.findOne({ _id: blockId, userId });
    if (!block) return res.status(404).json({ success: false, error: "Busy block not found" });

    // ── New-style fields ─────────────────────────────────────────────────────
    const newStyleFields = [
      "title", "blockType", "date", "daysOfWeek", "recurrenceEndDate",
      "weeklySchedule", "times", "bufferBeforeMinutes", "bufferAfterMinutes",
    ];
    for (const key of newStyleFields) {
      if (req.body[key] !== undefined) block[key] = req.body[key];
    }
    // Coerce date fields
    if (req.body.date !== undefined) block.date = req.body.date ? new Date(req.body.date) : null;
    if (req.body.recurrenceEndDate !== undefined)
      block.recurrenceEndDate = req.body.recurrenceEndDate ? new Date(req.body.recurrenceEndDate) : null;

    // Validate if blockType is set (either already or just updated)
    if (block.blockType) {
      const err = validateNewBlock({
        blockType: block.blockType, date: block.date, daysOfWeek: block.daysOfWeek,
        weeklySchedule: block.weeklySchedule, times: block.times,
        bufferBeforeMinutes: block.bufferBeforeMinutes, bufferAfterMinutes: block.bufferAfterMinutes,
      });
      if (err) return res.status(400).json({ success: false, error: err });
    }

    // ── Legacy fields (only applied when blockType is absent) ────────────────
    if (!block.blockType) {
      const { title, start, end, isRecurring, recurrence } = req.body;
      if (title   !== undefined) block.title = title;

      const { date: startDate, error: startErr } = parseOptionalDate(start);
      if (startErr) return res.status(400).json({ success: false, error: `start: ${startErr}` });
      const { date: endDate,   error: endErr   } = parseOptionalDate(end);
      if (endErr)   return res.status(400).json({ success: false, error: `end: ${endErr}` });

      const effectiveIsRecurring = isRecurring !== undefined ? isRecurring : block.isRecurring;
      if (!effectiveIsRecurring && (startDate !== undefined || endDate !== undefined)) {
        const effectiveStart = startDate ?? new Date(block.start);
        const effectiveEnd   = endDate   ?? new Date(block.end);
        if (effectiveEnd <= effectiveStart)
          return res.status(400).json({ success: false, error: "end must be after start" });
      } else if (effectiveIsRecurring && recurrence !== undefined) {
        const recErr = validateRecurrencePayload(recurrence);
        if (recErr) return res.status(400).json({ success: false, error: recErr });
      }

      if (startDate !== undefined) block.start = startDate;
      if (endDate   !== undefined) block.end   = endDate;
      if (isRecurring !== undefined) block.isRecurring = Boolean(isRecurring);
      if (recurrence !== undefined) block.recurrence = parseRecurrence(recurrence);
    }

    await block.save();
    triggerSchedulerUpdate(userId, "busy-block-update", "busyBlocks API").catch(() => {});
    res.json({ success: true, busyBlock: block });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/busy-blocks/:id ─────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const blockId = req.params.id;
    const deleted = await deleteBusyBlock(blockId, userId);
    if (!deleted) return res.status(404).json({ success: false, error: "Busy block not found" });
    // Reschedule all tasks now that this busy block is gone (fire-and-forget)
    triggerSchedulerUpdate(userId, "busy-block-delete", "busyBlocks API").catch(() => {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
