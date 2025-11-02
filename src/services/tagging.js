// src/services/tagging.js
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
    tag: "health",
    weight: 1.18,
    keywords: ["doctor", "dentist", "medication", "workout", "gym", "run", "yoga", "physio"],
  },
  {
    tag: "finance",
    weight: 1.12,
    keywords: ["invoice", "budget", "tax", "payment", "bank", "expense", "billing"],
  },
  {
    tag: "family",
    weight: 1.1,
    keywords: ["family", "kids", "parent", "birthday", "anniversary", "school"],
  },
  {
    tag: "social",
    weight: 1.05,
    keywords: ["call", "meet", "hangout", "coffee", "friend", "party", "network"],
  },
  {
    tag: "sports",
    weight: 0.98,
    keywords: ["game", "match", "practice", "training", "team", "tournament", "run", "sports", "swim"],
  },
  {
    tag: "household",
    weight: 0.95,
    keywords: ["clean", "laundry", "dishes", "cook", "groceries", "repair", "chores"],
  },
  {
    tag: "creative",
    weight: 1.05,
    keywords: ["design", "paint", "write", "compose", "draw", "sketch"],
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

// Direct tag -> weight mapping to reuse later
const TAG_WEIGHTS = TAG_BLUEPRINTS.reduce((acc, { tag, weight }) => {
  acc[tag] = weight;
  return acc;
}, {});

// Map tags to broader life categories for user preferences
const TAG_TO_CATEGORY = {
  work: "work",
  study: "study",
  health: "health",
  sports: "health",
  finance: "finance",
  family: "social",
  social: "social",
  household: "household",
  creative: "creative",
  misc: "misc",
};

const DEFAULT_TAG = "misc";

// Extract lowercased tokens from free-form text
const normalizeTokens = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

export function detectTags({ title = "", description = "", tags = [] } = {}) {
  const base = Array.isArray(tags) ? tags.filter(Boolean) : [];
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

const preferenceToFactor = (value) => {
  const safe = Number.isFinite(value) ? value : 3;
  return 1 + (safe - 3) * 0.2;
};

const mapTagToCategory = (tag) => TAG_TO_CATEGORY[tag] || "misc";

const hasPreferences = (preferences) =>
  preferences && Object.values(preferences).some((v) => Number.isFinite(v));

export function computeTagMultiplier(taskTags = [], preferences = {}) {
  const tags = Array.isArray(taskTags) && taskTags.length ? taskTags : [DEFAULT_TAG];
  let multiplier = 0;
  let weightSum = 0;
  const usePreferences = hasPreferences(preferences);

  tags.forEach((tag) => {
    const normalized = String(tag || "").toLowerCase();
    const category = mapTagToCategory(normalized);
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

export function summarizeTags(tags = []) {
  if (!Array.isArray(tags) || !tags.length) return ["misc"];
  return tags.map((t) => String(t).toLowerCase());
}

export function getTagBlueprints() {
  return TAG_BLUEPRINTS.map(({ tag, weight }) => ({ tag, weight }));
}

export function describeTagWeights(tags = [], preferences = {}) {
  const normalized = summarizeTags(tags);
  const usePreferences = hasPreferences(preferences);
  return normalized.map((tag) => ({
    tag,
    category: mapTagToCategory(tag),
    source: usePreferences && preferences[mapTagToCategory(tag)] != null ? "preference" : "baseline",
    preference: usePreferences ? preferences[mapTagToCategory(tag)] ?? null : null,
    weight:
      usePreferences && preferences[mapTagToCategory(tag)] != null
        ? preferenceToFactor(preferences[mapTagToCategory(tag)])
        : TAG_WEIGHTS[tag] ?? TAG_WEIGHTS[DEFAULT_TAG],
  }));
}
