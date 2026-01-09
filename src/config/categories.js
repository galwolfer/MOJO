/**
 * @fileoverview Centralized Categories Configuration
 * @module config/categories
 *
 * Single source of truth for all 18 task categories.
 * Used across the entire server for task categorization, validation, and ML features.
 *
 * This ensures consistency when referring to categories throughout the system:
 * - Task schema validation
 * - ML model features (one-hot encoding)
 * - Category normalization
 * - Type checking
 */

/**
 * The 18 standard categories used throughout the system
 * Each category is immutable and has a consistent index (0-17)
 *
 * @constant {Object}
 */
const CATEGORIES = {
  STUDY_AND_EDUCATION: 0,
  SKILL_BUILDING: 1,
  WORKOUT: 2,
  REFLECTION: 3,
  HOME_AND_CHORES: 4,
  FAMILY: 5,
  LIFE_MANAGEMENT: 6,
  WORK_AND_CAREER: 7,
  CREATIVE_PROJECTS: 8,
  HOBBIES: 9,
  RELATIONSHIP: 10,
  GOALS: 11,
  MINDFULNESS: 12,
  HEALTH: 13,
  SOCIAL_ACTIVITY: 14,
  RECOVERY: 15,
  EXPLORATION: 16,
  UNCATEGORIZED: 17,
};

/**
 * Reverse mapping: index -> category key
 * Useful for converting ML model outputs back to readable category names
 *
 * @constant {Object}
 */
const CATEGORY_INDEX_TO_KEY = {
  0: "study_and_education",
  1: "skill_building",
  2: "workout",
  3: "reflection",
  4: "home_and_chores",
  5: "family",
  6: "life_management",
  7: "work_and_career",
  8: "creative_projects",
  9: "hobbies",
  10: "relationship",
  11: "goals",
  12: "mindfulness",
  13: "health",
  14: "social_activity",
  15: "recovery",
  16: "exploration",
  17: "uncategorized",
};

/**
 * Display names for each category
 * Human-readable labels suitable for UI and logging
 *
 * @constant {Object}
 */
const CATEGORY_DISPLAY_NAMES = {
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
  recovery: "Recovery",
  exploration: "Exploration",
  uncategorized: "Uncategorized",
};

/**
 * Valid string representations for each category
 * Used for schema validation and user input normalization
 *
 * @constant {Object}
 */
const CATEGORY_STRING_VALUES = [
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

/**
 * Get the numeric index for a category by its string key
 *
 * @param {string} categoryKey - The category key (e.g., 'study_and_education')
 * @returns {number} The numeric index (0-17)
 * @throws {Error} If the category is not found
 */
function getCategoryIndex(categoryKey) {
  const key = (categoryKey || "").toLowerCase().trim();
  const index = CATEGORIES[key.toUpperCase().replace(/-/g, "_")];
  if (index === undefined) {
    throw new Error(`Invalid category: ${categoryKey}. Valid categories are: ${Object.keys(CATEGORIES).join(", ")}`);
  }
  return index;
}

/**
 * Get the string key for a category by its numeric index
 *
 * @param {number} index - The numeric index (0-17)
 * @returns {string} The category key (e.g., 'study_and_education')
 * @throws {Error} If the index is out of range
 */
function getCategoryKey(index) {
  if (index < 0 || index > 17 || !Number.isInteger(index)) {
    throw new Error(`Invalid category index: ${index}. Must be an integer between 0 and 17.`);
  }
  return CATEGORY_INDEX_TO_KEY[index];
}

/**
 * Get the display name for a category
 *
 * @param {string|number} category - Either a category key or index
 * @returns {string} The human-readable display name
 */
function getDisplayName(category) {
  const key = typeof category === "number" ? getCategoryKey(category) : category;
  return CATEGORY_DISPLAY_NAMES[key] || "Unknown";
}

/**
 * Validate if a string is a valid category
 *
 * @param {string} categoryValue - The category string to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidCategory(categoryValue) {
  return CATEGORY_STRING_VALUES.includes((categoryValue || "").toLowerCase().trim());
}

/**
 * Get all categories as an array of indices
 *
 * @returns {number[]} Array [0, 1, 2, ..., 17]
 */
function getAllCategoryIndices() {
  return Array.from({ length: 18 }, (_, i) => i);
}

/**
 * Get all categories as an array of keys
 *
 * @returns {string[]} Array of category keys
 */
function getAllCategoryKeys() {
  return CATEGORY_STRING_VALUES;
}

export {
  CATEGORIES,
  CATEGORY_INDEX_TO_KEY,
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_STRING_VALUES,
  getCategoryIndex,
  getCategoryKey,
  getDisplayName,
  isValidCategory,
  getAllCategoryIndices,
  getAllCategoryKeys,
};
