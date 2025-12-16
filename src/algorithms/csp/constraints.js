// src/algorithms/csp/constraints.js
// Constraint definitions for the CSP-based task scheduler.

/**
 * Hard constraint: two sessions must not overlap in time.
 * @param {{ start: Date, end: Date }} a
 * @param {{ start: Date, end: Date }} b
 * @returns {boolean} true if they do NOT overlap (constraint satisfied)
 */
export function noOverlap(a, b) {
  return a.end <= b.start || b.end <= a.start;
}

/**
 * Hard constraint: session must not overlap any busy block.
 * @param {{ start: Date, end: Date }} session
 * @param {{ start: Date, end: Date }[]} busyBlocks
 * @returns {boolean}
 */
export function respectsBusyBlocks(session, busyBlocks) {
  for (const block of busyBlocks) {
    if (!(session.end <= block.start || session.start >= block.end)) {
      return false;
    }
  }
  return true;
}

/**
 * Hard constraint: session must finish before or on the task's deadline.
 * @param {{ end: Date }} session
 * @param {Date | null} deadline
 * @returns {boolean}
 */
export function respectsDeadline(session, deadline) {
  if (!deadline) return true;
  return session.end <= deadline;
}

/**
 * Hard constraint: session must be within working hours window.
 * @param {{ start: Date, end: Date }} session
 * @param {{ start: Date, end: Date }} workingWindow
 * @returns {boolean}
 */
export function withinWorkingHours(session, workingWindow) {
  return session.start >= workingWindow.start && session.end <= workingWindow.end;
}

/**
 * Soft constraint: total scheduled minutes on a day should not exceed cap.
 * Returns a penalty (0 = good, higher = worse).
 * @param {number} scheduledMinutesOnDay
 * @param {number} capMinutes
 * @returns {number}
 */
export function dailyCapPenalty(scheduledMinutesOnDay, capMinutes) {
  if (scheduledMinutesOnDay <= capMinutes) return 0;
  return scheduledMinutesOnDay - capMinutes;
}

/**
 * Soft constraint: prefer spreading sessions of the same task across different days.
 * Returns penalty based on how many same-task sessions are already on this day.
 * @param {number} sameTaskSessionsOnDay
 * @returns {number}
 */
export function spreadPenalty(sameTaskSessionsOnDay) {
  // Exponential penalty to discourage clustering
  return sameTaskSessionsOnDay * sameTaskSessionsOnDay;
}

/**
 * Aggregate hard constraint check for a candidate slot.
 * @param {object} params
 * @returns {boolean}
 */
export function satisfiesHardConstraints({
  candidateSlot,
  existingAssignments,
  busyBlocksForDay,
  workingWindow,
  deadline,
}) {
  // Check working hours
  if (!withinWorkingHours(candidateSlot, workingWindow)) {
    return false;
  }

  // Check deadline
  if (!respectsDeadline(candidateSlot, deadline)) {
    return false;
  }

  // Check busy blocks
  if (!respectsBusyBlocks(candidateSlot, busyBlocksForDay)) {
    return false;
  }

  // Check overlap with already-assigned sessions
  for (const assignment of existingAssignments) {
    // Enforce minimum gap between ANY consecutive sessions (10 minutes)
    const MIN_SESSION_GAP_MINUTES = 10;
    const gapMs = MIN_SESSION_GAP_MINUTES * 60 * 1000;

    const overlaps = !noOverlap(candidateSlot, assignment);
    if (overlaps) {
      return false;
    }

    // Ensure at least 10-minute gap between any two sessions (break time)
    const endsTooClose = Math.abs(candidateSlot.start.getTime() - assignment.end.getTime()) < gapMs;
    const startsTooClose = Math.abs(assignment.start.getTime() - candidateSlot.end.getTime()) < gapMs;
    if (endsTooClose || startsTooClose) {
      return false;
    }
  }

  return true;
}

/**
 * Compute soft constraint score for a candidate slot (lower is better).
 * @param {object} params
 * @returns {number}
 */
export function computeSoftScore({
  candidateSlot,
  taskId,
  existingAssignments,
  dailyCapMinutes = 240,
}) {
  const dateKey = candidateSlot.start.toISOString().slice(0, 10);

  // Count minutes and same-task sessions on this day
  let minutesOnDay = candidateSlot.minutes || 0;
  let sameTaskOnDay = 0;
  let totalSessionsOnDay = 0;

  for (const assignment of existingAssignments) {
    const assignmentDateKey = assignment.start.toISOString().slice(0, 10);
    if (assignmentDateKey === dateKey) {
      minutesOnDay += assignment.minutes || 0;
      totalSessionsOnDay += 1;
      if (assignment.taskId?.toString() === taskId?.toString()) {
        sameTaskOnDay += 1;
      }
    }
  }

  const capPenalty = dailyCapPenalty(minutesOnDay, dailyCapMinutes);
  const clusterPenalty = spreadPenalty(sameTaskOnDay);
  
  // Penalty for overloading any single day (exponential to strongly discourage)
  const dayLoadPenalty = totalSessionsOnDay * totalSessionsOnDay * 15;

  return capPenalty * 2 + clusterPenalty * 10 + dayLoadPenalty;
}
