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
import { BusyBlock } from "../models/BusyBlock.js";
import { startOfDay, addDays } from "../utils/dateUtils.js";
import { planTasksCSP } from "../algorithms/csp/scheduler.js";
import { logEvent } from "./telemetryService.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { updateAllScores } from "../scripts/updateScores.js";

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
  start.setHours(block.startHour, block.startMinute, 0, 0);
  let end = new Date(dayStart);
  end.setHours(block.endHour, block.endMinute, 0, 0);
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
 * Persist a generated plan to the database.
 * Clears existing future planned/skipped sessions before saving new ones.
 * Also cleans up orphan schedules (where task no longer exists).
 */
export async function persistPlan(userId, plan) {
  const now = new Date();

  // Clean up orphan schedules (taskId references deleted tasks)
  const existingTaskIds = await Task.find({ userId }).distinct("_id");
  const existingTaskIdSet = new Set(existingTaskIds.map((id) => id.toString()));
  const allSchedules = await TaskSchedule.find({ userId, start: { $gte: now } }).lean();
  const orphanIds = allSchedules
    .filter((s) => !existingTaskIdSet.has(s.taskId?.toString()))
    .map((s) => s._id);
  if (orphanIds.length > 0) {
    await TaskSchedule.deleteMany({ _id: { $in: orphanIds } });
  }

  // Clear future planned/skipped sessions (not completed ones)
  await TaskSchedule.deleteMany({
    userId,
    start: { $gte: now },
    status: { $ne: "completed" },
  });

  if (!plan.length) return;

  const docs = plan.map((slot) => ({
    userId,
    taskId: slot.taskId,
    start: slot.start,
    end: slot.end,
    minutes: slot.minutes,
    status: "planned",
  }));

  await TaskSchedule.insertMany(docs);
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
  }).lean();

  if (!tasks.length) {
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
    tasks.map((task) => [task._id.toString(), task.estimatedDuration || 0])
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

  const busyBlocks = await BusyBlock.find({
    userId,
    start: { $lt: horizonEnd },
    end: { $gt: todayStart },
  }).lean();

  for (const block of busyBlocks) {
    const key = block.start.toISOString().slice(0, 10);
    if (!busyBlocksByDate[key]) busyBlocksByDate[key] = [];
    busyBlocksByDate[key].push({ start: new Date(block.start), end: new Date(block.end) });
  }

  const tasksForPlanning = tasks
    .map((task) => {
      const remaining = remainingByTaskId.get(task._id.toString());
      return { ...task, estimatedDuration: remaining };
    })
    .filter((task) => (task.estimatedDuration || 0) > 0);

  if (!tasksForPlanning.length) {
    return { plan: [], unscheduled: [], message: "All tasks already scheduled." };
  }

  const { plan, unscheduled } = planTasksCSP(tasksForPlanning, {
    busyBlocksByDate,
    planningHorizonDays,
    workingHours: profile.workingHours || { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0 },
    dailyCapMinutes: profile.dailyCapMinutes || 240,
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

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // every hour
let intervalHandle = null;
let isRunning = false;

const runOnce = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    logger.info("Priority scheduler: refreshing scores");
    await updateAllScores();
  } catch (error) {
    logger.error("Priority scheduler failed to update scores:", error);
  } finally {
    isRunning = false;
  }
};

/**
 * Start the priority scheduler background job.
 */
export function startPriorityScheduler() {
  if (intervalHandle) return;
  const intervalMs = Number(env.PRIORITY_SCHEDULER_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  runOnce();
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
