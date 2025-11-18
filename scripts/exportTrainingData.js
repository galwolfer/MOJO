// scripts/exportTrainingData.js
// Generate a training dataset from telemetry event logs.

import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import EventLog from "../src/models/EventLog.js";
import { User } from "../src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "../data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, `training_export_${Date.now()}.json`);

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mojo";

const SUGGESTION_SHOWN = "suggestion_shown";
const SUGGESTION_FOLLOWED = "suggestion_followed";

async function connect() {
  // Connect to Mongo using the same URI as the app
  await mongoose.connect(MONGO_URI);
}

async function disconnect() {
  // Close the DB connection to avoid hanging node processes
  await mongoose.disconnect();
}

async function fetchSuggestionEvents() {
  // Grab all suggestion events plus a lookup map of those that were followed
  const suggestionEvents = await EventLog.find({ eventType: SUGGESTION_SHOWN })
    .sort({ createdAt: 1 })
    .lean();

  const followedEvents = await EventLog.find({ eventType: SUGGESTION_FOLLOWED })
    .sort({ createdAt: 1 })
    .lean();

  const followMap = new Map();
  followedEvents.forEach((event) => {
    const trackingId = event.payload?.trackingId;
    if (!trackingId) return;
    followMap.set(trackingId, event);
  });

  return { suggestionEvents, followMap };
}

function summarizeCounts(tasks = []) {
  // Count how many tasks exist per normalized tag/category
  const counts = {};
  tasks.forEach((task) => {
    const tags = Array.isArray(task.tags) ? task.tags : [];
    tags.forEach((tag) => {
      const normalized = String(tag || "misc").toLowerCase();
      counts[normalized] = (counts[normalized] || 0) + 1;
    });
  });
  return counts;
}

async function buildDataset() {
  const { suggestionEvents, followMap } = await fetchSuggestionEvents();

  const dataset = [];

  for (const event of suggestionEvents) {
    // Pair each suggestion with the matching "followed" event, if any
    const trackingId = event.payload?.trackingId;
    const followed = trackingId ? followMap.get(trackingId) : null;
    const userId = event.userId?.toString();
    const user = userId ? await User.findById(userId, { profile: 1 }).lean() : null;
    const profilePriorities = user?.profile?.priorities || {};

    const context = event.payload || {};

    // Recent tasks help estimate category coverage before the suggestion
    const recentTaskEvent = await EventLog.find({
      userId: event.userId,
      eventType: "task_created",
      createdAt: { $lt: event.createdAt },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const recentCounts = summarizeCounts(
      recentTaskEvent.map((e) => ({
        tags: e.payload?.tags,
      }))
    );

    const createdAfterSuggestion = trackingId
      ? await EventLog.find({
          userId: event.userId,
          eventType: "task_created",
          createdAt: { $gt: event.createdAt, $lt: new Date(event.createdAt.getTime() + 1000 * 60 * 60 * 24) },
        })
          .sort({ createdAt: 1 })
          .lean()
      : [];

    const accepted = Boolean(followed);
    const timeToCreateMinutes = accepted
      ? Math.round((followed.createdAt - event.createdAt) / (1000 * 60))
      : null;

    dataset.push({
      userId,
      timestamp: event.createdAt.toISOString(),
      suggestedCategory: context.category || "unknown",
      priorities: profilePriorities,
      recentCounts,
      accepted,
      timeToCreateMinutes,
      suggestionPayload: context,
      tasksCreatedAfter: createdAfterSuggestion.map((t) => ({
        taskId: t.payload?.taskId,
        tags: t.payload?.tags,
        createdAt: t.createdAt,
      })),
    });
  }

  return dataset;
}

async function run() {
  try {
    await connect();
    const dataset = await buildDataset();
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(dataset, null, 2), "utf8");
    console.log(`Exported ${dataset.length} records to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("Failed to export training data:", error);
  } finally {
    await disconnect();
  }
}

run();
