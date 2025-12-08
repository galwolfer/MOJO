/**
 * @fileoverview Telemetry Service
 * @module services/telemetry/telemetry
 * 
 * Core analytics service for capturing user actions and system events.
 * Provides minimal, non-blocking logging for application-wide telemetry.
 * 
 * Key responsibilities:
 * - Log user actions (task creation, completion, etc.)
 * - Capture system events (scheduling, predictions, errors)
 * - Store events in EventLog collection for analysis
 * - Support debugging and usage analytics
 * 
 * Event structure: { type, userId, payload, context, timestamp }
 * 
 * @requires models/EventLog - Event storage model
 */

import EventLog from "../../models/EventLog.js";

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
