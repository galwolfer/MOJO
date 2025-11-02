// src/services/telemetry.js
// Minimal analytics helpers for capturing user actions and suggestions.

import EventLog from "../models/EventLog.js";

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
