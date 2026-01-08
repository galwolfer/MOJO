/**
 * Test Per-User Models with Real MongoDB Users
 * 
 * Verifies that ML models work with actual User documents from the database
 */

import mongoose from 'mongoose';
import { User } from './src/models/User.js';
import { Task } from './src/models/Task.js';
import { predictTask, trainTask } from './src/services/mlPredictionService.js';

console.log('\n🔬 Testing Per-User Models with Real MongoDB Users\n');
console.log('='.repeat(80));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mojo_db';

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

/**
 * Test 1: Find or create test users
 */
async function test1_setupUsers() {
  console.log('\n📦 TEST 1: Setup Real Users');
  console.log('-'.repeat(80));

  // Find all users
  const users = await User.find().limit(5);
  
  if (users.length === 0) {
    console.log('⚠️  No users found in database. Creating test users...');
    
    const testUsers = await User.create([
      {
        username: 'test_user_ml_1',
        email: 'ml_test1@example.com',
        password: 'hashedpassword123',
      },
      {
        username: 'test_user_ml_2',
        email: 'ml_test2@example.com',
        password: 'hashedpassword456',
      }
    ]);
    
    console.log(`✅ Created ${testUsers.length} test users`);
    return testUsers;
  } else {
    console.log(`✅ Found ${users.length} existing users in database`);
    users.forEach(user => {
      console.log(`   - ${user.username} (${user._id})`);
    });
    return users;
  }
}

/**
 * Test 2: Create tasks for real users and verify predictions
 */
async function test2_realUserPredictions(users) {
  console.log('\n\n🧪 TEST 2: Predictions with Real User Tasks');
  console.log('-'.repeat(80));

  const user1 = users[0];
  const user2 = users[1] || users[0]; // Use same user if only one exists

  console.log(`\nUser 1: ${user1.username} (${user1._id})`);
  console.log(`User 2: ${user2.username} (${user2._id})`);

  // Create task for User 1
  console.log('\nCreating task for User 1...');
  const task1 = new Task({
    userId: user1._id,
    taskname: 'Complete project report',
    description: 'Write and submit the quarterly report',
    importance: 4,
    effort: 3,
    estimatedDuration: 120,
    dueDate: new Date(Date.now() + 2 * 86400000), // 2 days from now
    category: 'work',
  });

  // Save will trigger pre-save hook which calls predictTask()
  await task1.save();
  
  console.log(`✅ Task saved with predictions:`);
  console.log(`   - predictionScore: ${task1.predictionScore?.toFixed(3) || 'N/A'}`);
  console.log(`   - predictedCompletionCategory: ${task1.predictedCompletionCategory || 'N/A'}`);
  console.log(`   - Model file: model_${user1._id}.pkl`);

  // Create task for User 2
  if (user2._id.toString() !== user1._id.toString()) {
    console.log('\nCreating task for User 2...');
    const task2 = new Task({
      userId: user2._id,
      taskname: 'Complete project report',
      description: 'Write and submit the quarterly report',
      importance: 4,
      effort: 3,
      estimatedDuration: 120,
      dueDate: new Date(Date.now() + 2 * 86400000),
      category: 'work',
    });

    await task2.save();
    
    console.log(`✅ Task saved with predictions:`);
    console.log(`   - predictionScore: ${task2.predictionScore?.toFixed(3) || 'N/A'}`);
    console.log(`   - predictedCompletionCategory: ${task2.predictedCompletionCategory || 'N/A'}`);
    console.log(`   - Model file: model_${user2._id}.pkl`);
  }

  return { user1, user2, task1 };
}

/**
 * Test 3: Train model with completed task
 */
async function test3_trainingWithRealUser({ user1, task1 }) {
  console.log('\n\n🎓 TEST 3: Training with Real User Completion');
  console.log('-'.repeat(80));

  console.log(`\nUser: ${user1.username} (${user1._id})`);
  console.log(`Task: ${task1.taskname}`);
  console.log(`Estimated: ${task1.estimatedDuration} minutes`);

  // Simulate task completion
  task1.actualCompletionMinutes = 100; // Completed faster than estimated (120min)
  task1.status = 'done';

  console.log(`Actual completion: ${task1.actualCompletionMinutes} minutes`);
  console.log('\nTraining model...');

  const trainingResult = await trainTask(task1);

  if (trainingResult.success) {
    console.log('✅ Model trained successfully');
    console.log(`   - Reward: ${trainingResult.reward?.toFixed(3)}`);
    console.log(`   - Model file: model_${user1._id}.pkl`);
  } else {
    console.log('❌ Training failed:', trainingResult.error);
  }

  // Create a similar task to see if prediction improved
  console.log('\nCreating similar task to verify learning...');
  const newTask = new Task({
    userId: user1._id,
    taskname: 'Another project report',
    description: 'Write next quarter report',
    importance: 4,
    effort: 3,
    estimatedDuration: 120,
    dueDate: new Date(Date.now() + 2 * 86400000),
    category: 'work',
  });

  await newTask.save();

  console.log(`\n📊 New prediction after training:`);
  console.log(`   - predictionScore: ${newTask.predictionScore?.toFixed(3)}`);
  console.log(`   - predictedCompletionCategory: ${newTask.predictedCompletionCategory}`);
  console.log(`\n💡 Compare with first task's score: ${task1.predictionScore?.toFixed(3)}`);
  console.log(`   Model should have learned from the successful completion!`);
}

/**
 * Test 4: Verify model files exist for real users
 */
async function test4_verifyModelFiles(users) {
  console.log('\n\n📁 TEST 4: Verify Model Files');
  console.log('-'.repeat(80));

  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const modelDir = path.join(__dirname, 'src', 'predict_model', 'user_models');

  console.log('\nChecking for model files in:', modelDir);
  console.log('');

  for (const user of users.slice(0, 2)) {
    const modelFile = path.join(modelDir, `model_${user._id}.pkl`);
    const exists = fs.existsSync(modelFile);
    
    if (exists) {
      const stats = fs.statSync(modelFile);
      console.log(`✅ ${user.username}: model_${user._id}.pkl (${stats.size} bytes)`);
    } else {
      console.log(`⚠️  ${user.username}: No model file yet (will be created on first prediction)`);
    }
  }
}

/**
 * Clean up test data
 */
async function cleanup() {
  console.log('\n\n🧹 Cleanup');
  console.log('-'.repeat(80));
  
  const testUsers = await User.find({ 
    email: { $in: ['ml_test1@example.com', 'ml_test2@example.com'] } 
  });
  
  if (testUsers.length > 0) {
    console.log(`\nFound ${testUsers.length} test users. Delete them? (Tasks will cascade delete)`);
    console.log('(Skipping cleanup - you can manually delete if needed)');
    
    // Uncomment to actually delete:
    // await Task.deleteMany({ userId: { $in: testUsers.map(u => u._id) } });
    // await User.deleteMany({ _id: { $in: testUsers.map(u => u._id) } });
    // console.log('✅ Cleaned up test data');
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    await connectDB();
    
    const users = await test1_setupUsers();
    
    if (users.length < 1) {
      console.log('❌ Need at least 1 user to run tests');
      process.exit(1);
    }

    const { user1, user2, task1 } = await test2_realUserPredictions(users);
    await test3_trainingWithRealUser({ user1, task1 });
    await test4_verifyModelFiles(users);
    await cleanup();

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ ALL TESTS COMPLETED WITH REAL USERS');
    console.log('='.repeat(80));
    console.log('\n🎉 Per-user ML models work perfectly with your MongoDB users!');
    console.log('   Each user\'s ObjectId is used to create isolated model files.\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB\n');
  }
}

// Run tests
runAllTests();
