// src/algorithms/csp/heuristics.js
// Variable and value ordering heuristics for CSP solver.

/**
 * MRV (Minimum Remaining Values) heuristic.
 * Selects the variable (task chunk) with the fewest legal slots remaining.
 * Ties broken by highest priority score.
 *
 * @param {object[]} unassignedVariables - array of { variable, domain }
 * @returns {object | null} the variable object with smallest domain
 */
export function selectVariableMRV(unassignedVariables) {
  if (!unassignedVariables.length) return null;

  let best = null;
  let bestDomainSize = Infinity;
  let bestPriority = -Infinity;

  for (const entry of unassignedVariables) {
    const domainSize = entry.domain.length;
    const priority = entry.variable.priorityScore ?? 0;

    if (
      domainSize < bestDomainSize ||
      (domainSize === bestDomainSize && priority > bestPriority)
    ) {
      best = entry;
      bestDomainSize = domainSize;
      bestPriority = priority;
    }
  }

  return best;
}

/**
 * LCV (Least Constraining Value) heuristic.
 * Orders domain values (slots) by how many options they leave for other variables.
 * In practice, we approximate by preferring slots that:
 *   1. Have lower soft-constraint penalty
 *   2. Start later in the day (leaves earlier slots for urgent tasks)
 *   3. Are on days with more remaining capacity
 *
 * @param {object[]} domain - array of candidate slots
 * @param {function} scoreFn - (slot) => number (lower is better)
 * @returns {object[]} sorted domain (best first)
 */
export function orderValuesLCV(domain, scoreFn) {
  return [...domain].sort((a, b) => {
    const scoreA = scoreFn(a);
    const scoreB = scoreFn(b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    // Tie-break: prefer earlier date (natural order), then earlier time
    // The soft score already penalizes overloaded days, so this is fine
    return a.start.getTime() - b.start.getTime();
  });
}

/**
 * Degree heuristic (tie-breaker for MRV).
 * Prefers variables involved in the most constraints with unassigned variables.
 * For our scheduler, this translates to tasks with:
 *   - Tighter deadlines
 *   - Larger remaining duration (more chunks to place)
 *
 * @param {object} variable
 * @returns {number} degree score (higher = more constrained)
 */
export function computeDegree(variable) {
  let score = 0;

  // Tighter deadline = higher degree
  if (variable.deadline) {
    const daysUntilDeadline = Math.max(
      0,
      (new Date(variable.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    score += Math.max(0, 30 - daysUntilDeadline);
  }

  // More remaining chunks = higher degree
  score += (variable.remainingChunks || 1) * 2;

  // Higher priority = higher degree
  score += (variable.priorityScore || 0) / 10;

  return score;
}

/**
 * Forward checking: after assigning a value, prune domains of other variables.
 * Returns the pruned domains or null if any domain becomes empty (failure).
 *
 * @param {object} assignedSlot - the slot just assigned
 * @param {Map<string, object[]>} variableDomains - map of variableId -> domain
 * @param {string} assignedVarId - the variable that was just assigned
 * @returns {Map<string, object[]> | null} pruned domains or null on failure
 */
export function forwardCheck(assignedSlot, variableDomains, assignedVarId) {
  const prunedDomains = new Map();

  for (const [varId, domain] of variableDomains) {
    if (varId === assignedVarId) {
      prunedDomains.set(varId, [assignedSlot]); // assigned
      continue;
    }

    // Remove slots that overlap with the assigned slot
    const filtered = domain.filter((slot) => {
      return slot.end <= assignedSlot.start || slot.start >= assignedSlot.end;
    });

    if (filtered.length === 0) {
      return null; // domain wipeout → backtrack
    }

    prunedDomains.set(varId, filtered);
  }

  return prunedDomains;
}

/**
 * Arc consistency (AC-3) for additional constraint propagation.
 * Reduces domains by ensuring every value has a consistent partner.
 *
 * @param {Map<string, object[]>} variableDomains
 * @returns {Map<string, object[]> | null} reduced domains or null on failure
 */
export function arcConsistency(variableDomains) {
  const queue = [];
  const varIds = [...variableDomains.keys()];

  // Initialize queue with all arcs
  for (let i = 0; i < varIds.length; i++) {
    for (let j = i + 1; j < varIds.length; j++) {
      queue.push([varIds[i], varIds[j]]);
      queue.push([varIds[j], varIds[i]]);
    }
  }

  const domains = new Map(variableDomains);

  while (queue.length > 0) {
    const [xi, xj] = queue.shift();
    if (revise(domains, xi, xj)) {
      if (domains.get(xi).length === 0) {
        return null; // failure
      }
      // Add neighbors back to queue
      for (const xk of varIds) {
        if (xk !== xi && xk !== xj) {
          queue.push([xk, xi]);
        }
      }
    }
  }

  return domains;
}

/**
 * Revise domain of xi to be arc-consistent with xj.
 * @returns {boolean} true if domain was reduced
 */
function revise(domains, xi, xj) {
  let revised = false;
  const domainI = domains.get(xi);
  const domainJ = domains.get(xj);

  const newDomainI = domainI.filter((slotI) => {
    // Check if there's at least one consistent value in xj's domain
    return domainJ.some((slotJ) => {
      return slotI.end <= slotJ.start || slotI.start >= slotJ.end;
    });
  });

  if (newDomainI.length < domainI.length) {
    domains.set(xi, newDomainI);
    revised = true;
  }

  return revised;
}
