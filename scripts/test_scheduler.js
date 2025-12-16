// scripts/test_scheduler.js
// Quick harness to validate leaky chunks, 10-min increments, and inter-chunk gaps.

import { planTasksCSP } from "../src/algorithms/csp/scheduler.js";

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

// Sample tasks
const tasks = [
  {
    _id: "t1",
    taskname: "Cook the dinner",
    taskType: "leaky",
    estimatedDuration: 300, // 5 hours total
    minMinutes: 45,
    maxMinutes: 90,
    dueDate: isoDaysFromNow(3),
    canSplit: true,
    priorityScore: 10,
  },
  {
    _id: "t2",
    taskname: "Study Algorithms",
    taskType: "leaky",
    estimatedDuration: 180, // 3 hours
    minMinutes: 60,
    maxMinutes: 120,
    dueDate: isoDaysFromNow(5),
    canSplit: true,
    priorityScore: 5,
  },
  {
    _id: "t3",
    taskname: "One-shot task",
    taskType: "perfect",
    estimatedDuration: 50,
    dueDate: isoDaysFromNow(2),
    canSplit: false,
    priorityScore: 7,
  },
];

const options = {
  planningHorizonDays: 7,
  busyBlocksByDate: {},
  workingHours: { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0 },
  dailyCapMinutes: 240,
};

function minutesBetween(a, b) {
  return Math.round((b - a) / 60000);
}

function validate(plan) {
  const byTaskByDay = new Map();
  for (const p of plan) {
    const key = `${p.taskId}|${p.date}`;
    if (!byTaskByDay.has(key)) byTaskByDay.set(key, []);
    byTaskByDay.get(key).push(p);
  }

  const errors = [];

  for (const [key, slots] of byTaskByDay) {
    slots.sort((a, b) => a.start - b.start);

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      // Check chunk minutes are multiples of 10
      if (s.minutes % 10 !== 0) {
        errors.push(`Not 10-min multiple: ${s.taskId} at ${s.start.toISOString()} = ${s.minutes}m`);
      }
      // If leaky, check bounds based on task
      const task = tasks.find((t) => t._id === s.taskId);
      if (task?.taskType === "leaky") {
        const min = Math.ceil((task.minMinutes || 60) / 10) * 10;
        const max = Math.floor((task.maxMinutes || min) / 10) * 10;
        if (s.minutes < min || s.minutes > max) {
          errors.push(`Out of bounds: ${task.taskname} chunk ${s.minutes} not in [${min},${max}]`);
        }
      }

      // Check gap to next slot (same task, same day)
      if (i + 1 < slots.length) {
        const next = slots[i + 1];
        const gap = minutesBetween(s.end, next.start);
        if (gap < 10) {
          errors.push(`Gap < 10m between chunks for ${s.taskId} on ${s.date}: ${gap}m`);
        }
        if (gap % 10 !== 0) {
          errors.push(`Gap not 10-min multiple for ${s.taskId} on ${s.date}: ${gap}m`);
        }
      }
    }
  }

  return errors;
}

(async () => {
  const { plan, unscheduled } = planTasksCSP(tasks, options);

  console.log("\n=== PLAN ===");
  for (const p of plan) {
    console.log(
      `${p.date} | ${p.title.padEnd(18)} | ${p.start.toTimeString().slice(0,5)}-${p.end.toTimeString().slice(0,5)} | ${p.minutes}m`
    );
  }

  console.log("\n=== UNSCHEDULED ===");
  if (!unscheduled.length) console.log("(none)");
  for (const u of unscheduled) {
    console.log(`${u.title}: ${u.remainingMinutes}m remaining`);
  }

  // Validate constraints
  const errs = validate(plan);
  console.log("\n=== VALIDATION ===");
  if (errs.length === 0) {
    console.log("All checks passed ✅");
  } else {
    for (const e of errs) console.log("- ", e);
  }
})();
