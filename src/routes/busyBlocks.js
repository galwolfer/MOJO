/*
 * File: src/routes/busyBlocks.js
 * Purpose: CRUD HTTP endpoints for busy blocks (one-time and recurring).
 *
 * POST / PUT body shapes
 * ──────────────────────
 * One-time  (isRecurring = false, default):
 *   { title?, start, end, source? }
 *   start / end — full ISO datetimes for the unavailable window.
 *
 * Recurring (isRecurring = true):
 *   { title?, start, end, isRecurring: true, recurrence: { daysOfWeek, endDate? }, source? }
 *   start — reference datetime: DATE = recurrence activation date, TIME = daily start time
 *   end   — reference datetime: same DATE as start, TIME = daily end time
 *   recurrence.daysOfWeek — [0..6] (0 = Sun), at least one required
 *   recurrence.endDate    — optional ISO date; null / absent = ongoing forever
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
    const { title = "", start, end, isRecurring = false, recurrence, source = "manual" } = req.body;

    const { date: startDate, error: startErr } = parseRequiredDate(start, "start");
    if (startErr) return res.status(400).json({ success: false, error: startErr });

    const { date: endDate, error: endErr } = parseRequiredDate(end, "end");
    if (endErr) return res.status(400).json({ success: false, error: endErr });

    let parsedRecurrence = null;

    if (!isRecurring) {
      // ── One-time ───────────────────────────────────────────────────────────
      if (endDate <= startDate) {
        return res.status(400).json({ success: false, error: "end must be after start" });
      }
      // Overlap check against other one-time blocks only
      const overlap = await BusyBlock.findOne({
        userId,
        isRecurring: { $ne: true },
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
      // ── Recurring ─────────────────────────────────────────────────────────
      const recErr = validateRecurrencePayload(recurrence);
      if (recErr) return res.status(400).json({ success: false, error: recErr });
      parsedRecurrence = parseRecurrence(recurrence);
    }

    const block = await createBusyBlock({
      userId,
      title,
      start: startDate,
      end: endDate,
      isRecurring: Boolean(isRecurring),
      recurrence: parsedRecurrence,
      source,
    });
    // Reschedule all tasks to reflect the new busy block (fire-and-forget)
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
    const { title, start, end, isRecurring, recurrence } = req.body;

    const current = await BusyBlock.findOne({ _id: blockId, userId }).lean();
    if (!current) return res.status(404).json({ success: false, error: "Busy block not found" });

    const { date: startDate, error: startErr } = parseOptionalDate(start);
    if (startErr) return res.status(400).json({ success: false, error: `start: ${startErr}` });

    const { date: endDate, error: endErr } = parseOptionalDate(end);
    if (endErr) return res.status(400).json({ success: false, error: `end: ${endErr}` });

    const effectiveIsRecurring = isRecurring !== undefined ? isRecurring : current.isRecurring;

    if (!effectiveIsRecurring) {
      if (startDate !== undefined || endDate !== undefined) {
        const effectiveStart = startDate ?? new Date(current.start);
        const effectiveEnd = endDate ?? new Date(current.end);
        if (effectiveEnd <= effectiveStart) {
          return res.status(400).json({ success: false, error: "end must be after start" });
        }
        const overlap = await BusyBlock.findOne({
          userId,
          _id: { $ne: blockId },
          isRecurring: { $ne: true },
          start: { $lt: effectiveEnd },
          end: { $gt: effectiveStart },
        });
        if (overlap) {
          return res.status(409).json({
            success: false,
            error: "This time range overlaps with an existing busy block",
          });
        }
      }
    } else {
      const newRecurrence = recurrence ?? current.recurrence;
      const recErr = validateRecurrencePayload(newRecurrence);
      if (recErr) return res.status(400).json({ success: false, error: recErr });
    }

    const parsedRecurrence =
      recurrence !== undefined ? parseRecurrence(recurrence) : undefined;

    const updated = await updateBusyBlock({
      blockId,
      userId,
      title,
      start: startDate,
      end: endDate,
      isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : undefined,
      recurrence: parsedRecurrence,
    });
    // Reschedule all tasks to reflect the updated busy block (fire-and-forget)
    triggerSchedulerUpdate(userId, "busy-block-update", "busyBlocks API").catch(() => {});
    res.json({ success: true, busyBlock: updated });
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
