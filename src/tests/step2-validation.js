/**
 * Step 2 Validation: ML Input Converter Tests
 * 
 * Validates the mlInputConverter utilities work correctly:
 * - taskToMLInput() converts Task to {motivation, duration, difficulty, delta_hours, category}
 * - categoryNormalizer() properly maps subCategories and tags to 0-5 range
 * - calculateReward() produces correct 0-1 confidence scores
 */

import { taskToMLInput, categoryNormalizer, calculateReward, ML_CATEGORIES } from '../utils/mlInputConverter.js';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    testsFailed++;
  } else {
    console.log(`✅ PASSED: ${message}`);
    testsPassed++;
  }
}

console.log('\n🧪 Step 2 Validation: ML Input Converter\n');

// ============================================================================
// Test Suite 1: categoryNormalizer
// ============================================================================
console.log('📋 Test Suite 1: categoryNormalizer()\n');

assert(
  categoryNormalizer('', []) === ML_CATEGORIES.OTHER,
  'Empty input defaults to OTHER (5)'
);

assert(
  categoryNormalizer('Work Project', []) === ML_CATEGORIES.WORK,
  'Detects WORK category from label'
);

assert(
  categoryNormalizer('', ['work', 'meeting']) === ML_CATEGORIES.WORK,
  'Detects WORK category from tags'
);

assert(
  categoryNormalizer('Fitness', ['health']) === ML_CATEGORIES.HEALTH,
  'Detects HEALTH category (multiple sources)'
);

assert(
  categoryNormalizer('Personal Travel', ['vacation']) === ML_CATEGORIES.PERSONAL,
  'Detects PERSONAL category'
);

assert(
  categoryNormalizer('Python Course', ['education']) === ML_CATEGORIES.LEARNING,
  'Detects LEARNING category'
);

assert(
  categoryNormalizer('Kitchen Cleaning', ['chore']) === ML_CATEGORIES.HOME,
  'Detects HOME category'
);

assert(
  categoryNormalizer('Random Thing', []) === ML_CATEGORIES.OTHER,
  'Unknown category defaults to OTHER'
);

// ============================================================================
// Test Suite 2: taskToMLInput - Basic Fields
// ============================================================================
console.log('\n📋 Test Suite 2: taskToMLInput() - Basic Fields\n');

const basicTask = {
  importance: 4,
  effort: 3,
  estimatedDuration: 120,
  subCategory: { label: 'Work Project' },
  tags: ['urgent'],
};

const basicInput = taskToMLInput(basicTask);

assert(
  basicInput.motivation === 4,
  'motivation = importance (4)'
);

assert(
  basicInput.difficulty === 3,
  'difficulty = effort (3)'
);

assert(
  basicInput.duration === 120,
  'duration = estimatedDuration (120)'
);

assert(
  basicInput.category === ML_CATEGORIES.WORK,
  'category normalized from subCategory.label'
);

assert(
  basicInput.delta_hours === 0,
  'delta_hours = 0 when no dueDate'
);

// ============================================================================
// Test Suite 3: taskToMLInput - With Deadline
// ============================================================================
console.log('\n📋 Test Suite 3: taskToMLInput() - With Deadline\n');

const now = new Date();
const futureDate = new Date(now.getTime() + 3600000 * 2); // 2 hours from now

const taskWithDeadline = {
  importance: 5,
  effort: 5,
  estimatedDuration: 60,
  dueDate: futureDate,
  subCategory: { label: 'Urgent Work' },
  tags: [],
};

const inputWithDeadline = taskToMLInput(taskWithDeadline);

assert(
  inputWithDeadline.delta_hours >= 1.9 && inputWithDeadline.delta_hours <= 2.1,
  `delta_hours ~2 hours before deadline (actual: ${inputWithDeadline.delta_hours.toFixed(2)})`
);

// ============================================================================
// Test Suite 4: taskToMLInput - Defaults
// ============================================================================
console.log('\n📋 Test Suite 4: taskToMLInput() - Default Values\n');

const minimalTask = {
  // No fields set - all should use defaults
};

const minimalInput = taskToMLInput(minimalTask);

assert(
  minimalInput.motivation === 3,
  'importance defaults to 3'
);

assert(
  minimalInput.difficulty === 3,
  'effort defaults to 3'
);

assert(
  minimalInput.duration === 60,
  'estimatedDuration defaults to 60'
);

assert(
  minimalInput.category === ML_CATEGORIES.OTHER,
  'category defaults to OTHER (5)'
);

assert(
  minimalInput.delta_hours === 0,
  'delta_hours defaults to 0'
);

// ============================================================================
// Test Suite 5: calculateReward
// ============================================================================
console.log('\n📋 Test Suite 5: calculateReward()\n');

const perfectReward = calculateReward(60, 60);
assert(
  perfectReward > 0.99 && perfectReward <= 1.0,
  `Perfect estimate (60/60) yields reward ~1.0 (actual: ${perfectReward.toFixed(3)})`
);

const doubleReward = calculateReward(60, 120);
assert(
  doubleReward >= 0.4 && doubleReward <= 0.6,
  `2x over estimate (60/120) yields reward ~0.5 (actual: ${doubleReward.toFixed(3)})`
);

const halfReward = calculateReward(60, 30);
assert(
  halfReward >= 0.4 && halfReward <= 0.6,
  `0.5x estimate (60/30) yields reward ~0.5 (actual: ${halfReward.toFixed(3)})`
);

const fiveXReward = calculateReward(60, 300);
assert(
  fiveXReward >= 0.15 && fiveXReward <= 0.35,
  `5x over estimate (60/300) yields low reward ~0.24 (actual: ${fiveXReward.toFixed(3)})`
);

assert(
  calculateReward(0, 60) === undefined,
  'Invalid estimated (0) returns undefined'
);

assert(
  calculateReward(60, 0) === undefined,
  'Invalid actual (0) returns undefined'
);

// ============================================================================
// Test Suite 6: Real-world Example Task
// ============================================================================
console.log('\n📋 Test Suite 6: Real-world Task Example\n');

const realTask = {
  userId: 'user123',
  taskname: 'Finish project report',
  description: 'Complete the quarterly report for management',
  importance: 5,
  effort: 4,
  estimatedDuration: 180, // 3 hours
  dueDate: new Date(now.getTime() + 86400000), // tomorrow
  subCategory: { label: 'Work Report', source: 'heuristic' },
  tags: ['urgent', 'work', 'reporting'],
  status: 'todo',
};

const realInput = taskToMLInput(realTask);

assert(
  realInput.motivation === 5 &&
  realInput.difficulty === 4 &&
  realInput.duration === 180 &&
  realInput.category === ML_CATEGORIES.WORK,
  'Real task converted correctly'
);

assert(
  realInput.delta_hours >= 23.5 && realInput.delta_hours <= 24.5,
  `Real task delta_hours ~24 hours (actual: ${realInput.delta_hours.toFixed(2)})`
);

// Training simulation: assume task was completed in 240 minutes (4 hours, 33% over)
const trainingReward = calculateReward(realTask.estimatedDuration, 240);
assert(
  trainingReward >= 0.5 && trainingReward <= 0.8,
  `Task completed 33% over estimate yields reward ~0.64 (actual: ${trainingReward.toFixed(3)})`
);

// ============================================================================
// Final Summary
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log('='.repeat(70) + '\n');

const allPassed = testsFailed === 0;
process.exit(allPassed ? 0 : 1);
