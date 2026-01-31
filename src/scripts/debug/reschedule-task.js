// Dev script - generate and persist a plan for a task
if (process.env.NODE_ENV === 'production') {
  console.error('This script is for development only. Aborting because NODE_ENV=production.');
  process.exit(1);
}

import mongoose from 'mongoose';
import { Task } from '../../models/Task.js';
import { persistPlan, generatePlan } from '../../services/schedulingService.js';

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-scheduler');

// Find the user and task
const task = await Task.findOne({ taskname: 'Do homework' });
if (!task) {
  console.error('Task not found');
  await mongoose.connection.close();
  process.exit(1);
}

console.log('Task ID:', task._id);
console.log('User ID:', task.userId);

// Generate and persist plan
console.log('\nGenerating and persisting new schedule...');

const { plan } = await generatePlan({
  userId: task.userId,
  profile: {},
  planningHorizonDays: 14
});

console.log(`Generated ${plan.length} slots`);

// Show plan details before persisting
console.log('\nPlan slots for Do homework:');
plan
  .filter(p => p.taskId.toString() === task._id.toString())
  .forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.start.toISOString()}`);
    console.log(`   subtaskIndex: ${p.subtaskIndex}`);
  });

// Persist the plan
await persistPlan(task.userId, plan);
console.log('\n✅ Plan persisted!');

await mongoose.connection.close();