/**
 * ML Input Converter Utilities
 * 
 * Converts Task objects to ML model input format and handles
 * feature engineering for the LinUCB model
 */

// Standard 6 categories used by the ML model
// Must match categories expected by multi_feature_linucb.py
const ML_CATEGORIES = {
  WORK: 0,
  PERSONAL: 1,
  HEALTH: 2,
  LEARNING: 3,
  HOME: 4,
  OTHER: 5,
};

// Reverse mapping for readability
const CATEGORY_NAMES = {
  0: 'WORK',
  1: 'PERSONAL',
  2: 'HEALTH',
  3: 'LEARNING',
  4: 'HOME',
  5: 'OTHER',
};

/**
 * Normalize subCategory label and tags to standard ML category (0-5)
 * 
 * @param {string} subCategoryLabel - The subCategory.label from Task model
 * @param {string[]} tags - Array of tags from Task model
 * @returns {number} Normalized category 0-5
 */
function categoryNormalizer(subCategoryLabel = '', tags = []) {
  const label = (subCategoryLabel || '').toLowerCase().trim();
  const allText = [label, ...tags.map(t => (t || '').toLowerCase())].join(' ');

  // Check for category-specific keywords
  if (allText.match(/work|career|project|meeting|deadline|professional|job|office|business/i)) {
    return ML_CATEGORIES.WORK;
  }
  if (allText.match(/personal|family|social|friend|relationship|travel|hobby|entertainment|fun/i)) {
    return ML_CATEGORIES.PERSONAL;
  }
  if (allText.match(/health|fitness|exercise|medical|doctor|diet|sleep|gym|wellness|sport/i)) {
    return ML_CATEGORIES.HEALTH;
  }
  if (allText.match(/learning|course|study|education|reading|skill|tutorial|lecture|training/i)) {
    return ML_CATEGORIES.LEARNING;
  }
  if (allText.match(/home|house|cleaning|cooking|repair|garden|chore|domestic|household|kitchen/i)) {
    return ML_CATEGORIES.HOME;
  }

  // Default to OTHER
  return ML_CATEGORIES.OTHER;
}

/**
 * Convert Task object to ML model input format
 * 
 * Maps Task fields to the 6 features expected by multi_feature_linucb.py:
 * 1. motivation (1-5, from importance field)
 * 2. duration (estimated minutes)
 * 3. difficulty (1-5, from effort field)
 * 4. delta_hours (time until dueDate in hours, 0 if no deadline)
 * 5. category (0-5, normalized from subCategory + tags)
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
  const tags = task.tags || [];

  // Calculate delta_hours: time remaining until deadline in hours
  // If no deadline, use 0 (will be handled by model)
  let deltaHours = 0;
  if (dueDate) {
    const now = new Date();
    const diffMs = new Date(dueDate) - now;
    deltaHours = Math.max(0, diffMs / 3600000); // Convert ms to hours, floor at 0
  }

  // Normalize category to 0-5
  const category = categoryNormalizer(subCategoryLabel, tags);

  return {
    motivation: importance,           // 1-5: user's importance rating
    duration: estimatedDuration,      // minutes: user's estimated time
    difficulty: effort,               // 1-5: user's effort estimate
    delta_hours: deltaHours,          // hours: time until deadline
    category: category,               // 0-5: normalized category
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
