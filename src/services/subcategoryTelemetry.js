// src/services/subcategoryTelemetry.js
// Thin wrappers around telemetry logging for the subcategory system.

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
