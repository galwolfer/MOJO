// src/cli.js
// CLI interface for Mojo Coacher. Delegates business logic to services.

import readline from "readline";
import { connectDatabase } from "./config/database.js";
import { ansi, paint, theme } from "./utils/cliTheme.js";

// Services
import { registerUser, loginUser } from "./services/authService.js";
import { getUserById, updateRoutineSettings } from "./services/userService.js";
import { createTask, getTasksForUser, checkSuggestionFollowed, updateScheduleEntryStatus } from "./services/taskService.js";
import { generatePlan, savePlan, getUpcomingSessions } from "./services/planningService.js";
import { createBusyBlock, getUpcomingBusyBlocks } from "./services/busyBlockService.js";
import { coacherAlgorithm } from "./services/index.js";
import { suggestTaskFromProfile } from "./algorithms/priority/suggestions.js";
import { logEvent } from "./services/telemetry.js";
import { getRoutineSettings, describeRoutineWindows } from "./algorithms/binPacking/routineBlocks.js";
import { startOfDay, addDays } from "./algorithms/binPacking/calendarUtils.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const pad = (value) => String(value).padStart(2, "0");

const formatLocalDateTime = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (input) => {
  if (!DATE_ONLY_REGEX.test(input)) return null;
  const parsed = new Date(`${input}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question, { hidden = false } = {}) =>
  new Promise((resolve) => {
    if (!hidden) {
      rl.question(theme.prompt(question), resolve);
      return;
    }

    const originalWrite = rl._writeToOutput;
    rl._writeToOutput = function (stringToWrite) {
      if (rl.stdoutMuted) {
        const hasControl = /[\u0000-\u001F]/.test(stringToWrite);
        if (hasControl) {
          originalWrite.call(rl, stringToWrite);
        } else {
          originalWrite.call(rl, "*".repeat(stringToWrite.replace(/\r?\n/g, "").length));
        }
      } else {
        originalWrite.call(rl, stringToWrite);
      }
    };

    const promptText = theme.prompt(question);
    rl.stdoutMuted = false;
    rl.question(promptText, (answer) => {
      rl.stdoutMuted = false;
      rl._writeToOutput = originalWrite;
      rl.output.write("\n");
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });

let currentUser = null;
let lastSuggestion = null;
const SUGGESTION_WINDOW_MS = 30 * 60 * 1000;

const menuOptions = [
  { key: "1", label: "Register" },
  { key: "2", label: "Login" },
  { key: "3", label: "Add Task" },
  { key: "4", label: "List Tasks" },
  { key: "5", label: "Recommend Next Task" },
  { key: "6", label: "Suggest a New Task" },
  { key: "7", label: "Plan Tasks" },
  { key: "8", label: "View Schedule" },
  { key: "9", label: "Update Schedule Entry" },
  { key: "10", label: "Calendar Constraints" },
  { key: "0", label: "Exit" },
];

const preferenceQuestions = [
  { key: "work", prompt: "How central is work or your main project right now? (1=low, 5=critical): " },
  { key: "study", prompt: "How much focus do studies or learning need? (1=low, 5=critical): " },
  { key: "health", prompt: "How often do you invest in health or fitness? (1=rarely, 5=daily): " },
  { key: "social", prompt: "How important are social or family commitments? (1=low, 5=high): " },
  { key: "finance", prompt: "How urgent are finance/admin tasks? (1=chill, 5=urgent): " },
  { key: "household", prompt: "How much attention do household chores need? (1=low, 5=high): " },
  { key: "creative", prompt: "How motivated are you to pursue creative projects? (1=low, 5=high): " },
];

(async function main() {
  await connectDatabase();
  console.log(theme.success("✅ Connected to MongoDB - welcome to Mojo Coacher CLI!"));

  while (true) {
    printMenu();
    const choice = (await ask("Choose an option ➤ ")).trim();
    if (choice === "1") await register();
    else if (choice === "2") await login();
    else if (choice === "3") await addTask();
    else if (choice === "4") await listTasks();
    else if (choice === "5") await recommendTask();
    else if (choice === "6") await suggestNewTask();
    else if (choice === "7") await planTasksOption();
    else if (choice === "8") await viewScheduleOption();
    else if (choice === "9") await updateScheduleEntryOption();
    else if (choice === "10") await calendarConstraintsMenu();
    else if (choice === "0") break;
    else console.log(theme.warning("🤔 Not sure what you meant. Please pick one of the options above."));
  }

  console.log(theme.muted("\nSee you soon and stay productive!"));
  rl.close();
  process.exit(0);
})();

function printMenu() {
  console.log(theme.muted("\n═════════════════════════════════════"));
  console.log(theme.title(" Mojo Coacher — Task Companion "));
  console.log(theme.subtitle(" What would you like to do? "));
  console.log(theme.muted("═════════════════════════════════════"));
  menuOptions.forEach(({ key, label }) => {
    console.log(`${theme.option(`${key})`)} ${label}`);
  });
}

async function register() {
  const username = (await ask("username: ")).trim();
  const emailInput = (await ask("email: ")).trim();
  const password = (await ask("password: ", { hidden: true })).trim();

  if (!username || !emailInput || !password) {
    console.log(theme.warning("⚠️ Please provide username, email, and password."));
    return;
  }

  const priorities = await collectPriorities();
  const result = await registerUser({ username, email: emailInput, password, priorities });

  if (!result.success) {
    console.log(theme.error(`🚫 ${result.error}`));
    return;
  }

  console.log(theme.success("🎉 Registered successfully! You can log in now."));
}

async function login() {
  const username = (await ask("username: ")).trim();
  const password = (await ask("password: ", { hidden: true })).trim();

  const result = await loginUser({ username, password });
  if (!result.success) {
    console.log(theme.error("⛔ Invalid credentials, please try again."));
    return;
  }

  currentUser = result.user;
  console.log(theme.success(`🙌 Logged in as ${currentUser.username}`));
}

async function collectPriorities() {
  console.log(theme.subtitle("\nLet's personalize your experience (answer 1-5)."));
  const result = {};
  for (const { key, prompt } of preferenceQuestions) {
    let value = 3;
    while (true) {
      const raw = (await ask(prompt)).trim();
      if (!raw) {
        value = 3;
        break;
      }
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
        value = Math.round(parsed);
        break;
      }
      console.log(theme.warning("Please enter a number between 1 and 5."));
    }
    result[key] = value;
  }
  console.log("");
  return result;
}

async function addTask() {
  if (!ensureLoggedIn()) return;

  const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const taskname = (await ask("Task title: ")).trim();
  const description = (await ask("Short description (optional): ")).trim();
  const importance = toNumber((await ask("Importance 1–5 (default 3): ")).trim(), 3);
  const effort = toNumber((await ask("Effort 1–5 (default 3): ")).trim(), 3);
  const durationInput = (await ask("Estimated duration in minutes (default 60): ")).trim();
  const estimatedDuration = Math.max(15, toNumber(durationInput || 60, 60));
  const splitInput = (await ask("Can we split it across sessions? (Y/n, default Y): ")).trim().toLowerCase();

  let taskType = "perfect";
  let chunkCount = null;
  let chunkMinutes = estimatedDuration;
  let minMinutes = null;
  let maxMinutes = null;
  let minChunk = estimatedDuration;
  let canSplit = splitInput === "" || splitInput === "y" || splitInput === "yes";

  if (canSplit) {
    const sliderHint = " (default 2, or enter min-max for flexible time)";
    const chunkCountRaw = (await ask(`Into how many chunks would you like to split it?${sliderHint}: `)).trim();

    if (chunkCountRaw.includes("-")) {
      const [minRaw, maxRaw] = chunkCountRaw.split("-").map((f) => f.trim());
      const parsedMin = Number(minRaw);
      const parsedMax = Number(maxRaw);
      minMinutes = sanitizeMinutes(parsedMin, 15);
      maxMinutes = Math.max(minMinutes, sanitizeMinutes(parsedMax, estimatedDuration));
      taskType = "leaky";
      chunkMinutes = minMinutes;
      minChunk = minMinutes;
      canSplit = false;
    } else {
      const parsedChunks = Math.max(1, Math.round(Number(chunkCountRaw) || 2));
      chunkCount = parsedChunks;
      taskType = "in_parts";
      const baseChunk = Math.ceil(estimatedDuration / parsedChunks);
      chunkMinutes = Math.max(15, baseChunk);
      minChunk = Math.min(estimatedDuration, chunkMinutes);
    }
  }

  const dueDate = await promptTaskDueDate();

  const created = await createTask({
    userId: currentUser._id,
    taskname,
    description,
    importance,
    effort,
    estimatedDuration,
    canSplit,
    minChunk,
    taskType,
    chunkCount,
    chunkMinutes,
    minMinutes,
    maxMinutes,
    dueDate,
  });

  console.log(theme.success("✅ Task added! We'll keep its score in sync."));
  if (created.subCategory?.label) {
    const confidence = created.subCategory?.confidence;
    const confidenceLabel = Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "n/a";
    console.log(
      theme.muted(
        `Auto sub-category: ${created.subCategory.label} (${created.subCategory.source}, confidence ${confidenceLabel})`
      )
    );
  }

  if (lastSuggestion) {
    const followed = await checkSuggestionFollowed({
      userId: currentUser._id,
      task: created,
      lastSuggestion,
      windowMs: SUGGESTION_WINDOW_MS,
    });
    if (followed) lastSuggestion = null;
  }
}

async function listTasks() {
  if (!ensureLoggedIn()) return;

  const tasks = await getTasksForUser(currentUser._id);
  if (!tasks.length) {
    console.log(theme.info("📭 No tasks yet — add your first one!"));
    return;
  }

  console.log(theme.accent(`\n${currentUser.username}'s tasks:`));
  tasks.forEach((task, index) => {
    const tags = Array.isArray(task.tags) && task.tags.length ? task.tags.join(", ") : "misc";
    const subCategory = task.subCategory?.label || null;
    const displayName = task.taskname || task.title || "(no title)";
    const detailParts = [
      `importance ${task.importance}`,
      `effort ${task.effort}`,
      `score ${task.priorityScore ?? 0}`,
      `tags: ${tags}`,
    ];
    if (subCategory) detailParts.push(`sub: ${subCategory}`);
    const line = `${index + 1}. ${paint(displayName, ansi.bold)}  ${theme.muted(`(${detailParts.join(", ")})`)}`;
    console.log(line);
  });
}

async function recommendTask() {
  if (!ensureLoggedIn()) return;

  const { top, ranked = [], reasons = [] } = await coacherAlgorithm.computeFromDb(
    currentUser._id,
    currentUser.profile || {}
  );

  if (!top) {
    console.log(theme.info("🤷 Nothing to recommend right now."));
    if (reasons.length) console.log(theme.muted(`Hints: ${reasons.join(" | ")}`));
    if (!ranked.length) console.log(theme.muted("Try adding a few open tasks first."));
    return;
  }

  console.log(theme.accent("\n✨ Recommended next task"));
  console.log(`${theme.title(top.title)} - score ${paint(top.score.toFixed(2), ansi.bold, ansi.yellow)}`);
  if (top.reason) console.log(theme.muted(`Reason: ${top.reason}`));
  if (top.tags?.length) console.log(theme.muted(`Tags: ${top.tags.join(", ")}`));
  if (top.window) console.log(theme.muted(`Suggested slot: ${top.window.start} -> ${top.window.end}`));
}

async function suggestNewTask() {
  if (!ensureLoggedIn()) return;

  const freshUser = await getUserById(currentUser._id);
  if (freshUser) currentUser = freshUser;
  const profile = currentUser.profile || {};

  const tasks = await getTasksForUser(currentUser._id, { status: { $in: ["todo", "in_progress"] } });
  const suggestion = await suggestTaskFromProfile(profile, tasks);

  console.log(theme.accent("\n🆕 Suggested new task idea"));
  console.log(`${theme.title(suggestion.title)} (${suggestion.category})`);
  console.log(theme.muted(`Why: ${suggestion.reason}`));
  if (suggestion.algorithm === "logreg" && typeof suggestion.modelScore === "number") {
    console.log(theme.muted(`Model confidence: ${(suggestion.modelScore * 100).toFixed(1)}%`));
  }
  if (suggestion.description) console.log(theme.muted(`Idea: ${suggestion.description}`));
  console.log(theme.muted("Add it via option 3 to include it in your queue."));

  lastSuggestion = { ...suggestion, at: Date.now() };
  await logEvent({ type: "suggestion_shown", userId: currentUser._id, payload: suggestion });
}

async function planTasksOption() {
  if (!ensureLoggedIn()) return;

  const { plan, unscheduled, message } = await generatePlan({
    userId: currentUser._id,
    profile: currentUser.profile || {},
  });

  if (message) {
    console.log(theme.info(message));
    return;
  }

  if (!plan.length) {
    console.log(theme.warning("⚠️ Unable to schedule any tasks within the planning window."));
  } else {
    const grouped = plan.reduce((acc, entry) => {
      if (!acc[entry.date]) acc[entry.date] = [];
      acc[entry.date].push(entry);
      return acc;
    }, {});

    console.log(theme.accent("\n🗓️  Draft schedule"));
    for (const date of Object.keys(grouped).sort()) {
      console.log(theme.title(`\n${date}`));
      grouped[date]
        .sort((a, b) => a.start - b.start)
        .forEach((slot) => {
          const start = slot.start.toTimeString().slice(0, 5);
          const end = slot.end.toTimeString().slice(0, 5);
          console.log(theme.muted(`${start}–${end} (${slot.minutes} min) → ${slot.title}`));
        });
    }
  }

  if (unscheduled.length) {
    console.log(theme.warning("\n⚠️ Unscheduled tasks:"));
    unscheduled.forEach((item) => {
      console.log(theme.muted(`• ${item.title} (needs ${item.remainingMinutes} more minutes)`));
    });
  }

  try {
    await savePlan({ userId: currentUser._id, plan, unscheduled });
    console.log(theme.success("\n💾 Plan saved."));
  } catch (err) {
    console.error("Failed to save plan:", err);
  }
}

async function viewScheduleOption() {
  if (!ensureLoggedIn()) return;

  const upcoming = await getUpcomingSessions(currentUser._id);
  if (!upcoming.length) {
    console.log(theme.info("📭 No upcoming sessions found."));
    return;
  }

  console.log(theme.accent("\n🗓️  Upcoming sessions"));
  const grouped = upcoming.reduce((acc, entry) => {
    const key = formatLocalDate(entry.start);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  for (const date of Object.keys(grouped).sort()) {
    console.log(theme.title(`\n${date}`));
    grouped[date].forEach((item) => {
      const start = item.start.toTimeString().slice(0, 5);
      const end = item.end.toTimeString().slice(0, 5);
      const status = item.status;
      const title = item.taskId?.taskname || "(deleted task)";
      console.log(theme.muted(`${start}–${end} (${status}) → ${title}`));
    });
  }
}

async function updateScheduleEntryOption() {
  if (!ensureLoggedIn()) return;

  const upcoming = await getUpcomingSessions(currentUser._id, { limit: 20 });
  if (!upcoming.length) {
    console.log(theme.info("📭 No sessions available to update."));
    return;
  }

  console.log(theme.accent("\nSelect a session to update:"));
  upcoming.forEach((session, index) => {
    const start = session.start.toTimeString().slice(0, 5);
    const end = session.end.toTimeString().slice(0, 5);
    const dateLabel = formatLocalDate(session.start);
    const title = session.taskId?.taskname || "(deleted task)";
    console.log(theme.muted(`${index + 1}) ${dateLabel} ${start}-${end} (${session.status}) → ${title}`));
  });

  const choiceRaw = (await ask("Session number: ")).trim();
  const choiceIndex = Number(choiceRaw) - 1;
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= upcoming.length) {
    console.log(theme.warning("⚠️ Invalid selection."));
    return;
  }

  const session = upcoming[choiceIndex];
  const statusRaw = (await ask("New status (planned/completed/skipped): ")).trim().toLowerCase();
  if (!["planned", "completed", "skipped"].includes(statusRaw)) {
    console.log(theme.warning("⚠️ Invalid status."));
    return;
  }

  const { taskStatus } = await updateScheduleEntryStatus({
    userId: currentUser._id,
    sessionId: session._id,
    newStatus: statusRaw,
  });

  console.log(theme.success("✅ Session updated."));
  console.log(theme.muted(`Task status synced to "${taskStatus}".`));
}

const calendarMenuOptions = [
  { key: "1", label: "Add Busy Block", action: addBusyBlockOption },
  { key: "2", label: "View Busy Blocks", action: viewBusyBlocksOption },
  { key: "3", label: "Routine Busy Blocks", action: routineBlocksSettingsOption },
  { key: "0", label: "Back to main menu" },
];

async function calendarConstraintsMenu() {
  if (!ensureLoggedIn()) return;

  while (true) {
    console.log(theme.muted("\n════════ Calendar Constraints ════════"));
    calendarMenuOptions.forEach(({ key, label }) => {
      console.log(`${theme.option(`${key})`)} ${label}`);
    });
    const choice = (await ask("Choose an option ➤ ")).trim();
    if (choice === "0" || choice === "") break;
    const selected = calendarMenuOptions.find((o) => o.key === choice);
    if (!selected || !selected.action) {
      console.log(theme.warning("⚠️ Not a valid calendar option."));
      continue;
    }
    await selected.action();
  }
}

async function addBusyBlockOption() {
  if (!ensureLoggedIn()) return;

  const title = (await ask("Busy block title (optional): ")).trim();
  const parseDateTimeInput = (value) => {
    if (!value) return null;
    const normalized = value.replace(" ", "T");
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const promptDateTime = async (label) => {
    while (true) {
      const raw = (await ask(label)).trim();
      const parsed = parseDateTimeInput(raw);
      if (parsed) return parsed;
      console.log(theme.warning("⚠️ Please use the format YYYY-MM-DD HH:mm."));
    }
  };

  const start = await promptDateTime("Start (YYYY-MM-DD HH:mm): ");
  let end = null;
  while (true) {
    end = await promptDateTime("End (YYYY-MM-DD HH:mm): ");
    if (end <= start) {
      console.log(theme.warning("⚠️ End time must be after the start time."));
      continue;
    }
    break;
  }

  await createBusyBlock({ userId: currentUser._id, title, start, end });
  console.log(theme.success("✅ Busy block added."));
}

async function viewBusyBlocksOption() {
  if (!ensureLoggedIn()) return;

  const blocks = await getUpcomingBusyBlocks(currentUser._id);
  if (!blocks.length) {
    console.log(theme.info("📭 No busy blocks found."));
    return;
  }

  console.log(theme.accent("\n🗂️  Busy blocks"));
  blocks.forEach((block, index) => {
    const start = formatLocalDateTime(new Date(block.start));
    const end = formatLocalDateTime(new Date(block.end));
    const label = block.title || "(no title)";
    console.log(theme.muted(`${index + 1}) ${start} → ${end} — ${label}`));
  });
}

async function routineBlocksSettingsOption() {
  if (!ensureLoggedIn()) return;

  const profile = currentUser.profile || {};
  const routineSettings = getRoutineSettings(profile);
  const statusText = routineSettings.enabled ? theme.success("ENABLED") : theme.warning("DISABLED");
  console.log(theme.accent(`\nAutomatic routine blocks are currently ${statusText}.`));

  const descriptions = describeRoutineWindows(routineSettings.blocks);
  console.log(theme.muted("Default windows:"));
  descriptions.forEach((line) => console.log(theme.muted(` • ${line}`)));

  const answer = (await ask("Enable automatic routine busy blocks? (y/n, blank to cancel): ")).trim().toLowerCase();
  if (!answer) {
    console.log(theme.muted("No changes made."));
    return;
  }

  if (!["y", "yes", "n", "no"].includes(answer)) {
    console.log(theme.warning("⚠️ Please respond with 'y' or 'n'."));
    return;
  }

  const enabled = answer === "y" || answer === "yes";
  const payload = { enabled, blocks: routineSettings.blocks };

  const refreshed = await updateRoutineSettings(currentUser._id, payload);
  if (refreshed) currentUser = refreshed;

  const updatedText = enabled ? theme.success("enabled") : theme.warning("disabled");
  console.log(theme.info(`Routine busy blocks ${updatedText}.`));

  if (enabled) {
    console.log(theme.muted("We'll protect the following times automatically:"));
    describeRoutineWindows(payload.blocks).forEach((line) => console.log(theme.muted(` • ${line}`)));
  }
}

async function promptTaskDueDate() {
  const wantsDeadline = (await ask("Set a deadline date? (y/n, default n): ")).trim().toLowerCase();
  if (!["y", "yes"].includes(wantsDeadline)) return null;
  return chooseDeadlineWithSlider();
}

async function chooseDeadlineWithSlider() {
  const today = startOfDay(new Date());
  const maxAdvanceDays = 365;
  let offset = 0;

  console.log(theme.subtitle("\nDeadline slider active. Use +n/-n or press Enter to accept today's date."));

  while (true) {
    const selectedDate = addDays(today, offset);
    console.log(theme.muted(`Pattern: ${buildDeadlinePattern(offset, maxAdvanceDays)}`));
    console.log(theme.info(`Selected: ${formatLocalDate(selectedDate)} (+${offset} days)`));
    console.log(theme.muted("Commands: +n/-n, c=clear, Enter=confirm"));

    const commandRaw = (await ask("Command: ")).trim().toLowerCase();
    if (!commandRaw) return selectedDate;

    if (commandRaw === "c" || commandRaw === "clear") return null;

    const jumpMatch = commandRaw.match(/^([+-])(\d+)$/);
    if (jumpMatch) {
      const direction = jumpMatch[1];
      const step = Number(jumpMatch[2]);
      if (Number.isFinite(step)) {
        offset = clampOffset(offset + (direction === "+" ? step : -step), maxAdvanceDays);
        continue;
      }
    }

    console.log(theme.warning("⚠️ Use +n/-n to shift the date, c to cancel, or Enter to accept."));
  }
}

function buildDeadlinePattern(currentOffset, maxAdvanceDays) {
  const length = 11;
  const half = Math.floor(length / 2);
  const start = Math.max(0, Math.min(currentOffset - half, Math.max(0, maxAdvanceDays - length)));
  const pattern = [];
  for (let index = start; index < start + length; index++) {
    pattern.push(index === currentOffset ? "█" : "─");
  }
  return pattern.join("");
}

function clampOffset(value, maxDays) {
  return Math.max(0, Math.min(maxDays, value));
}

function sanitizeMinutes(value, fallback) {
  const MINIMUM_MINUTES = 15;
  if (Number.isFinite(value) && value > 0) return Math.max(MINIMUM_MINUTES, Math.round(value));
  if (Number.isFinite(fallback) && fallback > 0) return Math.max(MINIMUM_MINUTES, Math.round(fallback));
  return MINIMUM_MINUTES;
}

function ensureLoggedIn() {
  if (currentUser) return true;
  console.log(theme.warning("🔐 Please log in first."));
  return false;
}
