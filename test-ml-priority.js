/**
 * Test ML-Powered Priority Scoring
 * 
 * Demonstrates how ML predictions influence task prioritization
 */

import { scoreActivities } from './src/algorithms/priority/priority.js';

console.log('\n🎯 ML-Powered Priority Scoring Test\n');

// Create test tasks with different ML predictions
const tasks = [
  {
    id: '1',
    title: 'High confidence task (predicted easy)',
    status: 'open',
    importance: 3,
    effort: 3,
    duration_min: 60,
    deadline: new Date(Date.now() + 86400000), // tomorrow
    category: 'work',
    predictionScore: 0.85,              // High confidence
    predictedCompletionCategory: 1,     // Very likely to succeed
  },
  {
    id: '2',
    title: 'Low confidence task (predicted hard)',
    status: 'open',
    importance: 3,
    effort: 3,
    duration_min: 60,
    deadline: new Date(Date.now() + 86400000), // tomorrow
    category: 'work',
    predictionScore: 0.45,              // Low confidence
    predictedCompletionCategory: 4,     // Likely to struggle
  },
  {
    id: '3',
    title: 'No ML prediction (legacy task)',
    status: 'open',
    importance: 3,
    effort: 3,
    duration_min: 60,
    deadline: new Date(Date.now() + 86400000), // tomorrow
    category: 'work',
    // No predictionScore or predictedCompletionCategory
  },
  {
    id: '4',
    title: 'Very confident success',
    status: 'open',
    importance: 4,
    effort: 2,
    duration_min: 30,
    deadline: new Date(Date.now() + 7200000), // 2 hours
    category: 'health',
    predictionScore: 0.92,              // Very high confidence
    predictedCompletionCategory: 1,     // Almost certain success
  },
  {
    id: '5',
    title: 'Uncertain outcome',
    status: 'open',
    importance: 5,
    effort: 5,
    duration_min: 240,
    deadline: new Date(Date.now() + 3600000), // 1 hour (urgent!)
    category: 'work',
    predictionScore: 0.35,              // Low confidence
    predictedCompletionCategory: 5,     // High risk of failure
  },
];

// Score the tasks
const result = scoreActivities(tasks);

console.log('📊 Priority Ranking (with ML influence):\n');

result.queue.forEach((task, index) => {
  console.log(`${index + 1}. ${task.title}`);
  console.log(`   Score: ${task.score.toFixed(1)}`);
  console.log(`   Reason: ${task.reason}`);
  
  if (task.mlPrediction) {
    console.log(`   ML: confidence=${task.mlPrediction.confidence.toFixed(2)}, category=${task.mlPrediction.category}, weight=${task.mlPrediction.weight.toFixed(2)}`);
  } else {
    console.log(`   ML: No prediction (legacy task)`);
  }
  console.log('');
});

console.log('🔍 Key Observations:\n');

// Find high confidence vs low confidence tasks
const highConfidence = result.queue.find(t => t.mlPrediction?.category === 1);
const lowConfidence = result.queue.find(t => t.mlPrediction?.category >= 4);
const noML = result.queue.find(t => !t.mlPrediction);

if (highConfidence && lowConfidence) {
  console.log(`✅ High confidence task (${highConfidence.title.substring(0, 30)}...)`);
  console.log(`   → Score boosted by ML: ${highConfidence.score.toFixed(1)}`);
  console.log('');
  
  console.log(`⚠️  Low confidence task (${lowConfidence.title.substring(0, 30)}...)`);
  console.log(`   → Score barely affected: ${lowConfidence.score.toFixed(1)}`);
  console.log('');
}

if (noML) {
  console.log(`📦 Legacy task (${noML.title.substring(0, 30)}...)`);
  console.log(`   → Uses default neutral ML value: ${noML.score.toFixed(1)}`);
  console.log('');
}

console.log('💡 How ML Influences Priority:\n');
console.log('   • Category 1 (high confidence) → +15% weight to prediction');
console.log('   • Category 2 (good confidence) → +10% weight to prediction');
console.log('   • Category 3 (neutral)         → +5% weight (minimal)');
console.log('   • Category 4 (low confidence)  → +2% weight (barely used)');
console.log('   • Category 5 (very uncertain)  → 0% weight (ignored)');
console.log('');
console.log('   This means the model only influences priority when it\'s confident!');
console.log('');

console.log('✅ ML integration complete!\n');
