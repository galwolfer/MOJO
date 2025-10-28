// src/services/priority.js
export function scoreActivities(activities, profile = {}) {
  const now = new Date();

  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const norm = (x, lo, hi) => (x - lo) / (hi - lo);
  const timeOfDay = (d) => (d.getHours() < 12 ? "morning" : d.getHours() < 18 ? "noon" : "evening");
  const inRange = (hhmm, start, end) => (start <= end ? hhmm >= start && hhmm <= end : hhmm >= start || hhmm <= end);
  const inQuiet = (qs, d) => (qs || []).some(({ start, end }) => inRange(d.toTimeString().slice(0, 5), start, end));

  const urgency = (deadline) => {
    if (!deadline) return 0;
    const ms = new Date(deadline) - now;
    if (ms <= 0) return 1; // עבר דדליין = דחיפות גבוהה
    const horizon = 7 * 24 * 3600 * 1000; // 7 ימים
    return clamp(1 - ms / horizon, 0, 1);
  };

  const contextFit = (a) => {
    if (inQuiet(profile?.quiet_hours, now)) return 0;
    const need = a.required_context?.timeOfDay;
    if (!need || need === "any") return 1;
    return need === timeOfDay(now) ? 1 : 0.5;
  };

  const streakPressure = (a) => (a.recurrence === "daily" ? 0.7 : 0.2);
  const diversityBonus = () => 0.3;

  const nextFreeSlot = (durationMin) => {
    const start = new Date(now);
    const end = new Date(now.getTime() + (durationMin || 30) * 60000);
    return { start: start.toISOString(), end: end.toISOString(), duration: durationMin || 30 };
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

  const out = [];
  for (const a of activities) {
    if (a.status !== "open") continue; // רק פתוחות
    const importance = Number.isFinite(a.importance) ? a.importance : 3;
    const effort = Number.isFinite(a.effort) ? a.effort : 3;

    const U = urgency(a.deadline);
    const I = norm(importance, 1, 5);
    const E = norm(effort, 1, 5);
    const C = contextFit(a);
    const S = streakPressure(a);
    const V = diversityBonus(a);
    const eps = 0; // ללא רנדומליות

    const score = clamp(100 * (0.35 * U + 0.25 * I + 0.15 * C + 0.1 * S + 0.05 * V + 0.05 * eps - 0.2 * E), 0, 100);
    const window = nextFreeSlot(a.duration_min);
    const reason = buildReason({ U, I, C, S, E });
    out.push({ activityId: a.id, title: a.title, score, window, reason });
  }

  out.sort((a, b) => b.score - a.score || a.window.duration - b.window.duration);
  return { top: out[0] || null, queue: out };
}
