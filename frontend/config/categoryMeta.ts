import { COLORS } from "../theme";
import { ICONS } from "../components/icons/icons";

// Try to reuse category strings and display names from the server so the UI stays in sync.
// If importing the server module is not possible in the RN bundler, fall back
// to local copies of the canonical 18 category keys and display names.
let SERVER_CATEGORY_KEYS: string[] | null = null;
let SERVER_DISPLAY_NAMES: Record<string, string> | null = null;
try {
  // use require to avoid bundler-time static resolution errors in some RN configs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serverCategories = require("../../src/config/categories.js");
  if (serverCategories && Array.isArray(serverCategories.CATEGORY_STRING_VALUES)) {
    SERVER_CATEGORY_KEYS = serverCategories.CATEGORY_STRING_VALUES;
  }
  if (
    serverCategories &&
    serverCategories.CATEGORY_DISPLAY_NAMES &&
    typeof serverCategories.CATEGORY_DISPLAY_NAMES === "object"
  ) {
    SERVER_DISPLAY_NAMES = serverCategories.CATEGORY_DISPLAY_NAMES;
  }
} catch (e) {
  // ignore - we'll fall back to the hard-coded list below
}

export const CATEGORY_KEYS = SERVER_CATEGORY_KEYS ?? [
  "study_and_education",
  "skill_building",
  "workout",
  "reflection",
  "home_and_chores",
  "family",
  "life_management",
  "work_and_career",
  "creative_projects",
  "hobbies",
  "relationship",
  "goals",
  "mindfulness",
  "health",
  "social_activity",
  "recovery",
  "exploration",
  "uncategorized",
];

const FALLBACK_DISPLAY_NAMES: Record<string, string> = {
  study_and_education: "Study & Education",
  skill_building: "Skill Building",
  workout: "Workout",
  reflection: "Reflection",
  home_and_chores: "Home & Chores",
  family: "Family",
  life_management: "Life Management",
  work_and_career: "Work & Career",
  creative_projects: "Creative Projects",
  hobbies: "Hobbies",
  relationship: "Relationship",
  goals: "Goals",
  mindfulness: "Mindfulness",
  health: "Health",
  social_activity: "Social Activity",
  exploration: "Exploration",
  recovery: "Recovery",
  uncategorized: "Uncategorized",
};

export const DISPLAY_NAMES: Record<string, string> = SERVER_DISPLAY_NAMES ?? FALLBACK_DISPLAY_NAMES;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface CategoryMeta {
  icon: keyof typeof ICONS; // icon key from `ICONS`
  color: string; // hex string taken from theme COLORS
  colorIndex?: number; // optional palette index 1..8
  displayName?: string; // optional override display name
}

// Mapping of category key -> metadata (icon + color). This is the single source
// of truth for UI rendering of categories (icon + color). Use existing icons
// from `frontend/components/icons` and colors from `frontend/theme`.
export const CATEGORY_META: Record<string, CategoryMeta> = {
  study_and_education: {
    icon: "study",
    color: COLORS.primary1,
    colorIndex: 1,
    displayName: DISPLAY_NAMES.study_and_education,
  },
  skill_building: { icon: "skills", color: COLORS.primary3, colorIndex: 3, displayName: DISPLAY_NAMES.skill_building },
  workout: { icon: "workout", color: COLORS.primary2, colorIndex: 2, displayName: DISPLAY_NAMES.workout },
  reflection: { icon: "reflection", color: COLORS.primary6, colorIndex: 6, displayName: DISPLAY_NAMES.reflection },
  home_and_chores: { icon: "home", color: COLORS.primary5, colorIndex: 5, displayName: DISPLAY_NAMES.home_and_chores },
  family: { icon: "family", color: COLORS.primary4, colorIndex: 4, displayName: DISPLAY_NAMES.family },
  life_management: {
    icon: "settings",
    color: COLORS.darkGray,
    colorIndex: 8,
    displayName: DISPLAY_NAMES.life_management,
  },
  work_and_career: { icon: "work", color: COLORS.primary1, colorIndex: 1, displayName: DISPLAY_NAMES.work_and_career },
  creative_projects: {
    icon: "creative",
    color: COLORS.primary3,
    colorIndex: 3,
    displayName: DISPLAY_NAMES.creative_projects,
  },
  hobbies: { icon: "hobbies", color: COLORS.primary3, colorIndex: 3, displayName: DISPLAY_NAMES.hobbies },
  relationship: { icon: "heart", color: COLORS.primary4, colorIndex: 4, displayName: DISPLAY_NAMES.relationship },
  goals: { icon: "goals", color: COLORS.primary6, colorIndex: 6, displayName: DISPLAY_NAMES.goals },
  mindfulness: { icon: "mindfulness", color: COLORS.primary2, colorIndex: 2, displayName: DISPLAY_NAMES.mindfulness },
  health: { icon: "health", color: COLORS.primary7, colorIndex: 7, displayName: DISPLAY_NAMES.health },
  social_activity: {
    icon: "friends",
    color: COLORS.primary4,
    colorIndex: 4,
    displayName: DISPLAY_NAMES.social_activity,
  },
  exploration: { icon: "explore", color: COLORS.primary6, colorIndex: 6, displayName: DISPLAY_NAMES.exploration },
  recovery: { icon: "repeat", color: COLORS.primary2, colorIndex: 2, displayName: DISPLAY_NAMES.recovery },
  uncategorized: { icon: "other", color: COLORS.lightGray, colorIndex: 8, displayName: DISPLAY_NAMES.uncategorized },
};

// Ensure every server category has an entry; if not, we'll use a default.
CATEGORY_KEYS.forEach((k) => {
  if (!CATEGORY_META[k]) {
    CATEGORY_META[k] = { icon: "other", color: COLORS.lightGray, displayName: DISPLAY_NAMES[k] || "Unknown" };
  }
  // Ensure a displayName exists for every entry (use server/display fallback when possible)
  if (!CATEGORY_META[k].displayName) {
    CATEGORY_META[k].displayName = DISPLAY_NAMES[k] || "Unknown";
  }
});

/**
 * Helper: returns meta for a given category key, with a safe default.
 */
export function getCategoryMeta(categoryKey?: string | null): CategoryMeta {
  if (!categoryKey) return CATEGORY_META.uncategorized;
  const key = categoryKey.toLowerCase().trim();
  return CATEGORY_META[key] || CATEGORY_META.uncategorized;
}

export default CATEGORY_META;
