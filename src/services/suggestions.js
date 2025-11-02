// src/services/suggestions.js
// Heuristic suggestions for new tasks based on user priorities and current backlog.

import crypto from "crypto";
import { summarizeTags, categoryForTag } from "./tagging.js";

const SUGGESTION_LIBRARY = {
  work: [
    {
      title: "Plan upcoming work sprint",
      description: "Outline key goals and deliverables for the next work cycle.",
    },
    {
      title: "Review project roadmap",
      description: "Check milestones and adjust priorities with stakeholders.",
    },
  ],
  study: [
    {
      title: "Schedule focused study session",
      description: "Block time to review notes and tackle difficult topics.",
    },
    {
      title: "Organize learning materials",
      description: "Summarize highlights from recent courses or readings.",
    },
  ],
  health: [
    {
      title: "Plan this week's workouts",
      description: "Choose activities and time slots to stay consistent.",
    },
    {
      title: "Prepare healthy meals",
      description: "Create a grocery list and meal plan for balanced nutrition.",
    },
  ],
  social: [
    {
      title: "Reach out to a friend",
      description: "Schedule a call or meet-up to stay connected.",
    },
    {
      title: "Plan a family activity",
      description: "Organize quality time with relatives or close friends.",
    },
  ],
  finance: [
    {
      title: "Review monthly budget",
      description: "Track expenses and adjust savings or investments.",
    },
    {
      title: "Handle pending bills",
      description: "List upcoming payments and schedule reminders.",
    },
  ],
  household: [
    {
      title: "Tidy living space",
      description: "Plan time to clean, declutter, or organize a room.",
    },
    {
      title: "Plan household maintenance",
      description: "List chores or repairs that need attention this week.",
    },
  ],
  creative: [
    {
      title: "Schedule creative session",
      description: "Set aside time to write, draw, or pursue a hobby project.",
    },
    {
      title: "Capture new ideas",
      description: "Brainstorm concepts for your next creative endeavor.",
    },
  ],
  misc: [
    {
      title: "Reflect on personal goals",
      description: "Journal or plan next steps for personal growth.",
    },
    {
      title: "Organize digital workspace",
      description: "Clean up files, inboxes, and reminders.",
    },
  ],
};

const CATEGORY_LABELS = {
  work: "work & projects",
  study: "studies & learning",
  health: "health & fitness",
  social: "social life",
  finance: "finances & admin",
  household: "household",
  creative: "creative projects",
  misc: "general life",
};

const DEFAULT_PRIORITY = 3;

const categories = Object.keys(SUGGESTION_LIBRARY);

export function suggestTaskFromProfile(profile = {}, tasks = []) {
  const priorities = profile?.priorities || {};
  const counts = countTasksByCategory(tasks);

  const scoredCategories = categories.map((category) => {
    const priority = Number.isFinite(priorities[category]) ? Number(priorities[category]) : DEFAULT_PRIORITY;
    const count = counts[category] ?? 0;
    const score = priority / (count + 1);
    return { category, priority, count, score };
  });

  scoredCategories.sort((a, b) => b.score - a.score || b.priority - a.priority);

  const best = scoredCategories[0];
  const library = SUGGESTION_LIBRARY[best.category] || SUGGESTION_LIBRARY.misc;
  const suggestion = library[Math.floor(Math.random() * library.length)];
  const trackingId = crypto.randomUUID();

  return {
    ...suggestion,
    category: best.category,
    priority: best.priority,
    currentCount: best.count,
    reason: buildReason(best),
    trackingId,
    generatedAt: new Date().toISOString(),
  };
}

function countTasksByCategory(tasks) {
  const counts = {};
  tasks.forEach((task) => {
    const tags = summarizeTags(task.tags);
    const categoriesForTask = new Set(tags.map((tag) => categoryForTag(tag)));
    if (!categoriesForTask.size) {
      categoriesForTask.add("misc");
    }
    categoriesForTask.forEach((category) => {
      counts[category] = (counts[category] || 0) + 1;
    });
  });
  return counts;
}

function buildReason({ category, priority, count }) {
  const label = CATEGORY_LABELS[category] || category;
  if (count === 0) {
    return `You rated ${label} at ${priority}/5, but have no tasks in that area yet.`;
  }
  return `You rated ${label} at ${priority}/5 and only track ${count} task(s) there.`;
}
