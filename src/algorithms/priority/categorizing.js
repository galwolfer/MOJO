// src/algorithms/priority/categorizing.js
// Lightweight category detection and weighting so tasks can be categorized
// automatically and their priority adjusted accordingly.

import { CATEGORY_STRING_VALUES } from "../../config/categories.js";

// Ordered category definitions with multipliers and keywords
const CATEGORY_BLUEPRINTS = [
  {
    category: "work",
    weight: 1.2,
    keywords: [
      "meeting",
      "project",
      "client",
      "report",
      "presentation",
      "deadline",
      "sprint",
      "job",
      "application",
      "apply",
      "resume",
      "interview",
      "hiring",
      "candidate",
      "career",
    ],
  },
  {
    category: "study",
    weight: 1.15,
    keywords: ["study", "exam", "homework", "lecture", "course", "learn", "reading", "assignment"],
  },
  {
    category: "skill",
    weight: 1.1,
    keywords: ["skill", "practice", "exercise", "skill-building", "tutorial", "workshop"],
  },
  {
    category: "workout",
    weight: 1.12,
    keywords: ["workout", "gym", "run", "exercise", "yoga", "training", "fitness"],
  },
  {
    category: "health",
    weight: 1.18,
    keywords: ["doctor", "dentist", "medication", "checkup", "diet", "sleep", "wellness", "symptom"],
  },
  {
    category: "finance",
    weight: 1.12,
    keywords: ["invoice", "budget", "tax", "payment", "bank", "expense", "billing", "bills"],
  },
  {
    category: "family",
    weight: 1.1,
    keywords: ["family", "kids", "children", "parent", "birthday", "anniversary", "school"],
  },
  {
    category: "social",
    weight: 1.05,
    keywords: ["call", "meet", "hangout", "coffee", "friend", "party", "network", "dinner"],
  },
  {
    category: "creative",
    weight: 1.05,
    keywords: ["design", "paint", "write", "compose", "draw", "sketch", "photo", "video"],
  },
  {
    category: "hobby",
    weight: 0.95,
    keywords: ["hobby", "hobbies", "gardening", "gaming", "craft", "collect", "model"],
  },
  {
    category: "reflection",
    weight: 0.9,
    keywords: ["reflect", "journal", "reflection", "review", "retrospective"],
  },
  {
    category: "mindfulness",
    weight: 0.95,
    keywords: ["mindful", "mindfulness", "meditation", "breath", "breathing", "awareness"],
  },
  {
    category: "goals",
    weight: 1.05,
    keywords: ["goal", "goals", "milestone", "objective", "target"],
  },
  {
    category: "recovery",
    weight: 0.9,
    keywords: ["recovery", "rest", "rehab", "therapy", "recover"],
  },
  {
    category: "explore",
    weight: 0.95,
    keywords: [
      "explore",
      "exploration",
      "discover",
      "trip",
      "travel",
      "adventure",
      "vacation",
      "hotel",
      "hotels",
      "flight",
      "booking",
      "paris",
    ],
  },
  {
    category: "relationship",
    weight: 1.0,
    keywords: ["relationship", "date", "partner", "spouse", "couple", "romance", "dating", "boyfriend", "girlfriend"],
  },
  {
    category: "household",
    weight: 0.95,
    keywords: ["clean", "laundry", "dishes", "cook", "groceries", "repair", "chores"],
  },
  {
    category: "uncategorized",
    weight: 0.9,
    keywords: [],
  },
];

// Fast lookup from keyword -> category
const KEYWORD_MAP = CATEGORY_BLUEPRINTS.reduce((acc, { category, keywords }) => {
  keywords.forEach((kw) => acc.set(kw.toLowerCase(), category));
  return acc;
}, new Map());
// KEYWORD_MAP: maps token -> canonical category for quick detection

// Direct category -> weight mapping to reuse later
const CATEGORY_WEIGHTS = CATEGORY_BLUEPRINTS.reduce((acc, { category, weight }) => {
  acc[category] = weight;
  return acc;
}, {});
// CATEGORY_WEIGHTS: baseline multipliers per category used when no user preference exists

// Map internal categories to broader life categories for user preferences
const CATEGORY_TO_LIFECYCLE = {
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
  relationship: "relationship",
  uncategorized: "uncategorized",
};

const DEFAULT_CATEGORY = "uncategorized";

// Extract lowercased tokens from free-form text
const normalizeTokens = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// normalizeTokens: produce keyword tokens from title/description

export function detectCategory({ title = "", description = "", category = "" } = {}) {
  const tokens = [...normalizeTokens(title), ...normalizeTokens(description)];

  const found = new Set();

  // If there's already a category, keep it unless it's empty
  if (category && typeof category === "string" && category.trim()) {
    found.add(category.toLowerCase().trim());
  }

  // Add categories detected from text
  tokens.forEach((token) => {
    if (KEYWORD_MAP.has(token)) {
      found.add(KEYWORD_MAP.get(token));
    }
  });

  // If no categories found, use default
  if (found.size === 0) {
    return CATEGORY_TO_LIFECYCLE[DEFAULT_CATEGORY] || "uncategorized";
  }

  // Return the first detected category mapped to its lifecycle category
  const firstCategory = [...found][0];
  return CATEGORY_TO_LIFECYCLE[firstCategory] || firstCategory;
}

// detectCategory: infer single category from text + any provided category (fall back to default)

const preferenceToFactor = (value) => {
  const safe = Number.isFinite(value) ? value : 3;
  return 1 + (safe - 3) * 0.2;
};

export const mapCategoryToLifecycle = (category) => CATEGORY_TO_LIFECYCLE[category] || "uncategorized";

// mapCategoryToLifecycle: map an internal category to a higher-level lifecycle category for user prefs

const hasPreferences = (preferences) => preferences && Object.values(preferences).some((v) => Number.isFinite(v));

export function computeCategoryWeight(taskCategory = "", preferences = {}) {
  const normalized = taskCategory ? String(taskCategory).toLowerCase() : DEFAULT_CATEGORY;
  const usePreferences = hasPreferences(preferences);

  // Map the category to its internal category equivalent for weight lookup
  const internalCategory =
    Object.keys(CATEGORY_TO_LIFECYCLE).find((c) => CATEGORY_TO_LIFECYCLE[c] === normalized) || normalized;
  const lifecycleCategory = mapCategoryToLifecycle(internalCategory);

  let weight;
  if (usePreferences && preferences && preferences[lifecycleCategory] != null) {
    weight = preferenceToFactor(preferences[lifecycleCategory]);
  } else {
    weight = CATEGORY_WEIGHTS[internalCategory] ?? CATEGORY_WEIGHTS[DEFAULT_CATEGORY];
  }

  return weight;
}

// computeCategoryWeight: get weight for a task's category, using user preferences when available

export function normalizeCategory(category = "") {
  if (!category || typeof category !== "string" || !category.trim()) return "uncategorized";
  return String(category).toLowerCase();
}

// normalizeCategory: normalize category to lowercase string (fall back to 'uncategorized')

export function getCategoryBlueprints() {
  return CATEGORY_BLUEPRINTS.map(({ category, weight }) => ({ category, weight }));
}

export function describeCategoryWeight(category = "", preferences = {}) {
  const normalized = normalizeCategory(category);
  const usePreferences = hasPreferences(preferences);
  const internalCategory =
    Object.keys(CATEGORY_TO_LIFECYCLE).find((c) => CATEGORY_TO_LIFECYCLE[c] === normalized) || normalized;
  const lifecycleCategory = mapCategoryToLifecycle(internalCategory);

  return {
    category: internalCategory,
    lifecycleCategory: lifecycleCategory,
    source: usePreferences && preferences[lifecycleCategory] != null ? "preference" : "baseline",
    preference: usePreferences ? preferences[lifecycleCategory] ?? null : null,
    weight:
      usePreferences && preferences[mapCategoryToLifecycle(internalCategory)] != null
        ? preferenceToFactor(preferences[mapCategoryToLifecycle(internalCategory)])
        : CATEGORY_WEIGHTS[internalCategory] ?? CATEGORY_WEIGHTS[DEFAULT_CATEGORY],
  };
}

// describeCategoryWeight: return per-category metadata (weight, source) helpful for explanations
