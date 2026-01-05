#!/usr/bin/env node
import { generateSubCategory } from '../src/services/ml/subcategoryGenerator.js';

const tasks = [
  { taskname: 'Go to the GYM', importance: 4, effort: 3, description: 'chest and biceps', priorityScore: 55.980912673611115, tags: ['health'] },
  { taskname: 'Finish final project', importance: 5, effort: 5, description: 'final project', priorityScore: 32.9, tags: ['work'] },
  { taskname: 'Finish AI homework', importance: 4, effort: 4, description: 'Homework ex2', priorityScore: 26.7, tags: ['study'] },
  { taskname: 'Clean the house', importance: 5, effort: 2, description: 'house chores', priorityScore: 45.7847301388889, tags: ['household'] },
  { taskname: 'Fold clothes', importance: 4, effort: 2, description: 'clothes', priorityScore: 54.882821406249995, tags: ['misc'] },
  { taskname: 'Clean 3 floors', importance: 5, effort: 3, description: 'clean 3 floors', priorityScore: 29.784730138888893, tags: ['household'] },
];

(async function run() {
  console.log("Yonatan's tasks and generated subcategories:\n");
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const out = await generateSubCategory({ userId: 'yonatan', title: t.taskname, description: t.description, tags: t.tags, TaskModel: null });
    console.log(`${i + 1}. ${t.taskname}  (importance ${t.importance}, effort ${t.effort}, description: ${JSON.stringify(t.description)}, score ${t.priorityScore}, tags: ${t.tags.join(', ')}, sub: ${out.label})`);
  }
})();
