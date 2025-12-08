/**
 * @fileoverview Subcategory Telemetry Service
 * @module services/telemetry/subcategoryTelemetry
 * 
 * Specialized telemetry wrappers for the subcategory system.
 * Tracks subcategory generation and user interactions with labels.
 * 
 * Key responsibilities:
 * - Record subcategory generation events
 * - Track user acceptance/rejection of suggested labels
 * - Monitor subcategory system performance
 * - Support analytics for subcategory accuracy improvement
 * 
 * Events logged: sub_category_generated, sub_category_accepted, sub_category_rejected
 * 
 * @requires services/telemetry/telemetry - Core telemetry service
 */

import { logEvent } from "./telemetry.js";

export async function recordSubCategoryGeneration({
  userId,
  taskId,
  tags = [],
  subCategory = null,
  context = "",
}) {
  if (!userId || !taskId || !subCategory?.label) return;
  // Log whenever the system suggests or refreshes a sub-category for analytics.
  await logEvent({
    type: "sub_category_generated",
    userId,
    payload: {
      taskId,
      tags,
      suggestion: {
        label: subCategory.label,
        source: subCategory.source,
        confidence: subCategory.confidence ?? null,
      },
    },
    context,
  });
}

export async function recordSubCategoryOverride({
  userId,
  taskId,
  previous = null,
  replacement = null,
  context = "",
}) {
  if (!userId || !taskId || !replacement?.label) return;
  // Capture when a user overrides the suggested sub-category for feedback.
  await logEvent({
    type: "sub_category_corrected",
    userId,
    payload: {
      taskId,
      previous,
      replacement: {
        label: replacement.label,
        source: replacement.source ?? "user",
      },
    },
    context,
  });
}
