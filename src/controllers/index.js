// ==================== OFEK — CONTROLLERS (START) ====================
// Example controller for Ofek's feature set.
export const ofekListItems = async (_req, res, _next) => {
  // TODO(Ofek): implement business logic or call services.ofek*()
  res.json({ owner: "Ofek", items: [] });
};

export const ofekCreateItem = async (req, res, _next) => {
  // TODO(Ofek): validate req.body then persist via services.ofek*()
  res.status(201).json({ owner: "Ofek", created: req.body ?? {} });
};

// ==================== OFEK — CONTROLLERS (END) ======================
// ==================== GAL — CONTROLLERS (START) =====================
// Example controller for Gal's feature set.
export const galGetProfile = async (_req, res, _next) => {
  // TODO(Gal): implement profile retrieval (mock)
  res.json({ owner: "Gal", profile: { name: "Gal", role: "teammate" } });
};

export const galUpdateProfile = async (req, res, _next) => {
  // TODO(Gal): update logic
  res.json({ owner: "Gal", updated: req.body ?? {} });
};
// ==================== GAL — CONTROLLERS (END) =======================
// ==================== JONI — CONTROLLERS (START) ====================
// Controllers for Joni's feature set (Coacher Algorithm / Priority Engine)

import { joniService } from "../services/index.js";

export const joniCoachNext = async (req, res, _next) => {
  // TODO(Joni): compute next recommended activity using the Coacher Algorithm
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const result = await joniService.computePriority(userId);
    res.json({ owner: "Joni", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const joniCoachFeedback = async (req, res, _next) => {
  // TODO(Joni): record user feedback for the Coacher Algorithm
  try {
    const { userId, activityId, action } = req.body || {};
    if (!userId || !activityId || !action) {
      return res.status(400).json({ error: "userId, activityId, and action are required" });
    }

    await joniService.recordFeedback({ userId, activityId, action });
    res.json({ owner: "Joni", ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const joniStats = async (_req, res, _next) => {
  // TODO(Joni): compute statistics or call services.joni*()
  const result = await joniService.stats();
  res.json({ owner: "Joni", stats: result });
};

export const joniTriggerJob = async (_req, res, _next) => {
  // TODO(Joni): trigger a background-like job (mocked example)
  const result = await joniService.triggerJob();
  res.json({ owner: "Joni", job: result });
};
// ==================== JONI — CONTROLLERS (END) ======================
