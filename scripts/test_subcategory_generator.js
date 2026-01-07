#!/usr/bin/env node
import { generateSubCategory, getSubcategoriesForCategory, getAllSubcategories } from '../src/services/ml/subcategoryGenerator.js';

// Test tasks using the 18-category system
const tasks = [
  { taskname: 'Go to the GYM', importance: 4, effort: 3, description: 'chest and biceps', priorityScore: 55.98, categories: ['workout'] },
  { taskname: 'Finish final project', importance: 5, effort: 5, description: 'final project', priorityScore: 32.9, categories: ['work_and_career'] },
  { taskname: 'Finish AI homework', importance: 4, effort: 4, description: 'Homework ex2', priorityScore: 26.7, categories: ['study_and_education'] },
  { taskname: 'Clean the house', importance: 5, effort: 2, description: 'house chores', priorityScore: 45.78, categories: ['home_and_chores'] },
  { taskname: 'Fold clothes', importance: 4, effort: 2, description: 'clothes', priorityScore: 54.88, categories: ['home_and_chores'] },
  { taskname: 'Clean 3 floors', importance: 5, effort: 3, description: 'clean 3 floors', priorityScore: 29.78, categories: ['home_and_chores'] },
  { taskname: 'Study machine learning', importance: 5, effort: 4, description: 'ML course module 3', priorityScore: 40.5, categories: ['study_and_education'] },
  { taskname: 'Practice piano', importance: 3, effort: 3, description: 'scales and arpeggios', priorityScore: 35.2, categories: ['skill_building'] },
  { taskname: 'Meditation session', importance: 4, effort: 1, description: 'morning mindfulness', priorityScore: 60.1, categories: ['mindfulness'] },
  { taskname: 'Doctor appointment', importance: 5, effort: 2, description: 'annual checkup', priorityScore: 50.0, categories: ['health'] },
  { taskname: 'Date night with Sarah', importance: 5, effort: 2, description: 'romantic dinner', priorityScore: 55.0, categories: ['relationship'] },
  { taskname: 'Team meeting prep', importance: 4, effort: 3, description: 'prepare slides for sprint review', priorityScore: 45.3, categories: ['work_and_career'] },
  { taskname: 'Write blog post', importance: 3, effort: 4, description: 'tech article about React', priorityScore: 28.5, categories: ['creative_projects'] },
  { taskname: 'Go hiking at the park', importance: 3, effort: 3, description: 'nature trail adventure', priorityScore: 38.0, categories: ['exploration'] },
  { taskname: 'Call mom', importance: 4, effort: 1, description: 'weekly family call', priorityScore: 62.0, categories: ['family'] },
  { taskname: 'Rest day - recover from workout', importance: 3, effort: 1, description: 'muscle recovery', priorityScore: 55.5, categories: ['recovery'] },
  { taskname: 'Pay electricity bill', importance: 5, effort: 1, description: 'due tomorrow', priorityScore: 70.0, categories: ['life_management'] },
  { taskname: 'Coffee with friends', importance: 3, effort: 2, description: 'catch up at local cafe', priorityScore: 42.0, categories: ['social_activity'] },
  { taskname: 'Set Q1 goals', importance: 4, effort: 3, description: 'quarterly planning', priorityScore: 38.0, categories: ['goals'] },
  { taskname: 'Daily journal', importance: 3, effort: 1, description: 'evening reflection', priorityScore: 58.0, categories: ['reflection'] },
  { taskname: 'Play video games', importance: 2, effort: 1, description: 'relax with some gaming', priorityScore: 30.0, categories: ['hobbies'] },
];

(async function run() {
  console.log("=== Subcategory Generator Test (Manual Keyword Mapping) ===\n");
  console.log("Testing subcategory assignment for various tasks:\n");
  
  let passed = 0;
  let total = tasks.length;
  
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const out = await generateSubCategory({ 
      userId: 'test-user', 
      title: t.taskname, 
      description: t.description, 
      categories: t.categories, 
      TaskModel: null 
    });
    
    console.log(`${i + 1}. "${t.taskname}"`);
    console.log(`   Category: ${t.categories[0]}`);
    console.log(`   Subcategory: ${out.label} (confidence: ${out.confidence.toFixed(2)}, source: ${out.source})`);
    console.log();
    
    // Count as passed if we got a specific subcategory (not just "General")
    if (out.label && out.source !== 'fallback') {
      passed++;
    }
  }
  
  console.log("-------------------------------------------");
  console.log(`Results: ${passed}/${total} tasks got specific subcategories\n`);
  
  // Test the helper functions
  console.log("=== Available Subcategories for 'study_and_education' ===");
  const studySubs = getSubcategoriesForCategory('study_and_education');
  console.log(studySubs.join(', '));
  
  console.log("\n=== All Categories Summary ===");
  const all = getAllSubcategories();
  for (const [cat, subs] of Object.entries(all)) {
    console.log(`${cat}: ${subs.length} subcategories`);
  }
})();
