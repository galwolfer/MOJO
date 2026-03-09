// Dev script - view scheduled sessions for a date range
if (process.env.NODE_ENV === 'production') {
  console.error('This script is for development only. Aborting because NODE_ENV=production.');
  process.exit(1);
}

import mongoose from 'mongoose';
import { TaskSchedule } from '../../models/TaskSchedule.js';
import { Task } from '../../models/Task.js';

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-scheduler');

// Query for January 28th, 2026 (example)
const start = new Date('2026-01-28T00:00:00Z');
const end = new Date('2026-01-29T00:00:00Z');

const sessions = await TaskSchedule.find({
  start: { $gte: start, $lt: end }
})
  .populate('taskId', 'taskname subTasks')
  .lean();

console.log('\n=== TaskSchedule for January 28th ===');
console.log(`Found ${sessions.length} sessions\n`);

for (const session of sessions) {
  console.log('Session:', {
    _id: session._id,
    start: session.start,
    end: session.end,
    subtaskTitle: session.subtaskTitle,
    description: session.description,
    subtaskIndex: session.subtaskIndex,
    taskId: session.taskId?._id,
    taskname: session.taskId?.taskname,
  });
  
  if (session.taskId?.subTasks && session.subtaskIndex) {
    const sortedSubTasks = [...session.taskId.subTasks].sort((a, b) => (a.index || 0) - (b.index || 0));
    const subtask = sortedSubTasks[session.subtaskIndex - 1];
    console.log('  Subtask info from task doc:', {
      index: session.subtaskIndex,
      title: subtask?.title,
      description: subtask?.description,
    });
  }
  console.log('');
}

await mongoose.connection.close();