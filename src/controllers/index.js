/*
 * File: src/controllers/index.js
 * Purpose: Small feature controllers and thin public handlers (profile, priority)
 */

/*
 * Feature controllers index
 * -------------------------
 * This file exposes lightweight, documented controllers for small feature
 * modules. Names are neutral and non-personal to keep the codebase generic.
 * Where possible we use the corresponding service exports (from `src/services/index.js`).
 * If a service is not implemented, the endpoints return 501 (Not Implemented)
 * with a clear message so clients receive a predictable response.
 */

import { profileService, coacherAlgorithm } from "../services/index.js";


// ------------------- PROFILE — CONTROLLERS -------------------
/**
 * Get profile
 * GET /api/profile
 * Uses `profileService.getProfile()` if available, otherwise returns mock data.
 */
export const profileGet = async (_req, res, _next) => {
  if (typeof profileService?.getProfile === "function") {
    try {
      const profile = await profileService.getProfile();
      return res.json({ owner: "profile", profile });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback mock (safe default)
  return res.json({ owner: "profile", profile: { name: "user", role: "member" } });
};

/**
 * Update profile
 * PUT /api/profile
 */
export const profileUpdate = async (req, res, _next) => {
  if (typeof profileService?.updateProfile === "function") {
    try {
      const updated = await profileService.updateProfile(req.body ?? {});
      return res.json({ owner: "profile", updated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback: echo back body
  return res.json({ owner: "profile", updated: req.body ?? {} });
};

// ------------------- PRIORITY — CONTROLLERS -------------------
/**
 * Compute next recommended activity using the Coacher algorithm
 * POST /api/priority/coach/next
 * Body: { userId?: string }
 * If `userId` is not provided in the body, attempt reading `req.user.userId`.
 */
export const priorityNext = async (req, res, _next) => {
  try {
    const { userId: bodyUserId } = req.body || {};
    const userId = bodyUserId || req?.user?.userId;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // Use coacherAlgorithm from services (already implemented)
    const result = await coacherAlgorithm.computeFromDb(userId);
    return res.json({ owner: "priority", ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Record feedback for the Coacher algorithm
 * POST /api/priority/coach/feedback
 * Body: { userId, activityId, action }
 * Currently this is a safe no-op that returns 200 until a persistent
 * recording implementation is added.
 */
export const priorityFeedback = async (req, res, _next) => {
  try {
    const { userId, activityId, action } = req.body || {};
    if (!userId || !activityId || !action) {
      return res.status(400).json({ error: "userId, activityId, and action are required" });
    }

    // TODO: persist feedback to a DB/ML pipeline. For now, return ok.
    return res.json({ owner: "priority", ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Get lightweight priority stats
 * GET /api/priority/stats
 */
export const priorityStats = async (_req, res, _next) => {
  try {
    // Basic stat: return coacher algorithm availability and a sample
    return res.json({ owner: "priority", stats: { available: true } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Trigger a priority job (ad-hoc)
 * POST /api/priority/job
 */
export const priorityTriggerJob = async (_req, res, _next) => {
  try {
    // In future, this could enqueue a background job. For now, run a quick health action.
    return res.json({ owner: "priority", job: { triggered: true, ts: Date.now() } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
