// src/algorithms/csp/scheduler.js
// CSP-based task scheduler with backtracking, constraint propagation, and heuristics.

import { satisfiesHardConstraints, computeSoftScore } from "./constraints.js";
import { selectVariableMRV, orderValuesLCV, forwardCheck } from "./heuristics.js";
import { buildWorkingWindow } from "../../utils/timeWindows.js";
import { addDays, startOfDay, addMinutes } from "../../utils/dateUtils.js";

const DEFAULT_WORKING_HOURS = {
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
};

const DEFAULT_DAILY_CAP_MINUTES = 240; // 4 hours
const SLOT_GRANULARITY_MINUTES = 15; // generate slots every 15 min
const MAX_BACKTRACK_ITERATIONS = 10000; // prevent infinite loops

/**
 * Main entry point: schedule tasks using CSP with backtracking.
 *
 * @param {object[]} tasks - tasks to schedule
 * @param {object} options
 * @returns {{ plan: object[], unscheduled: object[] }}
 */
export function scheduleTasksCSP(tasks, options = {}) {
  const {
    busyBlocksByDate = {},
    workingHours = DEFAULT_WORKING_HOURS,
    planningHorizonDays = 14,
    dailyCapMinutes = DEFAULT_DAILY_CAP_MINUTES,
  } = options;

  const today = startOfDay(new Date());
  const horizonEnd = addDays(today, planningHorizonDays);

  // Step 1: Generate variables (one per task chunk that needs scheduling)
  const variables = generateVariables(tasks, horizonEnd);

  if (!variables.length) {
    return { plan: [], unscheduled: [] };
  }

  // Step 2: Generate domains (available slots for each variable)
  const variableDomains = new Map();
  const variablesWithDomains = [];
  const variablesWithoutDomains = [];
  
  for (const variable of variables) {
    const domain = generateDomain({
      variable,
      today,
      horizonEnd,
      busyBlocksByDate,
      workingHours,
    });
    
    if (domain.length > 0) {
      variableDomains.set(variable.id, domain);
      variablesWithDomains.push(variable);
    } else {
      // No valid slots for this variable - mark as unschedulable
      variablesWithoutDomains.push(variable);
    }
  }

  // Step 3: Run backtracking search only on variables that have domains
  const result = backtrackSearch({
    variables: variablesWithDomains,
    variableDomains,
    busyBlocksByDate,
    workingHours,
    dailyCapMinutes,
  });

  // Step 4: Build plan and unscheduled lists
  const plan = [];
  const unscheduled = [];
  const assignedVarIds = new Set(result.assignments.map((a) => a.variableId));

  for (const assignment of result.assignments) {
    plan.push({
      taskId: assignment.taskId,
      title: assignment.title,
      date: assignment.slot.start.toISOString().slice(0, 10),
      start: assignment.slot.start,
      end: assignment.slot.end,
      minutes: assignment.slot.minutes,
    });
  }

  // Collect unscheduled chunks (from both failed assignments and variables without domains)
  const unscheduledByTask = new Map();
  
  // Add variables that had no valid domains at all
  for (const variable of variablesWithoutDomains) {
    const taskId = variable.taskId.toString();
    if (!unscheduledByTask.has(taskId)) {
      unscheduledByTask.set(taskId, {
        taskId: variable.taskId,
        title: variable.title,
        remainingMinutes: 0,
      });
    }
    unscheduledByTask.get(taskId).remainingMinutes += variable.chunkMinutes;
  }
  
  // Add variables that had domains but couldn't be assigned
  for (const variable of variablesWithDomains) {
    if (!assignedVarIds.has(variable.id)) {
      const taskId = variable.taskId.toString();
      if (!unscheduledByTask.has(taskId)) {
        unscheduledByTask.set(taskId, {
          taskId: variable.taskId,
          title: variable.title,
          remainingMinutes: 0,
        });
      }
      unscheduledByTask.get(taskId).remainingMinutes += variable.chunkMinutes;
    }
  }

  unscheduled.push(...unscheduledByTask.values());

  return { plan, unscheduled };
}

/**
 * Generate CSP variables from tasks.
 * Each variable represents a chunk of a task that needs scheduling.
 */
function generateVariables(tasks, horizonEnd) {
  const variables = [];
  let varIndex = 0;
  const now = new Date();

  for (const task of tasks) {
    const totalMinutes = task.estimatedDuration || 0;
    if (totalMinutes <= 0) continue;

    const taskType = task.taskType || (task.canSplit ? "in_parts" : "perfect");
    
    // Handle deadline: if past or missing, use horizonEnd
    let deadline = task.dueDate ? new Date(task.dueDate) : horizonEnd;
    if (deadline < now) {
      // Deadline has passed - treat as urgent, schedule ASAP within horizon
      deadline = horizonEnd;
    }

    let chunks = [];

    if (taskType === "leaky") {
      // Leaky tasks: flexible chunk sizes between minMinutes and maxMinutes
      // Use minMinutes as the target chunk size, default to 60 min
      const minChunk = task.minMinutes || 60;
      const maxChunk = task.maxMinutes || minChunk;
      let remaining = totalMinutes;
      while (remaining > 0) {
        // Random chunk size between min and max, capped by remaining
        const targetSize = minChunk + Math.floor(Math.random() * (maxChunk - minChunk + 1));
        const size = Math.min(targetSize, remaining);
        chunks.push(size);
        remaining -= size;
      }
    } else if (taskType === "perfect" || !task.canSplit) {
      // Single chunk for entire task
      chunks.push(totalMinutes);
    } else if (taskType === "in_parts" && task.chunkCount) {
      // Split into specified number of chunks
      const chunkSize = Math.ceil(totalMinutes / task.chunkCount);
      let remaining = totalMinutes;
      while (remaining > 0) {
        const size = Math.min(chunkSize, remaining);
        chunks.push(size);
        remaining -= size;
      }
    } else {
      // Default splitting
      const chunkSize = task.minChunk || 30;
      let remaining = totalMinutes;
      while (remaining > 0) {
        const size = Math.min(chunkSize, remaining);
        chunks.push(size);
        remaining -= size;
      }
    }

    for (let i = 0; i < chunks.length; i++) {
      variables.push({
        id: `${task._id}_chunk_${i}`,
        taskId: task._id,
        title: task.taskname || task.title || "(untitled)",
        chunkIndex: i,
        chunkMinutes: chunks[i],
        totalChunks: chunks.length,
        deadline,
        priorityScore: task.priorityScore || 0,
        canSplit: task.canSplit,
        taskType,
      });
      varIndex++;
    }
  }

  // Sort by priority (highest first) and deadline (earliest first)
  variables.sort((a, b) => {
    const deadlineDiff = a.deadline.getTime() - b.deadline.getTime();
    if (deadlineDiff !== 0) return deadlineDiff;
    return (b.priorityScore || 0) - (a.priorityScore || 0);
  });

  return variables;
}

/**
 * Generate domain (available slots) for a variable.
 */
function generateDomain({ variable, today, horizonEnd, busyBlocksByDate, workingHours }) {
  const slots = [];
  const deadline = variable.deadline < horizonEnd ? variable.deadline : horizonEnd;
  const chunkMinutes = variable.chunkMinutes;
  const now = new Date(); // current time to skip past slots

  let currentDay = new Date(today);

  while (currentDay <= deadline) {
    const dateKey = currentDay.toISOString().slice(0, 10);
    const workingWindow = buildWorkingWindow(currentDay, workingHours);
    const busyBlocks = busyBlocksByDate[dateKey] || [];

    // Generate slots at SLOT_GRANULARITY_MINUTES intervals
    let slotStart = new Date(workingWindow.start);

    while (slotStart < workingWindow.end) {
      const slotEnd = addMinutes(slotStart, chunkMinutes);

      if (slotEnd > workingWindow.end) break;

      // Skip slots that are in the past
      if (slotStart < now) {
        slotStart = addMinutes(slotStart, SLOT_GRANULARITY_MINUTES);
        continue;
      }

      const candidateSlot = {
        start: new Date(slotStart),
        end: new Date(slotEnd),
        minutes: chunkMinutes,
        dateKey,
      };

      // Check if slot respects busy blocks
      const overlapsWithBusy = busyBlocks.some(
        (block) => !(candidateSlot.end <= block.start || candidateSlot.start >= block.end)
      );

      if (!overlapsWithBusy) {
        slots.push(candidateSlot);
      }

      slotStart = addMinutes(slotStart, SLOT_GRANULARITY_MINUTES);
    }

    currentDay = addDays(currentDay, 1);
  }

  return slots;
}

/**
 * Backtracking search with constraint propagation.
 */
function backtrackSearch({ variables, variableDomains, busyBlocksByDate, workingHours, dailyCapMinutes }) {
  const assignments = [];
  const assignedSlots = []; // track all assigned slots for overlap checking
  let iterations = 0;

  // Create mutable copy of domains
  let domains = new Map(variableDomains);

  function backtrack() {
    iterations++;
    if (iterations > MAX_BACKTRACK_ITERATIONS) {
      return true; // stop but keep partial solution
    }

    // Find unassigned variables
    const assignedIds = new Set(assignments.map((a) => a.variableId));
    const unassigned = variables
      .filter((v) => !assignedIds.has(v.id))
      .map((v) => ({ variable: v, domain: domains.get(v.id) || [] }));

    if (unassigned.length === 0) {
      return true; // all assigned, success!
    }

    // Select variable using MRV heuristic
    const selected = selectVariableMRV(unassigned);
    if (!selected || selected.domain.length === 0) {
      return false; // no valid assignment possible
    }

    const variable = selected.variable;

    // Order values using LCV heuristic
    const orderedDomain = orderValuesLCV(selected.domain, (slot) =>
      computeSoftScore({
        candidateSlot: { ...slot, minutes: variable.chunkMinutes },
        taskId: variable.taskId,
        existingAssignments: assignedSlots,
        dailyCapMinutes,
      })
    );

    for (const slot of orderedDomain) {
      const candidateSlot = {
        start: slot.start,
        end: slot.end,
        minutes: variable.chunkMinutes,
        dateKey: slot.dateKey,
      };

      // Check hard constraints
      const workingWindow = buildWorkingWindow(slot.start, workingHours);
      const busyBlocks = busyBlocksByDate[slot.dateKey] || [];

      if (
        !satisfiesHardConstraints({
          candidateSlot,
          existingAssignments: assignedSlots,
          busyBlocksForDay: busyBlocks,
          workingWindow,
          deadline: variable.deadline,
        })
      ) {
        continue;
      }

      // Make assignment
      const assignment = {
        variableId: variable.id,
        taskId: variable.taskId,
        title: variable.title,
        slot: candidateSlot,
      };

      assignments.push(assignment);
      assignedSlots.push(candidateSlot);

      // Forward checking: prune domains
      const prunedDomains = forwardCheck(candidateSlot, domains, variable.id);

      if (prunedDomains !== null) {
        const savedDomains = domains;
        domains = prunedDomains;

        if (backtrack()) {
          return true;
        }

        domains = savedDomains; // restore on backtrack
      }

      // Undo assignment
      assignments.pop();
      assignedSlots.pop();
    }

    return false; // no valid value found, backtrack
  }

  backtrack();

  return { assignments, iterations };
}

/**
 * Export for use by planningService.
 */
export function planTasksCSP(tasks, options = {}) {
  return scheduleTasksCSP(tasks, options);
}
