/**
 * ML Input Converter Utilities
 * 
 * Converts Task objects to ML model input format and handles
 * feature engineering for the LinUCB model
 */

// Standard categories used by the ML model (expanded to 18)
// Must match categories expected by multi_feature_linucb.py
const ML_CATEGORIES = {
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

// Reverse mapping for readability (index -> canonical category key)
const CATEGORY_NAMES = {
  0: 'study_and_education',
  1: 'skill_building',
  2: 'workout',
  3: 'reflection',
  4: 'home_and_chores',
  5: 'family',
  6: 'life_management',
  7: 'work_and_career',
  8: 'creative_projects',
  9: 'hobbies',
  10: 'relationship',
  11: 'goals',
  12: 'mindfulness',
  13: 'health',
  14: 'social_activity',
  15: 'recovery',
  16: 'exploration',
  17: 'uncategorized',
};

/**
 * Normalize subCategory label and categories to standard ML category (0-17)
 * 
 * @param {string} subCategoryLabel - The subCategory.label from Task model
 * @param {string[]} categories - Array of categories from Task model
 * @returns {number} Normalized category 0-17
 */
function categoryNormalizer(subCategoryLabel = '', categories = []) {
  const label = (subCategoryLabel || '').toLowerCase().trim();
  const normalizedCategories = (Array.isArray(categories) ? categories : []).map((t) => (t || '').toLowerCase());
  const allText = [label, ...normalizedCategories].join(' ');

  // Respect explicit categories first (categories should override noisy labels)
  const tagSet = new Set(normalizedCategories);
  if (tagSet.has('health')) return ML_CATEGORIES.HEALTH;
  if (tagSet.has('workout') || tagSet.has('sports') || tagSet.has('gym')) return ML_CATEGORIES.WORKOUT;
  if (tagSet.has('study') || tagSet.has('education') || tagSet.has('course')) return ML_CATEGORIES.STUDY_AND_EDUCATION; 
  if (tagSet.has('chore') || tagSet.has('chores')) return ML_CATEGORIES.HOME_AND_CHORES;
  if (tagSet.has('work') || tagSet.has('meeting') || tagSet.has('project')) return ML_CATEGORIES.WORK_AND_CAREER; 
  if (tagSet.has('vacation') || tagSet.has('travel')) return ML_CATEGORIES.EXPLORATION;

  // Study & Education (fallback to label matching)
  if (allText.match(/study|education|course|lecture|homework|exam|assignment|reading/i)) {
    return ML_CATEGORIES.STUDY_AND_EDUCATION;
  }

  // Skill Building
  if (allText.match(/skill|skill building|skill-building|practice|tutorial/i)) {
    return ML_CATEGORIES.SKILL_BUILDING;
  }

  // Workout / exercise
  if (allText.match(/workout|exercise|gym|run|yoga|fitness|training/i)) {
    return ML_CATEGORIES.WORKOUT;
  }

  // Reflection / journaling
  if (allText.match(/reflect|reflection|journal|review|retrospective/i)) {
    return ML_CATEGORIES.REFLECTION;
  }

  // Home & chores
  if (allText.match(/home|house|clean|laundry|dishes|cook|chore|chores|repair|household|kitchen/i)) {
    return ML_CATEGORIES.HOME_AND_CHORES;
  }

  // Family
  if (allText.match(/family|kids|children|parent|birthday|anniversary|school/i)) {
    return ML_CATEGORIES.FAMILY;
  }

  // Life Management / finance
  if (allText.match(/finance|budget|tax|payment|bank|expense|bills|schedule|plan|life management/i)) {
    return ML_CATEGORIES.LIFE_MANAGEMENT;
  }

  // Work & Career
  if (allText.match(/work|career|job|office|project|meeting|deadline|professional|client|report|presentation|sprint/i)) {
    return ML_CATEGORIES.WORK_AND_CAREER;
  }

  // Creative Projects
  if (allText.match(/creative|design|paint|write|compose|draw|sketch|craft|photo|video/i)) {
    return ML_CATEGORIES.CREATIVE_PROJECTS;
  }

  // Hobbies
  if (allText.match(/hobby|hobbies|gaming|gardening|collect|knit|craft|model|board game/i)) {
    return ML_CATEGORIES.HOBBIES;
  }

  // Relationship
  if (allText.match(/relationship|date|partner|spouse|couple|romance|friend|dating/i)) {
    return ML_CATEGORIES.RELATIONSHIP;
  }

  // Goals
  if (allText.match(/goal|goals|milestone|objective|habit|target/i)) {
    return ML_CATEGORIES.GOALS;
  }

  // Mindfulness
  if (allText.match(/mindful|mindfulness|meditation|breath|breathing|awareness|calm/i)) {
    return ML_CATEGORIES.MINDFULNESS;
  }

  // Health (medical, doctor, symptoms)
  if (allText.match(/health|medical|doctor|dentist|medication|diet|sleep|wellness|symptom/i)) {
    return ML_CATEGORIES.HEALTH;
  }

  // Social activity
  if (allText.match(/social|meet|hangout|party|coffee|dinner|call|friend|network/i)) {
    return ML_CATEGORIES.SOCIAL_ACTIVITY;
  }

  // Recovery / rest / therapy
  if (allText.match(/recovery|rest|rehab|therapy|sober|recover|restor/i)) {
    return ML_CATEGORIES.RECOVERY;
  }

  // Exploration / travel / discovery
  if (allText.match(/explore|exploration|discover|trip|travel|adventure|experiment/i)) {
    return ML_CATEGORIES.EXPLORATION;
  }

  // Default to UNCATEGORIZED
  return ML_CATEGORIES.UNCATEGORIZED;
}

/**
 * Convert Task object to ML model input format
 * 
 * Maps Task fields to the 5 features expected by multi_feature_linucb.py:
 * 1. motivation (1-5, from importance field)
 * 2. duration (estimated minutes)
 * 3. difficulty (1-5, from effort field)
 * 4. delta_hours (time until dueDate in hours, 0 if no deadline)
 * 5. category (0-17, normalized from subCategory + categories)
 * 
 * @param {Object} task - MongoDB Task document with all fields
 * @returns {Object} Input object with structure {motivation, duration, difficulty, delta_hours, category}
 * @throws {Error} If required fields are missing
 */
function taskToMLInput(task) {
  if (!task) {
    throw new Error('Task object is required');
  }

  // Extract and validate required fields
  const importance = task.importance || 3; // 1-5, default 3
  const effort = task.effort || 3; // 1-5, default 3
  const estimatedDuration = task.estimatedDuration || 60; // minutes, default 60
  const dueDate = task.dueDate;
  const subCategoryLabel = task.subCategory?.label || '';
  const categories = task.categories || [];

  // Calculate delta_hours: time remaining until deadline in hours
  // If no deadline, use 0 (will be handled by model)
  let deltaHours = 0;
  if (dueDate) {
    const now = new Date();
    const diffMs = new Date(dueDate) - now;
    deltaHours = Math.max(0, diffMs / 3600000); // Convert ms to hours, floor at 0
  }

  // Normalize category to 0-17
  const category = categoryNormalizer(subCategoryLabel, categories);

  return {
    motivation: importance,           // 1-5: user's importance rating
    duration: estimatedDuration,      // minutes: user's estimated time
    difficulty: effort,               // 1-5: user's effort estimate
    delta_hours: deltaHours,          // hours: time until deadline
    category: category,               // 0-17: normalized category
  };
}

/**
 * Calculate reward signal for model training (0-1 scale)
 * 
 * Reward reflects completion accuracy:
 * - 1.0 = completed at estimated time (perfect prediction)
 * - 0.5 = took 2x or 0.5x estimated time (acceptable)
 * - 0.0 = took 5x or 0.2x estimated time (very inaccurate)
 * 
 * Formula: 1.0 / (1.0 + 2.0 * |log(actual/estimated)|)
 * This heavily penalizes large over/underestimates while rewarding accuracy
 * 
 * @param {number} estimatedMinutes - Original user estimate in minutes
 * @param {number} actualMinutes - Actual time taken in minutes
 * @returns {number} Reward signal 0-1 (undefined if inputs invalid)
 * 
 * @example
 * calculateReward(60, 60) // ~1.0 (perfect)
 * calculateReward(60, 120) // ~0.5 (2x over)
 * calculateReward(60, 30) // ~0.5 (0.5x under)
 * calculateReward(60, 300) // ~0.1 (5x over)
 */
function calculateReward(estimatedMinutes, actualMinutes) {
  // Handle invalid inputs gracefully
  if (!estimatedMinutes || !actualMinutes || estimatedMinutes <= 0 || actualMinutes <= 0) {
    return undefined; // Cannot calculate, skip training
  }

  // Ratio of actual to estimated time
  const ratio = actualMinutes / estimatedMinutes;

  // Logarithmic deviation: log(ratio) is negative if actual < estimated, positive if actual > estimated
  const logDeviation = Math.log(ratio);

  // Reward formula: penalize both over and underestimation symmetrically
  // At ratio = 1 (perfect): reward = 1.0
  // At ratio = 0.5 or 2.0: reward ≈ 0.5
  // At ratio = 0.2 or 5.0: reward ≈ 0.1
  const reward = 1.0 / (1.0 + 2.0 * Math.abs(logDeviation));

  return Math.max(0, Math.min(1, reward)); // Clamp to [0, 1]
}

export { taskToMLInput, categoryNormalizer, calculateReward, ML_CATEGORIES, CATEGORY_NAMES };
