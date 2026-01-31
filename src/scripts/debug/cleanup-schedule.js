// Destructive dev script - deletes scheduled sessions for a task
if (process.env.NODE_ENV === 'production') {
  console.error('This script is for development only. Aborting because NODE_ENV=production.');
  process.exit(1);
}

const confirmed = process.argv.includes('--confirm') || process.env.DEBUG_CONFIRM === 'true';
if (!confirmed) {
  console.error('Destructive script. Pass --confirm to actually run it, e.g. `node src/scripts/debug/cleanup-schedule.js --confirm` or set DEBUG_CONFIRM=true');
  process.exit(1);
}

import mongoose from 'mongoose';
import { TaskSchedule } from '../../models/TaskSchedule.js';
import { Task } from '../../models/Task.js';

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-scheduler');

// Find the "Do homework" task
const task = await Task.findOne({ taskname: 'Do homework' });
if (!task) {
  console.error('Task not found');
  await mongoose.connection.close();
  process.exit(1);
}

console.log('Deleting old sessions for Do homework task...');

// Delete old sessions
const result = await TaskSchedule.deleteMany({ taskId: task._id });
console.log(`Deleted ${result.deletedCount} old sessions`);

// Update task to trigger re-scheduling
console.log('Updating task to trigger re-scheduling...');
task.lastScheduled = null;
await task.save();

console.log('Done! Task is now unscheduled and ready for re-scheduling.');
console.log('Call POST /api/tasks/:id/schedule with the task ID to re-schedule.');

await mongoose.connection.close();