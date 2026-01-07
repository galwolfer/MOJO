#!/usr/bin/env node
import { generateSubCategory } from '../src/services/ml/subcategoryGenerator.js';

// Synthetic test tasks covering various patterns
const syntheticTasks = [
  // Action verbs that should be stripped
  { taskname: 'Finish Machine Learning assignment', categories: ['study'], expected: 'Machine Learning' },
  { taskname: 'Complete Python project', categories: ['coding'], expected: 'Python' },
  { taskname: 'Go to the doctor', categories: ['health'], expected: 'Doctor' },
  { taskname: 'Start React tutorial', categories: ['learning'], expected: 'React Tutorial' },
  
  // Short meaningful tokens
  { taskname: 'Fix AI model bugs', categories: ['work'], expected: 'AI Model' },
  { taskname: 'Review ML paper', categories: ['research'], expected: 'ML Paper' },
  { taskname: 'Update CV for job', categories: ['career'], expected: 'CV Job' },
  
  // Low-value words should be filtered
  { taskname: 'Do laundry', categories: ['household'], expected: 'Laundry' },
  { taskname: 'Finish cooking dinner', categories: ['food'], expected: 'Cooking Dinner' },
  { taskname: 'Complete tax assignment', categories: ['finance'], expected: 'Tax' },
  
  // Compound phrases
  { taskname: 'Buy groceries for party', categories: ['shopping'], expected: 'Groceries Party' },
  { taskname: 'Schedule dentist appointment', categories: ['health'], expected: 'Dentist Appointment' },
  { taskname: 'Read Node.js documentation', categories: ['study'], expected: 'Node Documentation' },
  
  // Edge cases
  { taskname: 'Fix bug #234', categories: ['coding'], expected: 'Bug' },
  { taskname: 'Call mom', categories: ['personal'], expected: 'Mom' },
  { taskname: 'Pay electricity bill', categories: ['bills'], expected: 'Electricity Bill' },
  
  // Multi-word meaningful content
  { taskname: 'Finish Data Structures homework', categories: ['study'], expected: 'Data Structures' },
  { taskname: 'Complete React Native app', categories: ['coding'], expected: 'React Native' },
  { taskname: 'Study Quantum Physics', categories: ['education'], expected: 'Quantum Physics' },
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
      categories: task.categories,
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
