// scripts/generateSyntheticData.js
// Create a synthetic training dataset for quick experimentation.

import fs from "fs/promises";
import path from "path";

const categories = ["work", "study", "health", "social", "finance", "household", "creative", "misc"];

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPriorities() {
  const pri = {};
  categories.forEach((cat) => {
    pri[cat] = randomInt(1, 5);
  });
  return pri;
}

function buildRecentCounts(priorities) {
  const counts = {};
  categories.forEach((cat) => {
    const priority = priorities[cat];
    const base = 3 - (priority - 3); // fewer tasks for higher priority users
    counts[cat] = Math.max(0, randomInt(0, Math.max(0, base)));
  });
  return counts;
}

function generateRecord(userId, timestamp) {
  const priorities = randomPriorities();
  const recentCounts = buildRecentCounts(priorities);
  const category = randomChoice(categories);

  const priorityScore = priorities[category];
  const existing = recentCounts[category];
  const ratio = priorityScore / (existing + 1);

  // Probability of acceptance increases with priority score and decreases with existing count
  const acceptanceProb = Math.min(0.95, Math.max(0.05, 0.15 + 0.12 * priorityScore - 0.1 * existing));
  const accepted = Math.random() < acceptanceProb;
  const timeToCreateMinutes = accepted ? randomInt(2, 90) : null;

  const tasksCreatedAfter = accepted
    ? [
        {
          taskId: `synthetic-task-${Math.random().toString(16).slice(2)}`,
          tags: [category],
          createdAt: new Date(timestamp.getTime() + randomInt(2, 90) * 60 * 1000).toISOString(),
        },
      ]
    : [];

  return {
    userId,
    timestamp: timestamp.toISOString(),
    suggestedCategory: category,
    priorities,
    recentCounts,
    accepted,
    timeToCreateMinutes,
    suggestionPayload: {
      title: `Synthetic suggestion for ${category}`,
      description: `Focus on your ${category} goals.`,
      category,
      priority: priorityScore,
      currentCount: existing,
      reason: accepted ? "High priority and low backlog" : "Consider revisiting soon",
      trackingId: `synthetic-${Math.random().toString(16).slice(2)}`,
      generatedAt: timestamp.toISOString(),
    },
    tasksCreatedAfter,
  };
}

async function main() {
  const countArg = Number(process.argv[2] ?? 500);
  const output = path.resolve(
    `data/synthetic_training_${countArg}_${Date.now()}.json`
  );

  const records = [];
  const userCount = Math.max(5, Math.round(countArg / 20));
  const userIds = Array.from({ length: userCount }, (_, i) => `synthetic-user-${i + 1}`);

  for (let i = 0; i < countArg; i++) {
    const userId = randomChoice(userIds);
    const timestamp = new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000);
    records.push(generateRecord(userId, timestamp));
  }

  await fs.writeFile(output, JSON.stringify(records, null, 2), "utf8");
  console.log(`Generated ${records.length} synthetic rows to ${output}`);
}

main().catch((err) => {
  console.error("Synthetic data generation failed:", err);
  process.exit(1);
});
