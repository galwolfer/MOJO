// Dev script - verify task and its scheduled sessions
if (process.env.NODE_ENV === 'production') {
  console.error('This script is for development only. Aborting because NODE_ENV=production.');
  process.exit(1);
}

import mongoose from 'mongoose';
import { Task } from '../../models/Task.js';
import { TaskSchedule } from '../../models/TaskSchedule.js';

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-scheduler');

// Check what's actually in the database now
const task = await Task.findOne({ taskname: 'Do homework' }).populate('subTasks');
console.log('\n=== Do homework task ===');
console.log('Task ID:', task._id);
console.log('Task type:', task.taskType);
console.log('Subtasks:');
task.subTasks.forEach((st, idx) => {
  console.log(`  ${idx + 1}. "${st.title}" → "${st.description}"`);
});

// Get all its scheduled sessions
const sessions = await TaskSchedule.find({ taskId: task._id }).sort('start');

console.log('\n=== All scheduled sessions for Do homework ===');
sessions.forEach((s, idx) => {
  const date = s.start.toISOString().split('T')[0];
  console.log(`${idx + 1}. ${date}`);
  console.log(`   subtaskIndex: ${s.subtaskIndex}`);
  console.log(`   subtaskTitle: "${s.subtaskTitle}"`);
  console.log(`   description: "${s.description}"`);
  if (s.subtaskIndex) {
    const subtask = task.subTasks[s.subtaskIndex - 1];
    console.log(`   → Expected: title="${subtask?.title}", desc="${subtask?.description}"`);
  }
});

await mongoose.connection.close();