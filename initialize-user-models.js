/**
 * Initialize ML Model Files for All Users
 * 
 * Creates model files for all existing users in the database
 */

import mongoose from 'mongoose';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from './src/models/User.js';
import { env } from './src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🚀 Initializing ML Model Files for All Users\n');
console.log('='.repeat(80));

// MongoDB connection
const MONGODB_URI = env.MONGODB_URI;

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
 * Initialize model for a single user by calling Python service
 * Makes a prediction to force model file creation
 */
async function initializeModelForUser(userId) {
  return new Promise((resolve, reject) => {
    const PYTHON_SERVICE_PATH = path.join(__dirname, 'src', 'predict_model', 'model_service.py');
    
    // Make a dummy prediction to force model file creation
    // This will create and persist the model file
    const dummyTask = JSON.stringify({
      motivation: 3,
      duration: 60,
      difficulty: 3,
      delta_hours: 24,
      category: 0
    });
    
    const pythonProcess = spawn('python', [PYTHON_SERVICE_PATH, 'predict', userId, dummyTask]);
    
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to initialize model for user ${userId}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse response: ${stdout}`));
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    await connectDB();

    // Get all users
    console.log('\n📋 Fetching all users from database...\n');
    const users = await User.find().select('_id username email').lean();

    if (users.length === 0) {
      console.log('⚠️  No users found in database');
      return;
    }

    console.log(`Found ${users.length} users:\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username || 'Unknown'} (${user._id})`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('🔧 Creating model files for all users...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      const username = user.username || user.email || 'Unknown';
      try {
        process.stdout.write(`Initializing model for ${username}... `);
        await initializeModelForUser(user._id.toString());
        console.log('✅');
        successCount++;
      } catch (error) {
        console.log('❌');
        console.error(`   Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total users: ${users.length}`);
    console.log(`✅ Successfully initialized: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);

    if (successCount > 0) {
      console.log('\n📁 Model files created in: src/predict_model/user_models/');
      console.log('   File pattern: model_{userId}.pkl');
      console.log('\nExample files:');
      users.slice(0, 3).forEach(user => {
        console.log(`   - model_${user._id}.pkl (${user.username || user.email})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('📖 WHEN ARE MODEL FILES AUTOMATICALLY CREATED?');
    console.log('='.repeat(80));
    console.log(`
1️⃣  When a user creates or updates a task:
   - Task.save() triggers pre-save hook
   - Hook calls predictTask(task)
   - Python service creates model_{userId}.pkl if it doesn't exist
   - Initial predictions are uncertain (low confidence)

2️⃣  When a user completes a task:
   - POST /api/tasks/:id/complete endpoint called
   - trainTask(task) is invoked (when Step 6 is implemented)
   - Python service loads/creates model_{userId}.pkl
   - Model learns from completion data

3️⃣  Manual initialization (this script):
   - Run this script to pre-create all model files
   - Useful for database migrations or bulk setup
   - Files start with default LinUCB parameters

📝 MODEL FILE LIFECYCLE:
   • Created: First prediction or training call for that user
   • Updated: Every time trainTask() is called (after task completion)
   • Persisted: Automatically saved to disk after each update
   • Isolated: Each user has completely independent model file
   • Size: ~13-15 KB per user (contains LinUCB parameters)

💡 BEST PRACTICE:
   Let model files be created lazily (on-demand) as users create tasks.
   This script is useful only if you want to pre-initialize all users
   or verify the system works for existing users.
`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB\n');
  }
}

// Run
main();
