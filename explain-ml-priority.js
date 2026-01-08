/**
 * ML Priority Influence Breakdown Tool
 * 
 * Shows step-by-step how ML predictions affect priority scores
 */

import { scoreActivities } from './src/algorithms/priority/priority.js';

console.log('\n🔬 ML Priority Influence Breakdown\n');
console.log('='.repeat(80));

// Helper to calculate score components manually for explanation
function explainScore(task) {
  const now = new Date();
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const norm = (x, lo, hi) => (x - lo) / (hi - lo);
  
  // Calculate urgency
  let U = 0;
  if (task.deadline) {
    const ms = new Date(task.deadline) - now;
    if (ms <= 0) {
      U = 1;
    } else {
      const horizon = 7 * 24 * 3600 * 1000; // 7 days
      U = clamp(1 - ms / horizon, 0, 1);
    }
  }
  
  // Other components
  const I = norm(task.importance || 3, 1, 5);
  const E = norm(task.effort || 3, 1, 5);
  const C = 1; // Assuming good context
  const S = 0.2; // Non-recurring
  const V = 0.3; // Diversity bonus
  
  // ML components
  const ML_confidence = task.predictionScore ?? 0.5;
  const ML_category = task.predictedCompletionCategory ?? 3;
  
  const categoryWeight = {
    1: 0.15, 2: 0.10, 3: 0.05, 4: 0.02, 5: 0.00
  };
  
  const ML_weight = categoryWeight[ML_category] || 0.05;
  const ML_component = ML_confidence * ML_weight;
  
  // Score WITHOUT ML
  const scoreWithoutML = clamp(100 * (0.30 * U + 0.25 * I + 0.15 * C + 0.10 * S + 0.05 * V - 0.20 * E), 0, 100);
  
  // Score WITH ML
  const scoreWithML = clamp(100 * (0.30 * U + 0.25 * I + 0.15 * C + 0.10 * S + ML_component + 0.05 * V - 0.20 * E), 0, 100);
  
  return {
    U, I, E, C, S, V,
    ML_confidence,
    ML_category,
    ML_weight,
    ML_component,
    scoreWithoutML,
    scoreWithML,
    mlBoost: scoreWithML - scoreWithoutML,
  };
}

// Test tasks with different ML predictions
const testTasks = [
  {
    id: '1',
    title: 'High Confidence Task',
    status: 'open',
    importance: 3,
    effort: 3,
    duration_min: 60,
    deadline: new Date(Date.now() + 86400000), // tomorrow
    category: 'work',
    predictionScore: 0.90,
    predictedCompletionCategory: 1,
  },
  {
    id: '2',
    title: 'Medium Confidence Task',
    status: 'open',
    importance: 3,
    effort: 3,
    duration_min: 60,
    deadline: new Date(Date.now() + 86400000),
    category: 'work',
    predictionScore: 0.65,
    predictedCompletionCategory: 2,
  },
  {
    id: '3',
    title: 'Low Confidence Task',
    status: 'open',
    importance: 3,
    effort: 3,
    duration_min: 60,
    deadline: new Date(Date.now() + 86400000),
    category: 'work',
    predictionScore: 0.40,
    predictedCompletionCategory: 4,
  },
  {
    id: '4',
    title: 'Very Uncertain Task',
    status: 'open',
    importance: 3,
    effort: 3,
    duration_min: 60,
    deadline: new Date(Date.now() + 86400000),
    category: 'work',
    predictionScore: 0.25,
    predictedCompletionCategory: 5,
  },
  {
    id: '5',
    title: 'No ML Prediction (Legacy)',
    status: 'open',
    importance: 3,
    effort: 3,
    duration_min: 60,
    deadline: new Date(Date.now() + 86400000),
    category: 'work',
    // No predictions
  },
];

console.log('\n📊 DETAILED BREAKDOWN FOR EACH TASK\n');

testTasks.forEach((task, index) => {
  const breakdown = explainScore(task);
  
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Task ${index + 1}: ${task.title}`);
  console.log(`${'─'.repeat(80)}`);
  
  console.log('\n1️⃣  BASE COMPONENTS (without ML):');
  console.log(`   Urgency (U):        ${(breakdown.U * 100).toFixed(1)}% × 0.30 weight = ${(breakdown.U * 30).toFixed(2)} points`);
  console.log(`   Importance (I):     ${(breakdown.I * 100).toFixed(1)}% × 0.25 weight = ${(breakdown.I * 25).toFixed(2)} points`);
  console.log(`   Context Fit (C):    ${(breakdown.C * 100).toFixed(1)}% × 0.15 weight = ${(breakdown.C * 15).toFixed(2)} points`);
  console.log(`   Streak (S):         ${(breakdown.S * 100).toFixed(1)}% × 0.10 weight = ${(breakdown.S * 10).toFixed(2)} points`);
  console.log(`   Diversity (V):      ${(breakdown.V * 100).toFixed(1)}% × 0.05 weight = ${(breakdown.V * 5).toFixed(2)} points`);
  console.log(`   Effort Penalty (E): ${(breakdown.E * 100).toFixed(1)}% × -0.20 weight = ${(breakdown.E * -20).toFixed(2)} points`);
  
  console.log(`\n   📍 Score WITHOUT ML: ${breakdown.scoreWithoutML.toFixed(2)} points`);
  
  console.log('\n2️⃣  ML COMPONENT:');
  console.log(`   ML Confidence:      ${(breakdown.ML_confidence * 100).toFixed(1)}% (predictionScore)`);
  console.log(`   ML Category:        ${breakdown.ML_category} (predictedCompletionCategory)`);
  console.log(`   Category Weight:    ${(breakdown.ML_weight * 100).toFixed(1)}% (how much to trust ML)`);
  console.log(`   ML Component:       ${(breakdown.ML_confidence * 100).toFixed(1)}% × ${(breakdown.ML_weight * 100).toFixed(1)}% = ${(breakdown.ML_component * 100).toFixed(2)} points`);
  
  console.log(`\n   📍 Score WITH ML: ${breakdown.scoreWithML.toFixed(2)} points`);
  
  console.log(`\n3️⃣  ML INFLUENCE:`);
  if (breakdown.mlBoost > 0) {
    console.log(`   🚀 ML BOOST: +${breakdown.mlBoost.toFixed(2)} points (${((breakdown.mlBoost / breakdown.scoreWithoutML) * 100).toFixed(1)}% increase)`);
  } else {
    console.log(`   ➡️  No boost (neutral ML or category 5)`);
  }
  
  if (task.predictionScore && task.predictedCompletionCategory) {
    const trustLevel = ['ignored', 'barely used', 'minimal', 'moderate', 'high'][Math.min(4, Math.floor(breakdown.ML_weight / 0.04))];
    console.log(`   📊 Trust Level: ${trustLevel}`);
  }
});

console.log(`\n\n${'='.repeat(80)}`);
console.log('📚 HOW ML CATEGORY DETERMINES TRUST LEVEL');
console.log(`${'='.repeat(80)}\n`);

console.log('The model\'s predicted category controls how much we trust its confidence:\n');

const examples = [
  { cat: 1, weight: 0.15, trust: 'HIGH', desc: 'Model is very confident → trust it a lot' },
  { cat: 2, weight: 0.10, trust: 'MODERATE', desc: 'Model is somewhat confident → moderate trust' },
  { cat: 3, weight: 0.05, trust: 'MINIMAL', desc: 'Model is neutral → minimal influence' },
  { cat: 4, weight: 0.02, trust: 'BARELY', desc: 'Model is uncertain → barely use it' },
  { cat: 5, weight: 0.00, trust: 'IGNORED', desc: 'Model has no idea → ignore completely' },
];

examples.forEach(ex => {
  console.log(`Category ${ex.cat}: Weight = ${(ex.weight * 100).toFixed(0)}% | Trust: ${ex.trust.padEnd(8)} | ${ex.desc}`);
});

console.log('\n💡 KEY INSIGHT:');
console.log('   If predictionScore = 0.80 (80% confidence):');
console.log(`   • Category 1 → 0.80 × 15% = 12 point boost  (significant!)`);
console.log(`   • Category 2 → 0.80 × 10% = 8 point boost   (moderate)`);
console.log(`   • Category 3 → 0.80 × 5%  = 4 point boost   (small)`);
console.log(`   • Category 4 → 0.80 × 2%  = 1.6 point boost (tiny)`);
console.log(`   • Category 5 → 0.80 × 0%  = 0 point boost   (none)`);

console.log(`\n\n${'='.repeat(80)}`);
console.log('🎯 REAL PRIORITY RANKING (with ML)');
console.log(`${'='.repeat(80)}\n`);

const result = scoreActivities(testTasks);

result.queue.forEach((task, index) => {
  const breakdown = explainScore(testTasks.find(t => t.id === task.activityId));
  console.log(`${index + 1}. ${task.title}`);
  console.log(`   Final Score: ${task.score.toFixed(2)} (ML boost: ${breakdown.mlBoost > 0 ? '+' + breakdown.mlBoost.toFixed(2) : '0.00'})`);
  console.log(`   Reason: ${task.reason}`);
  console.log('');
});

console.log(`${'='.repeat(80)}`);
console.log('✅ Analysis Complete!\n');
