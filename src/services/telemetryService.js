/**
 * @fileoverview Telemetry Service
 * @module services/telemetryService
 *
 * Consolidated analytics service for capturing user actions and system events.
 * Provides minimal, non-blocking logging for application-wide telemetry.
 *
 * Key responsibilities:
 * - Log user actions (task creation, completion, etc.)
 * - Capture system events (scheduling, predictions, errors)
 * - Track subcategory generation and user interactions
 * - Store events in EventLog collection for analysis
 *
 * Event structure: { type, userId, payload, context, timestamp }
 *
 * @requires models/EventLog - Event storage model
 */

import EventLog from "../models/EventLog.js";

// =============================================================================
// CORE TELEMETRY
// =============================================================================

/**
 * Log an event to the telemetry system.
 * @param {{ type: string, userId?: string, payload?: object, context?: string }} params
 */
export async function logEvent({ type, userId = null, payload = {}, context = "" }) {
  if (!type) return;
  try {
    await EventLog.create({
      userId,
      eventType: type,
      context,
      payload,
    });
  } catch (err) {
    console.error("Telemetry log failed:", err?.message || err);
  }
}

// =============================================================================
// SUBCATEGORY TELEMETRY
// =============================================================================

/**
 * Record when the system generates/suggests a subcategory for a task.
 * @param {{ userId: string, taskId: string, categories?: string[], subCategory?: object, context?: string }} params
 */
export async function recordSubCategoryGeneration({
  userId,
  taskId,
  categories = [],
  subCategory = null,
  context = "",
}) {
  const label = subCategory?.label || subCategory?.name;
  if (!userId || !taskId || !label) return;
  await logEvent({
    type: "sub_category_generated",
    userId,
    payload: {
      taskId,
      categories,
      suggestion: {
        label,
        source: subCategory.source,
        confidence: subCategory.confidence ?? null,
      },
    },
    context,
  });
}

/**
 * Record when a user overrides a suggested subcategory.
 * @param {{ userId: string, taskId: string, previous?: object, replacement?: object, context?: string }} params
 */
export async function recordSubCategoryOverride({ userId, taskId, previous = null, replacement = null, context = "" }) {
  const label = replacement?.label || replacement?.name;
  if (!userId || !taskId || !label) return;
  await logEvent({
    type: "sub_category_corrected",
    userId,
    payload: {
      taskId,
      previous,
      replacement: {
        label,
        source: replacement.source ?? "user",
      },
    },
    context,
  });
}
