// src/algorithms/priority/priority.js
import { computeTagMultiplier, describeTagWeights, summarizeTags } from "./tagging.js";

export function scoreActivities(activities, profile = {}) {
  const now = new Date();
  // Short, line-level comments below explain how the priority score is built
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  // clamp: keep a value within [min, max]
  const norm = (x, lo, hi) => (x - lo) / (hi - lo);
  // norm: normalize a value from [lo,hi] to [0,1]
  const timeOfDay = (d) => (d.getHours() < 12 ? "morning" : d.getHours() < 18 ? "noon" : "evening");
  // timeOfDay: categorize hour into morning/noon/evening
  const inRange = (hhmm, start, end) => (start <= end ? hhmm >= start && hhmm <= end : hhmm >= start || hhmm <= end);
  // inRange: check hh:mm string against a possibly-wrapping interval
  const inQuiet = (qs, d) => (qs || []).some(({ start, end }) => inRange(d.toTimeString().slice(0, 5), start, end));
  // inQuiet: whether `d` falls into any user-defined quiet hours

  const urgency = (deadline) => {
    if (!deadline) return 0;
    const ms = new Date(deadline) - now;
    if (ms <= 0) return 1; //  deadline passed = high urgency
    const horizon = 7 * 24 * 3600 * 1000; // 7 days
    // urgency: 0..1 increasing as deadline approaches within a 7-day horizon
    return clamp(1 - ms / horizon, 0, 1);
  };

  const contextFit = (a) => {
    if (inQuiet(profile?.quiet_hours, now)) return 0;
    const need = a.required_context?.timeOfDay;
    if (!need || need === "any") return 1;
    // contextFit: 1 = matches preferred time, 0.5 = not ideal, 0 = forbidden by quiet hours
    return need === timeOfDay(now) ? 1 : 0.5;
  };

  const streakPressure = (a) => (a.recurrence === "daily" ? 0.7 : 0.2);
  // streakPressure: encourages daily recurring tasks (higher value)
  const diversityBonus = () => 0.3;
  // diversityBonus: small boost to encourage variety

  const nextFreeSlot = (durationMin) => {
    const start = new Date(now);
    const end = new Date(now.getTime() + (durationMin || 30) * 60000);
    return { start: start.toISOString(), end: end.toISOString(), duration: durationMin || 30 };
  };

  // buildReason: human-readable explanation based on component thresholds
  const capitalize = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

  const buildReason = ({ U, I, C, S, E, tagInfo }) => {
    const parts = [];
    if (U > 0.6) parts.push("Urgent");
    if (I > 0.6) parts.push("Important");
    if (S > 0.5) parts.push("Maintains streak");
    if (C < 0.4) parts.push("Poor timing");
    if (E > 0.6) parts.push("High effort required");
    
    // tagInfo is now a single object, not an array
    if (tagInfo) {
      const isBoosted = tagInfo.source === "preference" && tagInfo.weight > 1.05;
      const isLowered = tagInfo.source === "preference" && tagInfo.weight < 0.95;
      const isBaselineBoosted = tagInfo.source === "baseline" && tagInfo.weight > 1.05;
      const isBaselineLowered = tagInfo.source === "baseline" && tagInfo.weight < 0.95;
      
      if (isBoosted || isBaselineBoosted) {
        const label = tagInfo.source === "preference" ? tagInfo.category : tagInfo.tag;
        parts.push(`Boosted by ${capitalize(label)}`);
      } else if (isLowered || isBaselineLowered) {
        const label = tagInfo.source === "preference" ? tagInfo.category : tagInfo.tag;
        parts.push(`Lower priority (${capitalize(label)})`);
      }
    }
    
    return parts.join(" · ") || "Good overall match";
  };

  const out = [];
  const preferences = profile?.priorities || {};
  for (const a of activities) {
    if (a.status !== "open") continue; //  only "open" tasks
    const importance = Number.isFinite(a.importance) ? a.importance : 3;
    const effort = Number.isFinite(a.effort) ? a.effort : 3;

    const U = urgency(a.deadline);
    // U: urgency from deadline (0..1)
    const I = norm(importance, 1, 5);
    // I: importance normalized from [1,5] -> [0,1]
    const E = norm(effort, 1, 5);
    // E: effort normalized (higher effort reduces priority)
    const C = contextFit(a);
    // C: context fit (scheduling suitability)
    const S = streakPressure(a);
    // S: streak pressure (reward recurring tasks)
    const V = diversityBonus(a);
    // V: small constant bonus for variety
    const eps = 0; // no randomization

    const normalizedCategory = summarizeTags(a.category);
    const tagDetails = describeTagWeights(normalizedCategory, preferences);
    const multiplier = computeTagMultiplier(normalizedCategory, preferences);
    // rawScore: weighted linear combination of components -> scaled to 0..100
    // weights: urgency 35%, importance 25%, context 15%, streak 10%, diversity 5%, effort penalty -20%
    const rawScore = clamp(100 * (0.35 * U + 0.25 * I + 0.15 * C + 0.1 * S + 0.05 * V + 0.05 * eps - 0.2 * E), 0, 100);
    const score = clamp(rawScore * multiplier, 0, 100);
    // apply category-based multiplier (preferences or category boosts/penalties)
    const window = nextFreeSlot(a.duration_min);
    const reason = buildReason({ U, I, C, S, E, tagInfo: tagDetails });
    out.push({
      activityId: a.id,
      title: a.title,
      score,
      window,
      reason,
      category: normalizedCategory,
      tagDetails,
    });
  }

  out.sort((a, b) => b.score - a.score || a.window.duration - b.window.duration);
  return { top: out[0] || null, queue: out };
}
