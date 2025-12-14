/**
 * @fileoverview Planning Service
 * @module services/scheduling/planningService
 * 
 * Orchestrates intelligent task scheduling using Constraint Satisfaction Problem (CSP).
 * Gathers user constraints, busy blocks, and task requirements to generate optimal schedules.
 * 
 * Key responsibilities:
 * - Collect open tasks within planning horizon
 * - Build constraint set (busy blocks, routines, preferences)
 * - Invoke CSP scheduler algorithm
 * - Persist generated plans to database
 * - Log planning events for telemetry
 * 
 * Planning considers: due dates, effort, importance, user preferences, busy blocks
 * 
 * @requires models/Task - Task database model
 * @requires models/TaskSchedule - Schedule database model
 * @requires algorithms/csp/scheduler - CSP scheduling algorithm
 */

import { Task } from "../../models/Task.js";
import { TaskSchedule } from "../../models/TaskSchedule.js";
import { BusyBlock } from "../../models/BusyBlock.js";
import { startOfDay, addDays } from "../../utils/dateUtils.js";
import { buildRoutineBusyBlocks } from "./routineBlocks.js";
import { persistPlan } from "./schedulePersistence.js";
import { planTasksCSP } from "../../algorithms/csp/scheduler.js";
import { logEvent } from "../telemetry/telemetry.js";

/**
 * Generate a schedule for open tasks within a planning horizon.
 * @param {object} params
 * @returns {Promise<{ plan: object[], unscheduled: object[] }>}
 */
export async function generatePlan({ userId, profile = {}, planningHorizonDays = 14 }) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const horizonEnd = addDays(todayStart, planningHorizonDays);

  // Fetch open tasks
  const tasks = await Task.find({
    userId,
    status: { $in: ["todo", "in_progress"] },
  }).lean();

  if (!tasks.length) {
    return { plan: [], unscheduled: [], message: "No open tasks to plan." };
  }

  // Build routine busy blocks from user profile
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

  // Note: We do NOT include existing planned sessions as busy blocks
  // because persistPlan will clear them before saving the new plan.
  // Only completed/in-progress sessions should be treated as busy.
  const completedSessions = await TaskSchedule.find({
    userId,
    end: { $gte: now },
    status: { $in: ["done", "in_progress"] },
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

  // Gather manual busy blocks
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

  // Prepare tasks for planning with remaining durations
  const tasksForPlanning = tasks
    .map((task) => {
      const remaining = remainingByTaskId.get(task._id.toString());
      return { ...task, estimatedDuration: remaining };
    })
    .filter((task) => (task.estimatedDuration || 0) > 0);

  if (!tasksForPlanning.length) {
    return { plan: [], unscheduled: [], message: "All tasks already scheduled." };
  }

  // Use CSP scheduler with backtracking and constraint propagation
  const { plan, unscheduled } = planTasksCSP(tasksForPlanning, { 
    busyBlocksByDate, 
    planningHorizonDays,
    workingHours: profile.workingHours || {
      startHour: 9,
      startMinute: 0,
      endHour: 18,
      endMinute: 0,
    },
    dailyCapMinutes: profile.dailyCapMinutes || 240,
  });

  return { plan, unscheduled };
}

/**
 * Save a generated plan and log the event.
 * @param {object} params
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
 * @param {string | import("mongoose").Types.ObjectId} userId
 * @param {object} [options]
 * @returns {Promise<object[]>}
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
