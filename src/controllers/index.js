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
// Example controller for Joni's feature set.
export const joniStats = async (_req, res, _next) => {
  // TODO(Joni): compute statistics or call services.joni*()
  res.json({ owner: "Joni", stats: { users: 0, sessions: 0 } });
};

export const joniTriggerJob = async (_req, res, _next) => {
  // TODO(Joni): trigger a background-like job (synchronously mocked)
  res.json({ owner: "Joni", job: "queued" });
};
// ==================== JONI — CONTROLLERS (END) ======================
