/**
 * @fileoverview Scheduling Service
 * @module services/schedulingService
 *
 * Consolidated service for intelligent task scheduling using CSP algorithms.
 * Manages planning, routine blocks, priority scheduling, and persistence.
 *
 * Key responsibilities:
 * - Generate optimal schedules using CSP solver
 * - Manage routine busy blocks (sleep, meals, etc.)
 * - Background priority score updates
 * - Persist and retrieve scheduled sessions
 *
 * @requires models/Task - Task database model
 * @requires models/TaskSchedule - Schedule database model
 * @requires algorithms/csp/scheduler - CSP scheduling algorithm
 */

import { Task } from "../models/Task.js";
import { TaskSchedule } from "../models/TaskSchedule.js";
import { SubTask } from "../models/SubTask.js";
import { BusyBlock } from "../models/BusyBlock.js";
import { User } from "../models/User.js";
import { startOfDay, addDays } from "../utils/dateUtils.js";
import { logEvent } from "./telemetryService.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { updateAllScores } from "../scripts/updateScores.js";
import { spawn } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

// ──────────────────────────────────────────────────────────────────────────────
// Deduplication helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 fingerprint for a single schedule session.
 * The hash encodes userId + taskId + start (UTC ISO) + end (UTC ISO) + subtaskIndex.
 * Two sessions with identical values produce the same hash, making it usable as
 * a unique key at both the application layer and the database layer.
 *
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} taskId
 * @param {Date|string}     start
 * @param {Date|string}     end
 * @param {number|null}     subtaskIndex
 * @returns {string} 64-char hex SHA-256 digest
 */
export function computeSessionHash(userId, taskId, start, end, subtaskIndex) {
  const key = [
    userId.toString(),
    taskId.toString(),
    new Date(start).toISOString(),
    new Date(end).toISOString(),
    subtaskIndex ?? "",
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Deduplicate a plan array in-memory by (taskId, start, end, subtaskIndex).
 * First occurrence wins; subsequent duplicates are silently dropped.
 * This is a safety-net applied BEFORE any DB write so that even if the
 * CSP scheduler or a concurrent caller emits duplicate slots, we never
 * attempt to persist them.
 *
 * @param {string|ObjectId}  userId
 * @param {Array}            plan   - raw plan slots from generatePlan / persistPlan
 * @returns {Array}          deduplicated plan
 */
export function deduplicatePlan(userId, plan) {
  const seen = new Set();
  const result = [];
  for (const slot of plan) {
    const h = computeSessionHash(userId, slot.taskId, slot.start, slot.end, slot.subtaskIndex ?? null);
    if (seen.has(h)) {
      logger.warn(
        `[SCHEDULER] Duplicate plan slot dropped (taskId=${slot.taskId}, ` +
        `start=${new Date(slot.start).toISOString()}) — hash ${h.slice(0, 12)}…`
      );
      continue;
    }
    seen.add(h);
    result.push(slot);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-user scheduling lock
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Map<userId, Promise<void>> used to serialize concurrent persistPlan calls
 * for the same user.  Without this guard, two simultaneous invocations both
 * execute deleteMany → insertMany, and both insertMany calls succeed, doubling
 * the stored sessions.
 *
 * The lock is purely advisory (in-process only). For multi-process deployments
 * a MongoDB findOneAndUpdate atomic step or a distributed lock (e.g. Redis) is
 * needed, but for a single Node process this is sufficient.
 */
const _userScheduleLocks = new Map();

/**
 * Run `fn` exclusively for `userId`. If another call is already running for the
 * same user, wait for it to finish before starting.
 *
 * @template T
 * @param {string}          userId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
// Export so manual-session routes can reuse the same per-user mutex
export async function withUserScheduleLock(userId, fn) {
  const key = userId.toString();
  const prev = _userScheduleLocks.get(key) ?? Promise.resolve();
  let releaseLock;
  const lockToken = new Promise((resolve) => {
    releaseLock = resolve;
  });
  // Chain: new callers will wait until this invocation releases the lock
  _userScheduleLocks.set(key, prev.then(() => lockToken));
  // Wait for any previous holder to finish
  await prev;
  try {
    return await fn();
  } finally {
    releaseLock();
    // Clean up the map entry once no further callers are waiting for this user
    // (the next chained promise resolves immediately because lockToken resolved)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Recurring busy-block expansion
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Expand a recurring BusyBlock into concrete {key, start, end} occurrences
 * over the given date range [fromDate, toDate].
 *
 * The block's `start` encodes the recurrence activation date + daily start time.
 * The block's `end`   encodes the same reference date     + daily end time.
 * block.recurrence.daysOfWeek lists which weekdays the block applies.
 * block.recurrence.endDate (if set) stops the expansion on that date.
 *
 * @param {object} block      - Mongoose lean BusyBlock document
 * @param {Date}   fromDate   - Inclusive start of the expansion window
 * @param {Date}   toDate     - Inclusive end of the expansion window
 * @returns {{ key: string, start: Date, end: Date }[]}
 */
function expandRecurringBlock(block, fromDate, toDate) {
  const blockStart = new Date(block.start);
  const activationDay = startOfDay(blockStart);

  const startH = blockStart.getHours();
  const startM = blockStart.getMinutes();
  const blockEnd = new Date(block.end);
  const endH = blockEnd.getHours();
  const endM = blockEnd.getMinutes();

  // Respect optional expiry date
  const expiry = block.recurrence.endDate ? new Date(block.recurrence.endDate) : toDate;
  const windowEnd = expiry < toDate ? expiry : toDate;

  const occurrences = [];
  let cursor = new Date(fromDate);

  while (cursor <= windowEnd) {
    const dayOfWeek = cursor.getDay(); // 0=Sun…6=Sat
    if (cursor >= activationDay && block.recurrence.daysOfWeek.includes(dayOfWeek)) {
      const oStart = new Date(cursor);
      oStart.setHours(startH, startM, 0, 0);
      const oEnd = new Date(cursor);
      oEnd.setHours(endH, endM, 0, 0);
      if (oEnd > oStart) {
        // Use the UTC date of oStart as the key — this matches the UTC-based date keys
        // that Python's CSP generates. Using cursor.toISOString() would give the wrong
        // date on any UTC+ timezone server (local midnight serialises as UTC yesterday).
        occurrences.push({ key: oStart.toISOString().slice(0, 10), start: oStart, end: oEnd });
      }
    }
    cursor = addDays(cursor, 1);
  }
  return occurrences;
}

/**
 * Expand ANY BusyBlock (new schema or legacy) into concrete
 * { key: "YYYY-MM-DD", start: Date, end: Date } occurrences
 * over [fromDate, toDate].  Buffers are applied at expansion time
 * so the Python CSP receives already-padded intervals.
 *
 * blockType dispatch:
 *  ONCE           — single occurrence on block.date
 *  FULL_DAY       — whole day(s); one-time when only date set,
 *                   recurring when daysOfWeek set
 *  DAILY          — every day in horizon (optional recurrenceEndDate)
 *  WEEKLY         — matching daysOfWeek (optional recurrenceEndDate)
 *  null (legacy)  — delegates to expandRecurringBlock() or start/end
 *
 * @param {object} block     - Mongoose lean BusyBlock document
 * @param {Date}   fromDate  - Inclusive start of expansion window
 * @param {Date}   toDate    - Inclusive end of expansion window
 * @returns {{ key: string, start: Date, end: Date }[]}
 */
export function expandBusyBlock(block, fromDate, toDate) {
  const bufBefore = (block.bufferBeforeMinutes || 0) * 60_000;
  const bufAfter  = (block.bufferAfterMinutes  || 0) * 60_000;

  function applyBuffer(s, e) {
    return {
      start: new Date(s.getTime() - bufBefore),
      end:   new Date(e.getTime() + bufAfter),
    };
  }

  function hhmmToMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  /** Build one occurrence for a calendar day given start/end minutes-since-midnight.
   * Uses LOCAL time so that user-entered HH:MM values (e.g. "12:00") land on
   * the correct local clock position regardless of the server's UTC offset.
   * For example on a UTC+2 server, "12:00" → local noon → UTC 10:00, which
   * correctly matches slots that Python schedules in the same UTC band. */
  function buildOccurrence(dayDate, startMin, endMin) {
    const s = new Date(dayDate);
    s.setHours(0, startMin, 0, 0);   // local time — preserves user's clock intent
    const e = new Date(dayDate);
    e.setHours(0, endMin, 0, 0);     // local time
    const { start, end } = applyBuffer(s, e);
    return { key: dayDate.toISOString().slice(0, 10), start, end };
  }

  const type = block.blockType;

  // ── ONCE ─────────────────────────────────────────────────────────────────
  if (type === "ONCE") {
    const d = new Date(block.date);
    if (d < fromDate || d > toDate) return [];
    const ranges = block.times ?? [];
    return ranges.map((r) =>
      buildOccurrence(d, hhmmToMinutes(r.startTime), hhmmToMinutes(r.endTime))
    );
  }

  // ── FULL_DAY ───────────────────────────────────────────────────────────
  if (type === "FULL_DAY") {
    const results = [];
    const isOneTime = block.date && (!block.daysOfWeek || !block.daysOfWeek.length);
    if (isOneTime) {
      const d = new Date(block.date);
      if (d >= fromDate && d <= toDate) {
        const key = d.toISOString().slice(0, 10);
        const s = new Date(key + "T00:00:00.000Z");
        const e = new Date(key + "T23:59:59.999Z");
        const b = applyBuffer(s, e);
        results.push({ key, start: b.start, end: b.end });
      }
      return results;
    }
    // Recurring full days
    const expiry = block.recurrenceEndDate ? new Date(block.recurrenceEndDate) : toDate;
    const windowEnd = expiry < toDate ? expiry : toDate;
    let cursor = new Date(fromDate);
    while (cursor <= windowEnd) {
      const dow = block.daysOfWeek;
      if (!dow || !dow.length || dow.includes(cursor.getUTCDay())) {
        const key = cursor.toISOString().slice(0, 10);
        const s = new Date(key + "T00:00:00.000Z");
        const e = new Date(key + "T23:59:59.999Z");
        const b = applyBuffer(s, e);
        results.push({ key, start: b.start, end: b.end });
      }
      cursor = addDays(cursor, 1);
    }
    return results;
  }

  // ── DAILY ───────────────────────────────────────────────────────────────
  if (type === "DAILY") {
    const timeSpans = block.times ?? [];
    const expiry = block.recurrenceEndDate ? new Date(block.recurrenceEndDate) : toDate;
    const windowEnd = expiry < toDate ? expiry : toDate;
    const results = [];
    let cursor = new Date(fromDate);
    while (cursor <= windowEnd) {
      for (const span of timeSpans) {
        results.push(buildOccurrence(cursor, hhmmToMinutes(span.startTime), hhmmToMinutes(span.endTime)));
      }
      cursor = addDays(cursor, 1);
    }
    return results;
  }

  // ── WEEKLY ──────────────────────────────────────────────────────────────
  if (type === "WEEKLY") {
    const expiry = block.recurrenceEndDate ? new Date(block.recurrenceEndDate) : toDate;
    const windowEnd = expiry < toDate ? expiry : toDate;
    const results = [];
    let cursor = new Date(fromDate);
    if (block.weeklySchedule?.length) {
      // Per-day schedule: each entry carries its own times[]
      while (cursor <= windowEnd) {
        const dow = cursor.getUTCDay();
        const dayEntry = block.weeklySchedule.find((e) => e.dayOfWeek === dow);
        if (dayEntry) {
          for (const span of dayEntry.times ?? []) {
            results.push(buildOccurrence(cursor, hhmmToMinutes(span.startTime), hhmmToMinutes(span.endTime)));
          }
        }
        cursor = addDays(cursor, 1);
      }
    } else {
      // Legacy: flat daysOfWeek + times[]
      const timeSpans = block.times ?? [];
      while (cursor <= windowEnd) {
        if (block.daysOfWeek && block.daysOfWeek.includes(cursor.getUTCDay())) {
          for (const span of timeSpans) {
            results.push(buildOccurrence(cursor, hhmmToMinutes(span.startTime), hhmmToMinutes(span.endTime)));
          }
        }
        cursor = addDays(cursor, 1);
      }
    }
    return results;
  }

  // ── Legacy fallback ────────────────────────────────────────────────────────────
  if (block.isRecurring && block.recurrence?.daysOfWeek?.length) {
    return expandRecurringBlock(block, fromDate, toDate).map(({ key, start, end }) => {
      const b = applyBuffer(start, end);
      return { key, start: b.start, end: b.end };
    });
  }
  // Single one-time block
  if (block.start && block.end) {
    const s = new Date(block.start);
    const e = new Date(block.end);
    if (s < toDate && e > fromDate) {
      const key = s.toISOString().slice(0, 10);
      const b = applyBuffer(s, e);
      return [{ key, start: b.start, end: b.end }];
    }
  }
  return [];
}

/**
 * Helper: Trigger scheduler update after task operations
 * Centralizes the scheduling trigger logic to avoid duplication
 * across missions and controllers
 *
 * @param {string} userId - User ID
 * @param {string} operationType - Type of operation ("creation", "update", "deletion")
 * @param {string} [location] - Where the trigger originated ("API" or "LLM")
 * @returns {Promise<{success: boolean, sessionCount: number, error?: string}>}
 */
export async function triggerSchedulerUpdate(userId, operationType = "operation", location = "API") {
  try {
    const user = await User.findById(userId).select("profile schedulingPreferences").lean();
    const profileWithGap = {
      ...(user?.profile || {}),
      minGapMinutes: user?.schedulingPreferences?.minGapMinutes ?? 10,
    };
    const { plan, unscheduled } = await generatePlan({ userId, profile: profileWithGap });
    await savePlan({ userId, plan, unscheduled });
    logger.info(`[SCHEDULER] Updated after task ${operationType} (${location}): ${plan.length} sessions scheduled`);
    return { success: true, sessionCount: plan.length };
  } catch (error) {
    logger.error(`[SCHEDULER] Failed to update after task ${operationType} (${location}):`, error);
    return { success: false, sessionCount: 0, error: error.message };
  }
}

// Use Python scheduler CLI instead of JS implementation.
async function callPythonScheduler(tasks, options) {
  // Try python3 first, then fallback to python (Windows)
  const candidates = process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];

  let lastError = null;
  for (const cmd of candidates) {
    try {
      const py = spawn(cmd, ["./src/algorithms/csp/py_scheduler_cli.py"]);

      return await new Promise((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        py.stdout.setEncoding("utf8");
        py.stderr.setEncoding("utf8");
        py.stdout.on("data", (chunk) => (stdout += chunk));
        py.stderr.on("data", (chunk) => (stderr += chunk));
        py.on("error", (err) => reject(err));
        py.on("close", (code) => {
          // Write stderr to debug log file
          if (stderr) {
            const debugLogPath = path.join(os.tmpdir(), 'csp_scheduler_node_debug.log');
            try {
              fs.appendFileSync(debugLogPath, `\n=== ${new Date().toISOString()} ===\n${stderr}\n`);
            } catch (e) {
              console.error('[PYTHON-DEBUG] Failed to write log file:', e.message);
            }
          }
          if (code !== 0) return reject(new Error(`Python scheduler (${cmd}) failed: ${stderr || `exit ${code}`}`));
          try {
            const parsed = JSON.parse(stdout || "{}");
            // Convert ISO strings back to Date objects for Node consumers
            parsed.plan = (parsed.plan || []).map((p) => ({
              ...p,
              start: new Date(p.start),
              end: new Date(p.end),
            }));
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });

        const payload = JSON.stringify({ tasks, options });
        try {
          py.stdin.write(payload);
          py.stdin.end();
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      // Keep the last error and try next candidate
      lastError = err;
      logger && logger.error && logger.error(`Python scheduler attempt with '${cmd}' failed:`, err.message || err);
      // Continue to try next candidate
    }
  }

  // If we reach here, none of the candidates worked
  throw new Error(
    `Python scheduler not available: tried ${candidates.join(", ")}. Last error: ${lastError?.message || lastError}`,
  );
}

// =============================================================================
// ROUTINE BLOCKS CONFIGURATION
// =============================================================================

const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
};

function normalizeBlock(block) {
  if (!block) return null;
  const startHour = clamp(block.startHour, 0, 23, 0);
  const startMinute = clamp(block.startMinute, 0, 59, 0);
  const endHour = clamp(block.endHour, 0, 23, 0);
  const endMinute = clamp(block.endMinute, 0, 59, 0);
  const wrapsToNextDay = block.wrapsToNextDay ?? endHour < startHour;
  return {
    key: block.key || `routine_${startHour}_${startMinute}`,
    label: block.label || block.key || "Routine",
    startHour,
    startMinute,
    endHour,
    endMinute,
    wrapsToNextDay,
  };
}

export const DEFAULT_ROUTINE_BLOCKS = [
  { key: "sleep", label: "Sleep", startHour: 23, startMinute: 0, endHour: 7, endMinute: 0, wrapsToNextDay: true },
  { key: "breakfast", label: "Breakfast", startHour: 8, startMinute: 0, endHour: 8, endMinute: 30 },
  { key: "lunch", label: "Lunch", startHour: 13, startMinute: 0, endHour: 13, endMinute: 45 },
  { key: "dinner", label: "Dinner", startHour: 19, startMinute: 0, endHour: 19, endMinute: 45 },
  { key: "shower", label: "Shower", startHour: 7, startMinute: 30, endHour: 8, endMinute: 0 },
];

const NORMALIZED_DEFAULT_BLOCKS = DEFAULT_ROUTINE_BLOCKS.map(normalizeBlock);

const DEFAULT_ROUTINE_SETTINGS = {
  enabled: false,
  blocks: NORMALIZED_DEFAULT_BLOCKS,
};

const readSettingsValue = (settings, key) => {
  if (!settings) return undefined;
  if (typeof settings.get === "function") return settings.get(key);
  return settings[key];
};

const splitIntervalByDay = (start, end, accumulator) => {
  let cursor = start;
  while (cursor < end) {
    const dayStart = startOfDay(cursor);
    const dayEnd = addDays(dayStart, 1);
    const chunkEnd = new Date(Math.min(dayEnd.getTime(), end.getTime()));
    if (chunkEnd > cursor) {
      const dateKey = dayStart.toISOString().slice(0, 10);
      if (!accumulator[dateKey]) accumulator[dateKey] = [];
      accumulator[dateKey].push({ start: new Date(cursor), end: new Date(chunkEnd) });
    }
    cursor = chunkEnd;
  }
};

const addRoutineBlockForDate = (date, block, accumulator) => {
  const dayStart = startOfDay(date);
  const start = new Date(dayStart);
  start.setUTCHours(block.startHour, block.startMinute, 0, 0);
  let end = new Date(dayStart);
  end.setUTCHours(block.endHour, block.endMinute, 0, 0);
  if (block.wrapsToNextDay && end <= start) {
    end = addDays(end, 1);
  }
  if (end <= start) return;
  splitIntervalByDay(start, end, accumulator);
};

/**
 * Get routine settings from user profile.
 */
export function getRoutineSettings(profile = {}) {
  const stored = readSettingsValue(profile?.settings, "routineBlocks");
  if (!stored) return DEFAULT_ROUTINE_SETTINGS;
  const normalizedBlocks =
    Array.isArray(stored.blocks) && stored.blocks.length
      ? stored.blocks.map(normalizeBlock).filter(Boolean)
      : NORMALIZED_DEFAULT_BLOCKS;
  return {
    enabled: Boolean(stored.enabled),
    blocks: normalizedBlocks.length ? normalizedBlocks : NORMALIZED_DEFAULT_BLOCKS,
  };
}

/**
 * Build routine busy blocks for a date range.
 */
export function buildRoutineBusyBlocks({ startDate, endDate, profile = {} }) {
  const settings = getRoutineSettings(profile);
  if (!settings.enabled) return {};

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const result = {};

  let cursor = new Date(start);
  while (cursor <= end) {
    for (const block of settings.blocks) {
      addRoutineBlockForDate(cursor, block, result);
    }
    cursor = addDays(cursor, 1);
  }

  return result;
}

/**
 * Describe routine windows in human-readable format.
 */
export function describeRoutineWindows(blocks = DEFAULT_ROUTINE_BLOCKS) {
  return blocks.map((block) => {
    const start = `${String(block.startHour).padStart(2, "0")}:${String(block.startMinute).padStart(2, "0")}`;
    const end = `${String(block.endHour).padStart(2, "0")}:${String(block.endMinute).padStart(2, "0")}`;
    const suffix = block.wrapsToNextDay ? " (next day)" : "";
    return `${block.label}: ${start} - ${end}${suffix}`;
  });
}

// =============================================================================
// SCHEDULE PERSISTENCE
// =============================================================================

/**
 * Helper: Assign subtask indices to schedule slots for split tasks.
 *
 * For tasks with type "in_parts" or "leaky", this function maps schedule blocks
 * to their corresponding SubTask indices sequentially.
 *
 * @param {Array} plan - Array of schedule slots
 * @returns {Promise<Array>} Plan with subtaskIndex populated for split tasks
 */
async function assignSubtaskIndices(plan) {
  if (!plan.length) return plan;

  // If Python already provided subtaskIndex, use it directly
  const allHaveIndex = plan.every(slot => slot.subtaskIndex != null);
  if (allHaveIndex) return plan;

  // Group plan slots by taskId to track which subtask index to assign next
  const taskSlotMap = new Map();
  for (const slot of plan) {
    const taskIdStr = slot.taskId.toString();
    if (!taskSlotMap.has(taskIdStr)) {
      taskSlotMap.set(taskIdStr, []);
    }
    taskSlotMap.get(taskIdStr).push(slot);
  }

  // For each task, check if it's split and assign subtask indices
  const taskIds = Array.from(taskSlotMap.keys());
  const tasks = await Task.find({
    _id: { $in: taskIds },
    taskType: { $in: ["in_parts", "leaky"] },
  }).lean();

  const splitTaskIds = new Set(tasks.map((t) => t._id.toString()));

  // Assign subtaskIndex sequentially for each split task's slots
  for (const slot of plan) {
    const taskIdStr = slot.taskId.toString();
    if (splitTaskIds.has(taskIdStr)) {
      // Get current slot's position among this task's slots
      const slots = taskSlotMap.get(taskIdStr);
      const slotIndex = slots.indexOf(slot);
      // Assign subtask index (1-indexed)
      slot.subtaskIndex = slotIndex + 1;
    }
  }

  return plan;
}

/**
 * Persist a generated plan to the database.
 * Clears existing future planned/skipped sessions before saving new ones.
 * Also cleans up orphan schedules (where task no longer exists).
 * Automatically assigns subtask indices for split tasks.
 *
 * ── Duplication prevention ────────────────────────────────────────────────────
 * 1. Per-user advisory lock:  concurrent calls for the same userId are serialized
 *    so that the deleteMany → insertMany sequence is never interleaved.
 * 2. In-process plan deduplication: any duplicate slots from the CSP scheduler
 *    or a double-trigger are removed before the DB write.
 * 3. sessionHash unique index on TaskSchedule: a DB-level safety net that rejects
 *    any remaining duplicates even if the two layers above are somehow bypassed
 *    (e.g. multi-process deployment). insertMany uses `ordered: false` so that a
 *    duplicate-key error on a single document does NOT abort the whole batch.
 */
export async function persistPlan(userId, plan) {
  return withUserScheduleLock(userId, () => _persistPlanLocked(userId, plan));
}

async function _persistPlanLocked(userId, plan) {
  const now = new Date();

  // Assign subtask indices before persisting
  const planWithSubtasks = await assignSubtaskIndices(plan);

  // ── Safety-net: deduplicate the plan array itself ─────────────────────────
  // Removes slots sharing the same (taskId, start, end, subtaskIndex) so we
  // never attempt to insert two rows that would collide on the sessionHash index.
  const dedupedPlan = deduplicatePlan(userId, planWithSubtasks);
  if (dedupedPlan.length < planWithSubtasks.length) {
    logger.warn(
      `[SCHEDULER] persistPlan: dropped ${planWithSubtasks.length - dedupedPlan.length} duplicate slot(s) for user ${userId}`
    );
  }

  // ── Step 1: wipe ALL planned/non-manual sessions for every task that appears in
  // the new plan, regardless of start time.  This prevents a stale session whose
  // start time is just before `now` from surviving (the time-gated delete below
  // would miss it, causing two sessions for the same subtaskIndex).
  const planTaskIds = Array.from(new Set(dedupedPlan.map((p) => p.taskId.toString())));
  if (planTaskIds.length > 0) {
    await TaskSchedule.deleteMany({
      userId,
      taskId: { $in: planTaskIds },
      status: { $nin: ["completed"] },
      manuallyScheduled: { $ne: true },
    });
  }

  // ── Step 2: clean up orphan schedules (taskId references deleted tasks)
  const existingTaskIds = await Task.find({ userId }).distinct("_id");
  const existingTaskIdSet = new Set(existingTaskIds.map((id) => id.toString()));
  const allSchedules = await TaskSchedule.find({ userId, start: { $gte: now } }).lean();
  const orphanIds = allSchedules.filter((s) => !existingTaskIdSet.has(s.taskId?.toString())).map((s) => s._id);
  if (orphanIds.length > 0) {
    await TaskSchedule.deleteMany({ _id: { $in: orphanIds } });
  }

  // ── Step 3: clear remaining future planned sessions for tasks NOT in this plan
  // (handles tasks that were previously scheduled but are now complete/removed).
  await TaskSchedule.deleteMany({
    userId,
    start: { $gte: now },
    status: { $ne: "completed" },
    manuallyScheduled: { $ne: true },
  });

  if (!dedupedPlan.length) return;

  // Fetch all tasks to get subtask titles and descriptions for the schedule
  const taskIds = Array.from(new Set(dedupedPlan.map((p) => p.taskId.toString())));
  const tasks = await Task.find({ _id: { $in: taskIds } }).populate('subTasks');
  // Build taskMap with subTasks sorted by index so that array-position lookup
  // (subTasks[subtaskIndex - 1]) always maps to the correct subtask regardless
  // of the order MongoDB returns them from the virtual populate.
  const taskMap = new Map(tasks.map((t) => [
    t._id.toString(),
    {
      ...t.toObject ? t.toObject({ virtuals: true }) : t,
      subTasks: Array.isArray(t.subTasks)
        ? [...t.subTasks].sort((a, b) => (a.index || 0) - (b.index || 0))
        : [],
    },
  ]));

  const docs = dedupedPlan.map((slot) => {
    let subtaskTitle = null;
    let description = null;

    // If this slot has a subtaskIndex, get the subtask title and description.
    // subTasks is already sorted ascending by index, so position (subtaskIndex-1)
    // correctly maps to the subtask with index === subtaskIndex.
    if (slot.subtaskIndex !== null && slot.subtaskIndex !== undefined) {
      const task = taskMap.get(slot.taskId.toString());
      if (task && task.subTasks && task.subTasks[slot.subtaskIndex - 1]) {
        // subtaskIndex is 1-indexed, subTasks array is 0-indexed
        const subtask = task.subTasks[slot.subtaskIndex - 1];
        subtaskTitle = subtask.title || null;
        description = subtask.description || null;
      }
    }

    return {
      userId,
      taskId: slot.taskId,
      subtaskIndex: slot.subtaskIndex || null,
      subtaskTitle, // Subtask title for multi-day tasks
      description, // Subtask description
      start: slot.start,
      end: slot.end,
      minutes: slot.minutes,
      status: "planned",
      // Deterministic hash — DB unique index is the last line of defence
      sessionHash: computeSessionHash(userId, slot.taskId, slot.start, slot.end, slot.subtaskIndex ?? null),
    };
  });

  // ordered: false ensures that a duplicate-key error on ONE document (e.g. from a
  // race between this process and another) does not abort the entire batch.
  try {
    await TaskSchedule.insertMany(docs, { ordered: false });
  } catch (err) {
    // BulkWriteError code 11000 = duplicate key — log and continue; all non-
    // duplicate documents were already inserted by MongoDB.
    if (err.code === 11000 || err.name === "MongoBulkWriteError") {
      const dupeCount = err.writeErrors?.length ?? "unknown number of";
      logger.warn(
        `[SCHEDULER] insertMany: ${dupeCount} duplicate session(s) rejected by DB unique index (sessionHash). ` +
        `This indicates a race that was caught at the DB layer. Continuing normally.`
      );
    } else {
      throw err;
    }
  }
}

// =============================================================================
// PLANNING SERVICE
// =============================================================================

/**
 * Generate a schedule for open tasks within a planning horizon.
 */
export async function generatePlan({ userId, profile = {}, planningHorizonDays = 14 }) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const horizonEnd = addDays(todayStart, planningHorizonDays);

  const tasks = await Task.find({
    userId,
    status: { $in: ["todo", "in_progress"] },
    manualSchedule: { $ne: true },  // skip tasks whose schedule is managed manually
  })
    .populate("subTasks") // Populate subtasks so we can use their durations
    .lean();

  // Sort subtasks by index to maintain creation order
  const tasksWithOrderedSubtasks = tasks.map(task => ({
    ...task,
    subTasks: task.subTasks && Array.isArray(task.subTasks) 
      ? task.subTasks.sort((a, b) => (a.index || 0) - (b.index || 0))
      : task.subTasks
  }));

  if (!tasksWithOrderedSubtasks.length) {
    return { plan: [], unscheduled: [], message: "No open tasks to plan." };
  }

  const autoRoutineBlocks = buildRoutineBusyBlocks({
    startDate: todayStart,
    endDate: horizonEnd,
    profile,
  });

  const busyBlocksByDate = Object.entries(autoRoutineBlocks).reduce((acc, [key, intervals]) => {
    acc[key] = intervals.map((interval) => ({
      start: new Date(interval.start),
      end: new Date(interval.end),
    }));
    return acc;
  }, {});

  const completedSessions = await TaskSchedule.find({
    userId,
    end: { $gte: now },
    status: "completed",
  }).lean();

  const remainingByTaskId = new Map(
    tasksWithOrderedSubtasks.map((task) => [task._id.toString(), task.estimatedDuration || 0])
  );

  for (const session of completedSessions) {
    const key = session.start.toISOString().slice(0, 10);
    if (!busyBlocksByDate[key]) busyBlocksByDate[key] = [];
    busyBlocksByDate[key].push({ start: new Date(session.start), end: new Date(session.end) });

    const taskId = session.taskId?.toString();
    if (taskId && remainingByTaskId.has(taskId)) {
      const remaining = Math.max(0, remainingByTaskId.get(taskId) - session.minutes);
      remainingByTaskId.set(taskId, remaining);
    }
  }

  // Also treat future manual sessions (of OTHER tasks with manualSchedule=true) as occupied time
  // so the auto-scheduler doesn't double-book those slots.
  const manualSessions = await TaskSchedule.find({
    userId,
    start: { $gte: now, $lt: horizonEnd },
    status: "planned",
    manuallyScheduled: true,
  }).lean();
  for (const session of manualSessions) {
    const key = session.start.toISOString().slice(0, 10);
    if (!busyBlocksByDate[key]) busyBlocksByDate[key] = [];
    busyBlocksByDate[key].push({ start: new Date(session.start), end: new Date(session.end) });
  }

  const busyBlocks = await BusyBlock.find({
    userId,
    $or: [
      // ── New-style: one-time blocks within horizon ────────────────────────────
      {
        blockType: { $in: ["ONCE"] },
        date: { $gte: todayStart, $lt: horizonEnd },
      },
      // ── New-style: one-time FULL_DAY (has date, empty daysOfWeek) ───────────
      {
        blockType: "FULL_DAY",
        date: { $gte: todayStart, $lt: horizonEnd },
        $or: [{ daysOfWeek: { $size: 0 } }, { daysOfWeek: { $exists: false } }],
      },
      // ── New-style: recurring blocks (DAILY / WEEKLY / FULL_DAY recurring) ──
      {
        blockType: { $in: ["DAILY", "WEEKLY"] },
        $or: [
          { recurrenceEndDate: null },
          { recurrenceEndDate: { $gt: todayStart } },
        ],
      },
      // FULL_DAY with daysOfWeek set (recurring)
      {
        blockType: "FULL_DAY",
        daysOfWeek: { $exists: true, $not: { $size: 0 } },
        $or: [
          { recurrenceEndDate: null },
          { recurrenceEndDate: { $gt: todayStart } },
        ],
      },
      // ── Legacy one-time blocks that overlap the planning horizon ──────────
      {
        blockType: null,
        isRecurring: { $ne: true },
        start: { $lt: horizonEnd },
        end: { $gt: todayStart },
      },
      // ── Legacy recurring rules that are still active during the horizon ──
      {
        blockType: null,
        isRecurring: true,
        $or: [
          { "recurrence.endDate": null },
          { "recurrence.endDate": { $gt: todayStart } },
        ],
      },
    ],
  }).lean();

  for (const block of busyBlocks) {
    for (const { key, start, end } of expandBusyBlock(block, todayStart, horizonEnd)) {
      if (!busyBlocksByDate[key]) busyBlocksByDate[key] = [];
      busyBlocksByDate[key].push({ start, end });
    }
  }

  const tasksForPlanning = tasksWithOrderedSubtasks
    .map((task) => {
      const remaining = remainingByTaskId.get(task._id.toString());

      // Strip out already-completed subtasks so Python doesn't schedule ghost slots
      // for work that is already done.
      const pendingSubTasks = Array.isArray(task.subTasks)
        ? task.subTasks.filter((st) => st.status !== "done")
        : task.subTasks;

      return { ...task, estimatedDuration: remaining, subTasks: pendingSubTasks };
    })
    .filter((task) => (task.estimatedDuration || 0) > 0);

  if (!tasksForPlanning.length) {
    return { plan: [], unscheduled: [], message: "All tasks already scheduled." };
  }



  const { plan, unscheduled } = await callPythonScheduler(tasksForPlanning, {
    busyBlocksByDate,
    planningHorizonDays,
    workingHours: profile.workingHours || { startHour: 0, startMinute: 0, endHour: 23, endMinute: 59 },
    dailyCapMinutes: profile.dailyCapMinutes || 240,
    gapMinutes: profile.minGapMinutes ?? 10,
  });



  return { plan, unscheduled };
}

/**
 * Save a generated plan and log the event.
 */
export async function savePlan({ userId, plan, unscheduled = [] }) {
  await persistPlan(userId, plan);

  await logEvent({
    type: "tasks_planned",
    userId,
    payload: {
      plannedCount: plan.length,
      unscheduledCount: unscheduled.length,
    },
  });
}

/**
 * Fetch upcoming scheduled sessions for a user.
 */
export async function getUpcomingSessions(userId, { limit = 50 } = {}) {
  const todayStart = startOfDay(new Date());
  return TaskSchedule.find({
    userId,
    start: { $gte: todayStart },
  })
    .sort({ start: 1 })
    .limit(limit)
    .populate("taskId", "taskname")
    .lean();
}

// =============================================================================
// PRIORITY SCHEDULER (BACKGROUND JOB)
// =============================================================================

/**
 * Transition every planned session whose `end` is in the past to "missed".
 * Called on every scheduler tick so the DB reflects reality without requiring
 * the frontend to infer status from timestamps.
 */
async function markMissedSessions() {
  const now = new Date();
  const result = await TaskSchedule.updateMany(
    { end: { $lt: now }, status: "planned" },
    { $set: { status: "missed" } }
  );
  if (result.modifiedCount > 0) {
    logger.info(`[SCHEDULER] Marked ${result.modifiedCount} past session(s) as "missed"`);
  }
  return result.modifiedCount;
}

/**
 * One-time startup cleanup: for each (userId, taskId, subtaskIndex) group of
 * planned (non-manual) sessions, keep only the session with the latest start
 * time and delete the rest.
 *
 * These duplicates can arise if a reschedule ran while the task-level wipe
 * (Step 1 of _persistPlanLocked) was not yet in place, or if a past session
 * slipped through the time-gated delete before that guard was added.
 */
async function removeDuplicatePlannedSessions() {
  const groups = await TaskSchedule.aggregate([
    { $match: { status: "planned", manuallyScheduled: { $ne: true } } },
    {
      $group: {
        _id: {
          userId: "$userId",
          taskId: "$taskId",
          subtaskIndex: { $ifNull: ["$subtaskIndex", null] },
        },
        docs: { $push: { id: "$_id", start: "$start" } },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  let deletedTotal = 0;
  for (const group of groups) {
    // Sort newest-first — keep the most recently scheduled session (index 0)
    group.docs.sort((a, b) => new Date(b.start) - new Date(a.start));
    const toDelete = group.docs.slice(1).map((d) => d.id);
    const res = await TaskSchedule.deleteMany({ _id: { $in: toDelete } });
    deletedTotal += res.deletedCount;
  }

  if (deletedTotal > 0) {
    logger.info(`[SCHEDULER] Startup cleanup: removed ${deletedTotal} duplicate planned session(s)`);
  }
  return deletedTotal;
}

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // every hour
let intervalHandle = null;
let isRunning = false;

const runOnce = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    logger.info("Priority scheduler: refreshing scores and expiring past sessions");
    await markMissedSessions();
    await updateAllScores();
  } catch (error) {
    logger.error("Priority scheduler failed:", error);
  } finally {
    isRunning = false;
  }
};

/**
 * Start the priority scheduler background job.
 * On startup: runs a one-time duplicate-session cleanup, then begins the
 * regular hourly tick (score refresh + missed-session expiry).
 */
export function startPriorityScheduler() {
  if (intervalHandle) return;
  const intervalMs = Number(env.PRIORITY_SCHEDULER_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  // Startup: clean up any legacy duplicate sessions, then run the first tick
  removeDuplicatePlannedSessions()
    .catch((err) => logger.error("[SCHEDULER] Startup dedup cleanup failed:", err))
    .finally(() => runOnce());
  intervalHandle = setInterval(runOnce, intervalMs);
  logger.info(`Priority scheduler enabled (interval: ${intervalMs} ms)`);
}

/**
 * Stop the priority scheduler.
 */
export function stopPriorityScheduler() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
  logger.info("Priority scheduler stopped");
}
