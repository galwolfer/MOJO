// src/algorithms/priority/tagging.js
// Lightweight tag detection and weighting so tasks can be categorized
// automatically and their priority adjusted accordingly.

// Ordered tag definitions with multipliers and keywords
const TAG_BLUEPRINTS = [
  {
    tag: "work",
    weight: 1.2,
    keywords: ["meeting", "project", "client", "report", "presentation", "deadline", "sprint"],
  },
  {
    tag: "study",
    weight: 1.15,
    keywords: ["study", "exam", "homework", "lecture", "course", "learn", "reading", "assignment"],
  },
  {
    tag: "skill",
    weight: 1.1,
    keywords: ["skill", "practice", "exercise", "skill-building", "tutorial", "workshop"],
  },
  {
    tag: "workout",
    weight: 1.12,
    keywords: ["workout", "gym", "run", "exercise", "yoga", "training", "fitness"],
  },
  {
    tag: "health",
    weight: 1.18,
    keywords: ["doctor", "dentist", "medication", "checkup", "diet", "sleep", "wellness", "symptom"],
  },
  {
    tag: "finance",
    weight: 1.12,
    keywords: ["invoice", "budget", "tax", "payment", "bank", "expense", "billing", "bills"],
  },
  {
    tag: "family",
    weight: 1.1,
    keywords: ["family", "kids", "children", "parent", "birthday", "anniversary", "school"],
  },
  {
    tag: "social",
    weight: 1.05,
    keywords: ["call", "meet", "hangout", "coffee", "friend", "party", "network", "dinner"],
  },
  {
    tag: "creative",
    weight: 1.05,
    keywords: ["design", "paint", "write", "compose", "draw", "sketch", "photo", "video"],
  },
  {
    tag: "hobby",
    weight: 0.95,
    keywords: ["hobby", "hobbies", "gardening", "gaming", "craft", "collect", "model"],
  },
  {
    tag: "reflection",
    weight: 0.9,
    keywords: ["reflect", "journal", "reflection", "review", "retrospective"],
  },
  {
    tag: "mindfulness",
    weight: 0.95,
    keywords: ["mindful", "mindfulness", "meditation", "breath", "breathing", "awareness"],
  },
  {
    tag: "goals",
    weight: 1.05,
    keywords: ["goal", "goals", "milestone", "objective", "target"],
  },
  {
    tag: "recovery",
    weight: 0.9,
    keywords: ["recovery", "rest", "rehab", "therapy", "recover"],
  },
  {
    tag: "explore",
    weight: 0.95,
    keywords: ["explore", "exploration", "discover", "trip", "travel", "adventure"],
  },
  {
    tag: "household",
    weight: 0.95,
    keywords: ["clean", "laundry", "dishes", "cook", "groceries", "repair", "chores"],
  },
  {
    tag: "misc",
    weight: 0.9,
    keywords: [],
  },
];

// Fast lookup from keyword -> tag
const KEYWORD_MAP = TAG_BLUEPRINTS.reduce((acc, { tag, keywords }) => {
  keywords.forEach((kw) => acc.set(kw.toLowerCase(), tag));
  return acc;
}, new Map());
// KEYWORD_MAP: maps token -> canonical tag for quick detection

// Direct tag -> weight mapping to reuse later
const TAG_WEIGHTS = TAG_BLUEPRINTS.reduce((acc, { tag, weight }) => {
  acc[tag] = weight;
  return acc;
}, {});
// TAG_WEIGHTS: baseline multipliers per tag used when no user preference exists

// Map tags to broader life categories for user preferences
const TAG_TO_CATEGORY = {
  work: "work_and_career",
  study: "study_and_education",
  skill: "skill_building",
  workout: "workout",
  health: "health",
  finance: "life_management",
  family: "family",
  social: "social_activity",
  household: "home_and_chores",
  creative: "creative_projects",
  hobby: "hobbies",
  reflection: "reflection",
  mindfulness: "mindfulness",
  goals: "goals",
  recovery: "recovery",
  explore: "exploration",
  misc: "uncategorized",
};

const DEFAULT_TAG = "misc";

// Extract lowercased tokens from free-form text
const normalizeTokens = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// normalizeTokens: produce keyword tokens from title/description

export function detectTags({ title = "", description = "", categories = [] } = {}) {
  const base = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const tokens = [...normalizeTokens(title), ...normalizeTokens(description)];

  const found = new Set(base.map((t) => t.toLowerCase()));
  tokens.forEach((token) => {
    if (KEYWORD_MAP.has(token)) {
      found.add(KEYWORD_MAP.get(token));
    }
  });

  if (found.size === 0) {
    found.add(DEFAULT_TAG);
  }

  return [...found];
}

// detectTags: infer tags from text + any provided tags (fall back to 'misc')

const preferenceToFactor = (value) => {
  const safe = Number.isFinite(value) ? value : 3;
  return 1 + (safe - 3) * 0.2;
};

export const categoryForTag = (tag) => TAG_TO_CATEGORY[tag] || "misc";

// categoryForTag: map a tag to a higher-level category for user prefs

const hasPreferences = (preferences) =>
  preferences && Object.values(preferences).some((v) => Number.isFinite(v));

export function computeTagMultiplier(taskCategories = [], preferences = {}) {
  const tags = Array.isArray(taskCategories) && taskCategories.length ? taskCategories : [DEFAULT_TAG];
  let multiplier = 0;
  let weightSum = 0;
  const usePreferences = hasPreferences(preferences);

  tags.forEach((tag) => {
    const normalized = String(tag || "").toLowerCase();
    const category = categoryForTag(normalized);
    let weight;
    if (usePreferences && preferences && preferences[category] != null) {
      weight = preferenceToFactor(preferences[category]);
    } else {
      weight = TAG_WEIGHTS[normalized] ?? TAG_WEIGHTS[DEFAULT_TAG];
    }
    multiplier += weight;
    weightSum += 1;
  });

  if (!weightSum) return TAG_WEIGHTS[DEFAULT_TAG];
  return multiplier / weightSum;
}

// computeTagMultiplier: average weight for a task's tags, using user preferences when available

export function summarizeTags(categories = []) {
  if (!Array.isArray(categories) || !categories.length) return ["misc"];
  return categories.map((t) => String(t).toLowerCase());
}

// summarizeTags: normalize tag list to lowercase array (fall back to 'misc')

export function getTagBlueprints() {
  return TAG_BLUEPRINTS.map(({ tag, weight }) => ({ tag, weight }));
}

export function describeTagWeights(categories = [], preferences = {}) {
  const normalized = summarizeTags(categories);
  const usePreferences = hasPreferences(preferences);
  return normalized.map((tag) => ({
    tag,
    category: categoryForTag(tag),
    source: usePreferences && preferences[categoryForTag(tag)] != null ? "preference" : "baseline",
    preference: usePreferences ? preferences[categoryForTag(tag)] ?? null : null,
    weight:
      usePreferences && preferences[categoryForTag(tag)] != null
        ? preferenceToFactor(preferences[categoryForTag(tag)])
        : TAG_WEIGHTS[tag] ?? TAG_WEIGHTS[DEFAULT_TAG],
  }));
}

// describeTagWeights: return per-tag metadata (weight, source) helpful for explanations
