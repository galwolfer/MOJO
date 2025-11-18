// scripts/prepareFeatures.js
// Transform exported training rows into feature/label pairs ready for modeling.

import fs from "fs/promises";
import path from "path";

function encodeCategory(category) {
  // Simple one-hot encoding over the supported categories
  return [
    category === "work" ? 1 : 0,
    category === "study" ? 1 : 0,
    category === "health" ? 1 : 0,
    category === "social" ? 1 : 0,
    category === "finance" ? 1 : 0,
    category === "household" ? 1 : 0,
    category === "creative" ? 1 : 0,
    category === "misc" ? 1 : 0,
  ];
}

function timeFeatures(timestamp) {
  // Derive lightweight temporal signals from the suggestion timestamp
  const date = new Date(timestamp);
  const hours = date.getUTCHours();
  const day = date.getUTCDay();
  return {
    hour: hours,
    isMorning: hours >= 5 && hours < 12 ? 1 : 0,
    isAfternoon: hours >= 12 && hours < 17 ? 1 : 0,
    isEvening: hours >= 17 && hours < 22 ? 1 : 0,
    isWeekend: day === 0 || day === 6 ? 1 : 0,
  };
}

function buildFeatureVector(row) {
  const category = row.suggestedCategory || "misc";
  const priorities = row.priorities || {};
  const recentCounts = row.recentCounts || {};

  const priority = Number(priorities[category] ?? 3);
  const count = Number(recentCounts[category] ?? 0);
  const ratio = priority / (count + 1);

  const tf = timeFeatures(row.timestamp);

  return [
    priority,
    count,
    ratio,
    tf.hour,
    tf.isMorning,
    tf.isAfternoon,
    tf.isEvening,
    tf.isWeekend,
    ...encodeCategory(category),
  ];
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: node scripts/prepareFeatures.js <training-export.json>");
    process.exit(1);
  }

  const resolved = path.resolve(fileArg);
  const raw = await fs.readFile(resolved, "utf8");
  // Each row is a suggestion instance exported from the telemetry store
  const rows = JSON.parse(raw);

  const dataset = rows.map((row) => ({
    features: buildFeatureVector(row),
    label: row.accepted ? 1 : 0,
    meta: {
      userId: row.userId,
      category: row.suggestedCategory || "misc",
      accepted: row.accepted,
      timeToCreateMinutes: row.timeToCreateMinutes,
    },
  }));

  const preview = dataset.slice(0, 5);
  console.log(
    JSON.stringify(
      {
        count: dataset.length,
        featureLength: dataset[0]?.features.length ?? 0,
        sample: preview,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("Failed to prepare features:", err);
  process.exit(1);
});
