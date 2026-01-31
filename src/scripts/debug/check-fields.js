// Dev script - inspect a single TaskSchedule doc
if (process.env.NODE_ENV === 'production') {
  console.error('This script is for development only. Aborting because NODE_ENV=production.');
  process.exit(1);
}

import mongoose from 'mongoose';
import { TaskSchedule } from '../../models/TaskSchedule.js';

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-scheduler');

// Get the first session
const session = await TaskSchedule.findOne({});

console.log('\n=== First TaskSchedule document ===');
console.log(JSON.stringify(session?.toObject ? session.toObject() : session, null, 2));

await mongoose.connection.close();