// ==================== OFEK — SERVICES (START) ====================
export const ofekService = {
  // Example: fetch items from a DB (mocked)
  list: async () => {
    // TODO(Ofek): connect to DB and return items
    return [];
  },
  create: async (data) => {
    // TODO(Ofek): insert item in DB
    return { id: "mock-id", ...data };
  },
};
// ==================== OFEK — SERVICES (END) ======================

// ==================== GAL — SERVICES (START) =====================
export const galService = {
  getProfile: async () => {
    // TODO(Gal): query user profile
    return { name: "Gal", role: "teammate" };
  },
  updateProfile: async (data) => {
    // TODO(Gal): update user profile
    return { ...data, updatedAt: new Date().toISOString() };
  },
};
// ==================== GAL — SERVICES (END) =======================

// ==================== JONI — SERVICES (START) ====================
export const joniService = {
  stats: async () => {
    // TODO(Joni): compute stats from DB
    return { users: 0, sessions: 0 };
  },
  triggerJob: async () => {
    // TODO(Joni): run a job (mocked)
    return { ok: true };
  },
};
// ==================== JONI — SERVICES (END) ======================
