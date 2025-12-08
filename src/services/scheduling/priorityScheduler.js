/**
 * @fileoverview Priority Scheduler Service
 * @module services/scheduling/priorityScheduler
 * 
 * Background service that periodically refreshes task priority scores.
 * Ensures priority cache stays up-to-date while the server is running.
 * 
 * Key responsibilities:
 * - Run priority score updates at configurable intervals
 * - Manage scheduler lifecycle (start/stop)
 * - Handle concurrent execution prevention
 * - Log scheduler activity and errors
 * 
 * Default interval: Every hour (configurable via env)
 * Enable via: PRIORITY_SCHEDULER_ENABLED=true
 * 
 * @requires scripts/updateScores - Score calculation logic
 */

import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { updateAllScores } from "../../scripts/updateScores.js";

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

export function startPriorityScheduler() {
  if (intervalHandle) return;
  const intervalMs = Number(env.PRIORITY_SCHEDULER_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  // warm-start: ensure scores are fresh before the first interval fires
  runOnce();
  // schedule recurring updates for as long as the server lives
  intervalHandle = setInterval(runOnce, intervalMs);
  logger.info(`Priority scheduler enabled (interval: ${intervalMs} ms)`);
}

export function stopPriorityScheduler() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
  logger.info("Priority scheduler stopped");
}