#!/usr/bin/env node
import { generateSubCategory } from '../src/services/ml/subcategoryGenerator.js';

// Synthetic test tasks covering various patterns
const syntheticTasks = [
  // Action verbs that should be stripped
  { taskname: 'Finish Machine Learning assignment', tags: ['study'], expected: 'Machine Learning' },
  { taskname: 'Complete Python project', tags: ['coding'], expected: 'Python' },
  { taskname: 'Go to the doctor', tags: ['health'], expected: 'Doctor' },
  { taskname: 'Start React tutorial', tags: ['learning'], expected: 'React Tutorial' },
  
  // Short meaningful tokens
  { taskname: 'Fix AI model bugs', tags: ['work'], expected: 'AI Model' },
  { taskname: 'Review ML paper', tags: ['research'], expected: 'ML Paper' },
  { taskname: 'Update CV for job', tags: ['career'], expected: 'CV Job' },
  
  // Low-value words should be filtered
  { taskname: 'Do laundry', tags: ['household'], expected: 'Laundry' },
  { taskname: 'Finish cooking dinner', tags: ['food'], expected: 'Cooking Dinner' },
  { taskname: 'Complete tax assignment', tags: ['finance'], expected: 'Tax' },
  
  // Compound phrases
  { taskname: 'Buy groceries for party', tags: ['shopping'], expected: 'Groceries Party' },
  { taskname: 'Schedule dentist appointment', tags: ['health'], expected: 'Dentist Appointment' },
  { taskname: 'Read Node.js documentation', tags: ['study'], expected: 'Node Documentation' },
  
  // Edge cases
  { taskname: 'Fix bug #234', tags: ['coding'], expected: 'Bug' },
  { taskname: 'Call mom', tags: ['personal'], expected: 'Mom' },
  { taskname: 'Pay electricity bill', tags: ['bills'], expected: 'Electricity Bill' },
  
  // Multi-word meaningful content
  { taskname: 'Finish Data Structures homework', tags: ['study'], expected: 'Data Structures' },
  { taskname: 'Complete React Native app', tags: ['coding'], expected: 'React Native' },
  { taskname: 'Study Quantum Physics', tags: ['education'], expected: 'Quantum Physics' },
];

async function runTests() {
  console.log('🧪 Testing Subcategory Generator with Synthetic Tasks\n');
  console.log('=' .repeat(80));
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const task of syntheticTasks) {
    const result = await generateSubCategory({
      userId: 'test-user',
      title: task.taskname,
      tags: task.tags,
      TaskModel: null,
    });
    
    const match = result.label.toLowerCase() === task.expected.toLowerCase();
    const status = match ? '✓' : '✗';
    const color = match ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    if (match) {
      passed++;
    } else {
      failed++;
      failures.push({
        task: task.taskname,
        expected: task.expected,
        actual: result.label,
      });
    }
    
    console.log(`${color}${status}${reset} "${task.taskname}"`);
    console.log(`  Expected: "${task.expected}" | Got: "${result.label}" | Confidence: ${result.confidence.toFixed(2)}`);
    console.log();
  }
  
  console.log('=' .repeat(80));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${syntheticTasks.length} tests`);
  
  if (failures.length > 0) {
    console.log('\n❌ Failed cases:');
    failures.forEach(f => {
      console.log(`  • "${f.task}"`);
      console.log(`    Expected: "${f.expected}" but got: "${f.actual}"`);
    });
  } else {
    console.log('\n🎉 All tests passed!');
  }
  
  const successRate = ((passed / syntheticTasks.length) * 100).toFixed(1);
  console.log(`\n📈 Success rate: ${successRate}%`);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
