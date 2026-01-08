/**
 * Quick ML Integration Test
 * Run: node test-ml-integration.js
 */

import { predictTask, trainTask, checkHealth } from './src/services/mlPredictionService.js';

console.log('\n🧪 Testing ML Integration\n');

// 1. Health Check
console.log('1️⃣ Health Check...');
const health = await checkHealth();
console.log('   Status:', health.healthy ? '✅ Healthy' : '❌ Unhealthy');
console.log('   Categories:', health.categories?.length);
console.log('');

// 2. Create test task
const testTask = {
  importance: 5,
  effort: 4,
  estimatedDuration: 120,
  dueDate: new Date(Date.now() + 7200000), // 2 hours from now
  category: 'work',
  subCategory: { label: 'Important Work Project' }
};

// 3. Get initial prediction
console.log('2️⃣ Initial Prediction...');
const prediction1 = await predictTask(testTask);
console.log('   Score:', prediction1.score?.toFixed(3));
console.log('   Category:', prediction1.category);
console.log('   Success:', prediction1.success ? '✅' : '❌');
console.log('');

// 4. Simulate task completion (faster than expected)
console.log('3️⃣ Training with completion data...');
const completedTask = {
  ...testTask,
  actualCompletionMinutes: 100 // Completed in 100 mins instead of 120
};

const trainResult = await trainTask(completedTask);
console.log('   Success:', trainResult.success ? '✅' : '❌');
console.log('   Reward:', trainResult.reward?.toFixed(3));
console.log('   Message:', trainResult.message);
console.log('');

// 5. Get prediction after training
console.log('4️⃣ Prediction after training...');
const prediction2 = await predictTask(testTask);
console.log('   Score:', prediction2.score?.toFixed(3));
console.log('   Category:', prediction2.category);
console.log('   Improvement:', ((prediction2.score - prediction1.score) > 0 ? '📈 +' : '📉 ') + (prediction2.score - prediction1.score).toFixed(3));
console.log('');

// 6. Test different task types
console.log('5️⃣ Testing different task types...');

const easyTask = {
  importance: 2,
  effort: 1,
  estimatedDuration: 30,
  category: 'work',
  subCategory: { label: 'Quick Email' }
};

const hardTask = {
  importance: 5,
  effort: 5,
  estimatedDuration: 240,
  dueDate: new Date(Date.now() + 3600000), // 1 hour (urgent!)
  category: 'work',
  subCategory: { label: 'Critical Deadline' }
};

const healthTask = {
  importance: 4,
  effort: 3,
  estimatedDuration: 60,
  category: 'health',
  subCategory: { label: 'Gym Workout' }
};

const easyPred = await predictTask(easyTask);
const hardPred = await predictTask(hardTask);
const healthPred = await predictTask(healthTask);

console.log('   Easy task:   score=' + easyPred.score?.toFixed(3) + ', category=' + easyPred.category);
console.log('   Hard task:   score=' + hardPred.score?.toFixed(3) + ', category=' + hardPred.category);
console.log('   Health task: score=' + healthPred.score?.toFixed(3) + ', category=' + healthPred.category);
console.log('');

console.log('✅ All tests completed!\n');
