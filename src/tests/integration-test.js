// Integration Test: Full Task Creation Flow
// Tests category detection → subcategory generation → task saving

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { Task } from '../models/Task.js';
import { generateSubCategory } from '../services/ml/subcategoryGenerator.js';
import { detectTags } from '../algorithms/priority/tagging.js';

console.log('🧪 Integration Test: Full Task Creation Flow\n');
console.log('='.repeat(70));

// Test tasks to create
const testTasks = [
  {
    title: "Complete Python assignment",
    description: "Finish homework for CS101 course",
    importance: 4,
    effort: 3,
    estimatedDuration: 120
  },
  {
    title: "Morning run",
    description: "5k run in the park",
    importance: 3,
    effort: 2,
    estimatedDuration: 30
  },
  {
    title: "Client presentation",
    description: "Present Q1 results to stakeholders",
    importance: 5,
    effort: 4,
    estimatedDuration: 90
  }
];

async function runIntegrationTest() {
  try {
    // Connect to database
    console.log('\n📡 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mojo');
    console.log('✅ Connected to MongoDB');

    // Create a test user ID
    const testUserId = new mongoose.Types.ObjectId();
    console.log(`👤 Using test user ID: ${testUserId}\n`);

    const createdTasks = [];

    // Create each task
    for (let i = 0; i < testTasks.length; i++) {
      const taskData = testTasks[i];
      console.log(`\n📝 Test ${i + 1}: "${taskData.title}"`);
      console.log('-'.repeat(70));

      // Step 1: Detect category
      const category = detectTags({
        title: taskData.title,
        description: taskData.description
      });
      console.log(`   Step 1 - Category detected: ${category}`);

      // Step 2: Generate subcategory
      const subcategoryResult = await generateSubCategory({
        title: taskData.title,
        description: taskData.description,
        category: category
      });
      console.log(`   Step 2 - Subcategory: ${subcategoryResult.label} (confidence: ${subcategoryResult.confidence.toFixed(2)})`);

      // Step 3: Create task in database
      const task = new Task({
        userId: testUserId,
        taskname: taskData.title,
        description: taskData.description,
        importance: taskData.importance,
        effort: taskData.effort,
        estimatedDuration: taskData.estimatedDuration,
        category: category,
        subCategory: subcategoryResult
      });

      await task.save();
      console.log(`   Step 3 - Task saved to DB with ID: ${task._id}`);

      // Step 4: Verify by reading back
      const savedTask = await Task.findById(task._id).lean();
      console.log(`   Step 4 - Verification:`);
      console.log(`      • Category: ${savedTask.category}`);
      console.log(`      • Subcategory: ${savedTask.subCategory?.label}`);
      console.log(`      • Is array? ${Array.isArray(savedTask.category) ? '❌ ERROR' : '✅ No'}`);

      if (savedTask.category === category && savedTask.subCategory?.label === subcategoryResult.label) {
        console.log('   ✅ Task created successfully');
        createdTasks.push(task._id);
      } else {
        console.log('   ❌ Mismatch in saved data');
      }
    }

    // Step 5: Query tasks by category
    console.log('\n\n📊 Querying tasks by category...');
    console.log('-'.repeat(70));
    
    const categories = [...new Set(testTasks.map((t, i) => 
      detectTags({ title: t.title, description: t.description })
    ))];

    for (const cat of categories) {
      const tasks = await Task.find({ 
        userId: testUserId, 
        category: cat 
      }).lean();
      
      console.log(`\n   Category: ${cat}`);
      console.log(`   Found ${tasks.length} task(s):`);
      tasks.forEach(t => {
        console.log(`      • "${t.taskname}" → ${t.subCategory?.label}`);
      });
    }

    // Cleanup
    console.log('\n\n🧹 Cleaning up test data...');
    const deleteResult = await Task.deleteMany({ _id: { $in: createdTasks } });
    console.log(`✅ Deleted ${deleteResult.deletedCount} test tasks`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Integration test complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from database');
  }
}

runIntegrationTest();
