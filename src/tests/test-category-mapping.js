// Test: Task → Category → Subcategory Mapping
// Shows how task text flows through tag detection and subcategory generation

import { detectTags } from '../algorithms/priority/tagging.js';
import { generateSubCategory } from '../services/ml/subcategoryGenerator.js';

console.log('🧪 Testing Task → Category → Subcategory Mapping\n');
console.log('='.repeat(70));

// Test cases: various task descriptions
const testTasks = [
  {
    title: "Study for calculus exam",
    description: "Review chapters 5-7 and practice problems"
  },
  {
    title: "Gym workout",
    description: "Leg day - squats and deadlifts"
  },
  {
    title: "Team meeting",
    description: "Discuss Q1 project deadlines with client"
  },
  {
    title: "Learn Python",
    description: "Complete tutorial on decorators"
  },
  {
    title: "Clean the kitchen",
    description: "Wash dishes and mop floor"
  },
  {
    title: "Family dinner",
    description: "Cook pasta for the kids"
  },
  {
    title: "Morning meditation",
    description: "15 minutes breathing exercises"
  },
  {
    title: "Plan vacation",
    description: "Research hotels in Paris"
  },
  {
    title: "Journal about today",
    description: "Reflect on what went well"
  },
  {
    title: "Doctor appointment",
    description: "Annual checkup and blood work"
  },
  {
    title: "Paint landscape",
    description: "Work on canvas from last week"
  },
  {
    title: "Call mom",
    description: "Catch up on the phone"
  },
  {
    title: "Budget review",
    description: "Check expenses and update spreadsheet"
  },
  {
    title: "Read fantasy novel",
    description: "Continue reading for fun"
  },
  {
    title: "Job application",
    description: "Apply to senior developer position"
  }
];

let passCount = 0;
let totalCount = 0;

// Use async function to handle Promise from generateSubCategory
async function runTests() {
  for (let index = 0; index < testTasks.length; index++) {
    const task = testTasks[index];
    totalCount++;
    
    console.log(`\n📝 Task ${index + 1}: "${task.title}"`);
    console.log(`   Description: "${task.description}"`);
    
    // Step 1: Detect category from text
    const category = detectTags({ 
      title: task.title, 
      description: task.description 
    });
    
    console.log(`   ➡️  Category: ${category}`);
    
    // Step 2: Generate subcategory (await the promise)
    const subcategoryResult = await generateSubCategory({
      title: task.title,
      description: task.description,
      category: category
    });
    
    const subcategory = subcategoryResult?.label || null;
    
    console.log(`   ➡️  Subcategory: ${subcategory || '(none)'}`);
    if (subcategoryResult) {
      console.log(`      Source: ${subcategoryResult.source}, Confidence: ${subcategoryResult.confidence.toFixed(2)}`);
    }    
    // Validate that we got both category and subcategory
    if (category && category !== 'uncategorized' && subcategory) {
      console.log('   ✅ Successfully mapped');
      passCount++;
    } else if (category === 'uncategorized' || !subcategory) {
      console.log('   ⚠️  Default/no subcategory');
    }
    
    console.log('-'.repeat(70));
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📊 Results: ${passCount}/${totalCount} tasks fully mapped to specific categories and subcategories`);
  console.log('='.repeat(70));

  // Additional test: Show all possible categories
  console.log('\n📚 Available Categories:');
  const categories = [
    'study_and_education',
    'skill_building', 
    'workout',
    'reflection',
    'home_and_chores',
    'family',
    'life_management',
    'work_and_career',
    'creative_projects',
    'hobbies',
    'relationship',
    'goals',
    'mindfulness',
    'health',
    'social_activity',
    'recovery',
    'exploration',
    'uncategorized'
  ];

  categories.forEach(cat => {
    console.log(`  • ${cat}`);
  });

  console.log('\n✅ Test complete!');
}

// Run the async tests
runTests().catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
});
