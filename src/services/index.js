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
  // Temporary in-memory storage for demo purposes
  _memory: {
    users: {
      u1: {
        profile: { userId: "u1", quiet_hours: [{ start: "22:00", end: "07:00" }] },
        activities: [
          { id:"a1", userId:"u1", title:"20 Minutes Walk", type:"health", duration_min:20, importance:3, effort:2, recurrence:"daily", status:"open", required_context:{ timeOfDay:"morning" } },
          { id:"a2", userId:"u1", title:"Excercise Python 30 Minutes", type:"study",  duration_min:30, importance:4, effort:3, status:"open" },
          { id:"a3", userId:"u1", title:"Submit Assignment",type:"work",   duration_min:60, importance:5, effort:3, status:"open",
            deadline: new Date(Date.now()+6*3600*1000).toISOString() }
        ],
        feedback: []
      }
    }
  },

  async computePriority(userId) {
    const u = this._memory.users[userId];
    if (!u) throw new Error("user not found");

    const now = new Date();

    // ---------- helpers ----------
    const clamp = (x,min,max)=>Math.max(min,Math.min(max,x));
    const norm  = (x,lo,hi)=> (x-lo)/(hi-lo);
    const timeOfDay = (d)=> d.getHours()<12 ? "morning" : (d.getHours()<18 ? "noon" : "evening");
    const inRange = (hhmm, start, end)=> start<=end ? (hhmm>=start && hhmm<=end) : (hhmm>=start || hhmm<=end);
    const inQuiet = (qs, d)=>{
      const h = d.toTimeString().slice(0,5);
      return (qs||[]).some(({start,end}) => inRange(h,start,end));
    };

    const urgency = (deadline)=>{
      if (!deadline) return 0;
      const ms = new Date(deadline) - now;
      if (ms <= 0) return 1;
      const horizon = 7*24*3600*1000; // A week
      return clamp(1 - ms/horizon, 0, 1);
    };

    const contextFit = (a)=>{
      if (inQuiet(u.profile?.quiet_hours, now)) return 0;
      const need = a.required_context?.timeOfDay;
      if (!need || need === "any") return 1;
      return need === timeOfDay(now) ? 1 : 0.5;
    };

    const streakPressure = (a)=> a.recurrence === "daily" ? 0.7 : 0.2;
    const diversityBonus = (_a)=> 0.3; // Small constant MVP

    const nextFreeSlot = (durationMin)=>{
      const start = new Date(now);
      const end = new Date(now.getTime() + durationMin*60000);
      return { start: start.toISOString(), end: end.toISOString(), duration: durationMin };
    };

    const buildReason = ({ U, I, C, S, E }) => {
      const parts = [];
      if (U > 0.6) parts.push("Urgent");
      if (I > 0.6) parts.push("Important");
      if (S > 0.5) parts.push("Maintains streak");
      if (C < 0.4) parts.push("Poor timing");
      if (E > 0.6) parts.push("High effort required");
      return parts.join(" · ") || "Good overall match";
    };

    // ---------- /helpers ----------

    const out = [];
    for (const a of u.activities) {
      if (a.status !== "open") continue;

      const U = urgency(a.deadline);
      const I = norm(a.importance, 1, 5);
      const E = norm(a.effort,     1, 5);
      const C = contextFit(a);
      const S = streakPressure(a);
      const V = diversityBonus(a);
      const eps = Math.random()*0.1;

      const score = clamp(100*(0.35*U + 0.25*I + 0.15*C + 0.10*S + 0.05*V + 0.05*eps - 0.20*E), 0, 100);
      const window = nextFreeSlot(a.duration_min);
      const reason = buildReason({U,I,C,S,E});

      out.push({ activityId:a.id, title:a.title, score, window, reason });
    }

    out.sort((a,b)=> b.score - a.score || a.window.duration - b.window.duration);
    return { top: out[0] || null, queue: out };
  },

  async recordFeedback({ userId, activityId, action }) {
    const u = this._memory.users[userId];
    if (!u) throw new Error("user not found");
    u.feedback.push({ userId, activityId, action, ts: new Date().toISOString() });
    return { ok: true };
  },

  // Keep in order to match what's already written in other parts of the system
  async stats()      { return { users: 1, sessions: 3 }; },
  async triggerJob() { return { ok: true }; }
};

// ==================== JONI — SERVICES (END) ======================
