// src/cli.js
// CLI interface for Mojo Coacher. Delegates business logic to services.

import readline from "readline";
import { connectDatabase } from "./config/database.js";
import { ansi, paint, theme } from "./utils/cliTheme.js";

// Utilities
import { startOfDay, addDays, formatLocalDate, formatLocalDateTime, parseDateOnly } from "./utils/dateUtils.js";
import { apiClient } from "./utils/apiClient.js";

// Services
import { getUserById, updateRoutineSettings } from "./services/authService.js";
import { registerUserApi, loginUserApi, updateUserProfileApi, sendChatMessage, resetChatSession, getChatHistory, checkChatHealth } from "./services/apiService.js";
import { 
  createTask, 
  getTasksForUser, 
  checkSuggestionFollowed, 
  updateScheduleEntryStatus, 
  updateTask,
  extendTaskDeadline as extendTaskDeadlineService,
  deleteTask as deleteTaskService,
  createBusyBlock,
  getUpcomingBusyBlocks,
  findExpiredTasksForUser
} from "./services/taskService.js";
import { generatePlan, savePlan, getUpcomingSessions, getRoutineSettings, describeRoutineWindows } from "./services/schedulingService.js";
import { coacherAlgorithm } from "./services/index.js";
import { suggestTaskFromProfile } from "./algorithms/priority/suggestions.js";
import { logEvent } from "./services/telemetryService.js";


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

// Auth token storage
let authToken = null;

// Chat session storage
let chatSessionId = null;

/**
 * Set the authentication token for API requests
 * @param {string|null} token - JWT token or null to clear
 */
function setAuthToken(token) {
  authToken = token;
  apiClient.setToken(token);
}

const menuOptions = [
  { key: "1", label: "Register", requiresAuth: false },
  { key: "2", label: "Login", requiresAuth: false },
  { key: "3", label: "Logout", requiresAuth: true },
  { key: "4", label: "Add Task", requiresAuth: true },
  { key: "5", label: "List Tasks", requiresAuth: true },
  { key: "6", label: "Edit Task", requiresAuth: true },
  { key: "7", label: "Recommend Next Task", requiresAuth: true },
  { key: "8", label: "Suggest a New Task", requiresAuth: true },
  { key: "9", label: "Plan Tasks", requiresAuth: true },
  { key: "10", label: "View Schedule", requiresAuth: true },
  { key: "11", label: "Update Schedule Entry", requiresAuth: true },
  { key: "12", label: "Calendar Constraints", requiresAuth: true },
  { key: "13", label: "💬 Chat with AI Assistant", requiresAuth: true },
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
    // Check for expired tasks before showing menu (if logged in)
    if (currentUser) {
      const hasExpired = await checkAndBlockExpiredTasks();
      if (hasExpired) {
        // User was logged out due to unhandled expired tasks
        continue;
      }
    }
    
    printMenu();
    const choice = (await ask("Choose an option ➤ ")).trim();
    if (choice === "1") await register();
    else if (choice === "2") await login();
    else if (choice === "3") await logout();
    else if (choice === "4") await addTask();
    else if (choice === "5") await listTasks();
    else if (choice === "6") await editTaskOption();
    else if (choice === "7") await recommendTask();
    else if (choice === "8") await suggestNewTask();
    else if (choice === "9") await planTasksOption();
    else if (choice === "10") await viewScheduleOption();
    else if (choice === "11") await updateScheduleEntryOption();
    else if (choice === "12") await calendarConstraintsMenu();
    else if (choice === "13") await chatWithAssistant();
    else if (choice === "0") break;
    else console.log(theme.warning("🤔 Not sure what you meant. Please pick one of the options above."));
  }

  console.log(theme.muted("\nSee you soon and stay productive!"));
  rl.close();
  process.exit(0);
})();

/**
 * Check for expired tasks and block user if any exist
 * Returns true if user was blocked/logged out
 */
async function checkAndBlockExpiredTasks() {
  if (!currentUser) return false;

  const expiredTasks = await findExpiredTasksForUser(currentUser._id);
  
  if (expiredTasks.length === 0) {
    return false;
  }

  // There are expired tasks - force user to handle them
  await handleExpiredTasks();
  
  // If user cancelled (currentUser is now null), return true to restart loop
  return currentUser === null;
}

function printMenu() {
  console.log(theme.muted("\n═════════════════════════════════════"));
  console.log(theme.title(" Mojo Coacher — Task Companion "));
  
  // Show login status
  if (currentUser) {
    console.log(theme.success(` 👤 Logged in as: ${currentUser.username} `));
  } else {
    console.log(theme.warning(" 🔒 Not logged in "));
  }
  
  console.log(theme.subtitle(" What would you like to do? "));
  console.log(theme.muted("═════════════════════════════════════"));
  
  menuOptions.forEach(({ key, label, requiresAuth }) => {
    // Show appropriate options based on login status
    if (requiresAuth === true && !currentUser) {
      // Skip auth-required options when not logged in
      return;
    }
    if (requiresAuth === false && currentUser) {
      // Skip register/login when already logged in
      return;
    }
    console.log(`${theme.option(`${key})`)} ${label}`);
  });
}

async function register() {
  console.log(theme.subtitle("\n📝 Register a new account"));
  // console.log(theme.muted("This will create your account via the backend API.\n"));

  const username = (await ask("username: ")).trim();
  const emailInput = (await ask("email: ")).trim();
  const password = (await ask("password: ", { hidden: true })).trim();

  if (!username || !emailInput || !password) {
    console.log(theme.warning("⚠️ Please provide username, email, and password."));
    return;
  }

  console.log(theme.muted("\n🔄 Sending registration request to server..."));

  const result = await registerUserApi({ username, email: emailInput, password });

  if (!result.success) {
    console.log(theme.error(`🚫 Registration failed: ${result.error}`));
    return;
  }

  console.log(theme.success("🎉 Registered successfully!"));
  console.log(theme.muted(`\nYour JWT token has been saved. You are now logged in as ${result.user.username}.`));

  // Auto-login after registration
  setAuthToken(result.token);
  currentUser = result.user;

  // Optionally collect priorities and update profile
  const wantsPriorities = (await ask("\nWould you like to set your task priorities now? (y/N): ")).trim().toLowerCase();
  if (wantsPriorities === 'y' || wantsPriorities === 'yes') {
    const priorities = await collectPriorities();
    const updateResult = await updateUserProfileApi({ priorities });
    if (updateResult.success) {
      console.log(theme.success("✅ Priorities saved!"));
    } else {
      console.log(theme.warning(`⚠️ Could not save priorities: ${updateResult.error}`));
    }
  }

  // Check for expired tasks
  await handleExpiredTasks();
}

async function login() {
  console.log(theme.subtitle("\n🔐 Login to your account"));
  console.log(theme.muted("This will authenticate via the backend API.\n"));

  const username = (await ask("username: ")).trim();
  const password = (await ask("password: ", { hidden: true })).trim();

  if (!username || !password) {
    console.log(theme.warning("⚠️ Please provide username and password."));
    return;
  }

  console.log(theme.muted("\n🔄 Authenticating with server..."));

  const result = await loginUserApi({ username, password });

  if (!result.success) {
    console.log(theme.error(`⛔ Login failed: ${result.error}`));
    return;
  }

  // Store auth token and user info
  setAuthToken(result.token);
  currentUser = result.user;

  console.log(theme.success(`🙌 Logged in as ${currentUser.username}`));

  // Check for expired tasks - user must handle them before continuing
  await handleExpiredTasks();
}

async function logout() {
  if (!currentUser) {
    console.log(theme.warning("⚠️ You're not logged in."));
    return;
  }

  const confirm = (await ask(`\nLogout from ${currentUser.username}? (Y/n): `)).trim().toLowerCase();
  if (confirm === 'n' || confirm === 'no') {
    console.log(theme.muted("Logout cancelled."));
    return;
  }

  const previousUser = currentUser.username;
  currentUser = null;
  setAuthToken(null);
  lastSuggestion = null;
  chatSessionId = null;
  
  console.log(theme.success(`👋 Logged out from ${previousUser}. See you next time!`));
}

// =============================================================================
// EXPIRED TASKS HANDLING
// =============================================================================

async function handleExpiredTasks() {
  if (!currentUser) return;

  const expiredTasks = await findExpiredTasksForUser(currentUser._id);
  
  if (expiredTasks.length === 0) {
    return; // No expired tasks, continue normally
  }

  // Show blocking screen
  console.log(theme.muted("\n═══════════════════════════════════════════════════════════"));
  console.log(theme.error("  ⚠️  ATTENTION: You have tasks with EXPIRED deadlines!  ⚠️"));
  console.log(theme.muted("═══════════════════════════════════════════════════════════"));
  console.log(theme.warning(`\nYou have ${expiredTasks.length} task(s) past their deadline.`));
  console.log(theme.warning("You must handle each one before you can continue.\n"));

  // Process each expired task
  for (let i = 0; i < expiredTasks.length; i++) {
    const task = expiredTasks[i];
    const handled = await handleSingleExpiredTask(task, i + 1, expiredTasks.length);
    
    if (!handled) {
      // User chose to exit - they can't continue until tasks are handled
      console.log(theme.warning("\n⚠️  You must handle all expired tasks to use the app."));
      console.log(theme.muted("Logging out...\n"));
      currentUser = null;
      return;
    }
  }

  console.log(theme.success("\n✅ All expired tasks handled! You can now continue.\n"));
}

async function handleSingleExpiredTask(task, index, total) {
  const daysOverdue = task.daysOverdue || 0;
  
  console.log(theme.muted("───────────────────────────────────────────────────────────"));
  console.log(theme.title(`  📋 Expired Task ${index}/${total}`));
  console.log(theme.muted("───────────────────────────────────────────────────────────"));
  console.log(`  ${theme.subtitle("Task:")} ${task.taskname}`);
  if (task.description) {
    console.log(`  ${theme.subtitle("Description:")} ${task.description}`);
  }
  console.log(`  ${theme.subtitle("Due Date:")} ${formatLocalDate(new Date(task.dueDate))}`);
  console.log(`  ${theme.error(`  ⏰ ${daysOverdue} day(s) overdue`)}`);
  console.log(`  ${theme.subtitle("Importance:")} ${"⭐".repeat(task.importance || 3)}`);
  console.log("");
  
  console.log(theme.subtitle("What would you like to do?"));
  console.log(`${theme.option("1)")} 📅 Extend deadline (set a new date)`);
  console.log(`${theme.option("2)")} 🗑️  Delete this task (forfeit)`);
  console.log(`${theme.option("0)")} ❌ Cancel (logout)`);
  console.log("");

  while (true) {
    const choice = (await ask("Choose an option ➤ ")).trim();

    if (choice === "1") {
      // Extend deadline
      const extended = await extendTaskDeadline(task);
      if (extended) return true;
      // If extension failed, ask again
      continue;
    }
    
    if (choice === "2") {
      // Forfeit/delete task
      const deleted = await forfeitTask(task);
      if (deleted) return true;
      continue;
    }
    
    if (choice === "0") {
      // Cancel - user can't continue
      return false;
    }

    console.log(theme.warning("Please choose 1, 2, or 0."));
  }
}

async function extendTaskDeadline(task) {
  console.log(theme.subtitle("\nSet a new deadline (must be in the future):"));
  console.log(theme.muted("Format: YYYY-MM-DD (e.g., 2025-12-15)\n"));

  const input = (await ask("New deadline ➤ ")).trim();
  
  if (!input) {
    console.log(theme.warning("No date entered. Please try again."));
    return false;
  }

  const newDate = parseDateOnly(input);
  
  if (!newDate) {
    console.log(theme.error("❌ Invalid date format. Use YYYY-MM-DD."));
    return false;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  if (newDate <= now) {
    console.log(theme.error("❌ New deadline must be in the future!"));
    return false;
  }

  const result = await extendTaskDeadlineService({ taskId: task._id, userId: currentUser._id, newDeadline: newDate });
  
  if (!result.success) {
    console.log(theme.error(`❌ Failed to update task: ${result.error}`));
    return false;
  }
  
  console.log(theme.success(`\n✅ Deadline extended to ${formatLocalDate(newDate)}!`));
  return true;
}

async function forfeitTask(task) {
  console.log(theme.warning(`\n⚠️  Are you sure you want to DELETE "${task.taskname}"?`));
  console.log(theme.muted("This action cannot be undone.\n"));

  const confirm = (await ask("Type 'yes' to confirm ➤ ")).trim().toLowerCase();
  
  if (confirm !== "yes") {
    console.log(theme.muted("Deletion cancelled."));
    return false;
  }

  // Delete the task and its schedules via service
  const result = await deleteTaskService({ taskId: task._id, userId: currentUser._id });

  if (!result.success) {
    console.log(theme.error(`❌ Failed to delete task: ${result.error}`));
    return false;
  }

  console.log(theme.success(`\n✅ Task "${task.taskname}" has been deleted.`));
  return true;
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
    const categories = Array.isArray(task.categories) && task.categories.length ? task.categories.join(", ") : "misc";
    const subCategory = task.subCategory?.label || null;
    const displayName = task.taskname || task.title || "(no title)";
    const detailParts = [
      `importance ${task.importance}`,
      `effort ${task.effort}`,
    ];

    // Include description inside parentheses if available, quoted safely
    const desc = task.description || task.note || "";
    if (desc && String(desc).trim()) {
      detailParts.push(`description: ${JSON.stringify(String(desc).trim())}`);
    }

    detailParts.push(`score ${task.priorityScore ?? 0}`);
    detailParts.push(`categories: ${categories}`);
    if (subCategory) detailParts.push(`sub: ${subCategory}`);

    const line = `${index + 1}. ${paint(displayName, ansi.bold)}  ${theme.muted(`(${detailParts.join(", ")})`)}`;
    console.log(line);
  });
}

// =============================================================================
// EDIT TASK
// =============================================================================

async function editTaskOption() {
  if (!ensureLoggedIn()) return;

  const tasks = await getTasksForUser(currentUser._id);
  if (!tasks.length) {
    console.log(theme.info("📭 No tasks to edit — add your first one!"));
    return;
  }

  // Display tasks for selection
  console.log(theme.accent(`\nSelect a task to edit:`));
  tasks.forEach((task, index) => {
    const displayName = task.taskname || task.title || "(no title)";
    const status = task.status || "todo";
    const dueStr = task.dueDate ? ` | Due: ${formatLocalDate(new Date(task.dueDate))}` : "";
    console.log(`${theme.option(`${index + 1})`)} ${displayName} ${theme.muted(`[${status}]${dueStr}`)}`);
  });
  console.log(`${theme.option("0)")} Cancel`);

  const selection = (await ask("\nSelect task number ➤ ")).trim();
  
  if (selection === "0" || !selection) {
    console.log(theme.muted("Edit cancelled."));
    return;
  }

  const taskIndex = parseInt(selection, 10) - 1;
  if (isNaN(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) {
    console.log(theme.warning("Invalid selection."));
    return;
  }

  const taskToEdit = tasks[taskIndex];
  await editTaskFields(taskToEdit);
}

async function editTaskFields(task) {
  const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  console.log(theme.muted("\n═════════════════════════════════════"));
  console.log(theme.title(` Editing: ${task.taskname || task.title}`));
  console.log(theme.muted("═════════════════════════════════════"));
  console.log(theme.subtitle("Press Enter to keep current value, or type a new value.\n"));

  const updates = {};

  // Task name
  const currentName = task.taskname || task.title || "";
  const newName = (await ask(`Task title [${currentName}]: `)).trim();
  if (newName && newName !== currentName) {
    updates.taskname = newName;
  }

  // Description
  const currentDesc = task.description || "";
  const descPrompt = currentDesc ? `Description [${currentDesc}]: ` : "Description (optional): ";
  const newDesc = (await ask(descPrompt)).trim();
  if (newDesc !== "" && newDesc !== currentDesc) {
    updates.description = newDesc;
  }

  // Importance
  const currentImportance = task.importance ?? 3;
  const newImportanceRaw = (await ask(`Importance 1-5 [${currentImportance}]: `)).trim();
  if (newImportanceRaw) {
    const newImportance = toNumber(newImportanceRaw, currentImportance);
    if (newImportance >= 1 && newImportance <= 5 && newImportance !== currentImportance) {
      updates.importance = Math.round(newImportance);
    }
  }

  // Effort
  const currentEffort = task.effort ?? 3;
  const newEffortRaw = (await ask(`Effort 1-5 [${currentEffort}]: `)).trim();
  if (newEffortRaw) {
    const newEffort = toNumber(newEffortRaw, currentEffort);
    if (newEffort >= 1 && newEffort <= 5 && newEffort !== currentEffort) {
      updates.effort = Math.round(newEffort);
    }
  }

  // Estimated Duration
  const currentDuration = task.estimatedDuration ?? 60;
  const newDurationRaw = (await ask(`Estimated duration in minutes [${currentDuration}]: `)).trim();
  if (newDurationRaw) {
    const newDuration = toNumber(newDurationRaw, currentDuration);
    if (newDuration >= 15 && newDuration !== currentDuration) {
      updates.estimatedDuration = Math.round(newDuration);
    }
  }

  // Due Date
  const currentDueDate = task.dueDate ? formatLocalDate(new Date(task.dueDate)) : "none";
  console.log(theme.muted(`\nCurrent due date: ${currentDueDate}`));
  const changeDue = (await ask("Change due date? (y/N): ")).trim().toLowerCase();
  if (changeDue === "y" || changeDue === "yes") {
    const newDueDateRaw = (await ask("New due date (YYYY-MM-DD, or 'clear' to remove): ")).trim();
    if (newDueDateRaw.toLowerCase() === "clear") {
      updates.dueDate = null;
    } else if (newDueDateRaw) {
      const newDueDate = parseDateOnly(newDueDateRaw);
      if (newDueDate) {
        updates.dueDate = newDueDate;
      } else {
        console.log(theme.warning("Invalid date format, keeping current value."));
      }
    }
  }

  // Status
  const currentStatus = task.status || "todo";
  console.log(theme.muted(`\nCurrent status: ${currentStatus}`));
  console.log(theme.subtitle("Status options: todo, in_progress, done"));
  const newStatusRaw = (await ask(`New status [${currentStatus}]: `)).trim().toLowerCase();
  if (newStatusRaw && ["todo", "in_progress", "done"].includes(newStatusRaw) && newStatusRaw !== currentStatus) {
    updates.status = newStatusRaw;
  }

  // Check if any updates
  if (Object.keys(updates).length === 0) {
    console.log(theme.info("\n📝 No changes made."));
    return;
  }

  // Confirm changes
  console.log(theme.subtitle("\nChanges to apply:"));
  for (const [field, value] of Object.entries(updates)) {
    const displayValue = value instanceof Date ? formatLocalDate(value) : 
                         value === null ? "(cleared)" : value;
    console.log(theme.muted(`  • ${field}: ${displayValue}`));
  }

  const confirm = (await ask("\nApply these changes? (Y/n): ")).trim().toLowerCase();
  if (confirm === "n" || confirm === "no") {
    console.log(theme.muted("Edit cancelled."));
    return;
  }

  // Apply updates
  const result = await updateTask({
    userId: currentUser._id,
    taskId: task._id,
    updates,
  });

  if (result.success) {
    console.log(theme.success("\n✅ Task updated successfully!"));
  } else {
    console.log(theme.error(`\n❌ Failed to update task: ${result.error}`));
  }
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
  if (top.categories?.length) console.log(theme.muted(`Categories: ${top.categories.join(", ")}`));
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

// =============================================================================
// AI CHAT
// =============================================================================

async function chatWithAssistant() {
  if (!ensureLoggedIn()) return;

  console.log(theme.subtitle("\n🤖 Chat with AI Assistant"));
  console.log(theme.muted("Have a conversation with your personal AI coach."));
  console.log(theme.muted("The assistant can help you manage tasks, plan your day, and more."));
  console.log(theme.muted("─".repeat(50)));
  console.log(theme.muted("Commands:"));
  console.log(theme.muted("  'exit' or 'quit' - Return to main menu"));
  console.log(theme.muted("  'reset' - Start a new conversation"));
  console.log(theme.muted("  'history' - View conversation history"));
  console.log(theme.muted("─".repeat(50)));

  // Create or reuse session ID
  if (!chatSessionId) {
    chatSessionId = `cli_${currentUser._id}_${Date.now()}`;
    console.log(theme.success(`\n🆕 New chat session started`));
  } else {
    console.log(theme.info(`\n🔄 Continuing previous session`));
  }

  while (true) {
    const message = (await ask("\nYou ➤ ")).trim();

    if (!message) continue;

    // Handle special commands
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage === 'exit' || lowerMessage === 'quit') {
      console.log(theme.muted("\n👋 Chat ended. Returning to main menu."));
      console.log(theme.muted("Your conversation will be saved for next time.\n"));
      break;
    }

    if (lowerMessage === 'reset') {
      console.log(theme.muted("🔄 Resetting conversation..."));
      const resetResult = await resetChatSession({ sessionId: chatSessionId });
      if (resetResult.success) {
        chatSessionId = `cli_${currentUser._id}_${Date.now()}`;
        console.log(theme.success("✅ Conversation reset! Starting fresh."));
      } else {
        console.log(theme.error(`❌ Failed to reset: ${resetResult.error}`));
      }
      continue;
    }

    if (lowerMessage === 'history') {
      await showChatHistory();
      continue;
    }

    // Send message to AI assistant
    console.log(theme.muted("\n🤔 Thinking..."));
    const result = await sendChatMessage({ message, sessionId: chatSessionId });

    if (!result.success) {
      console.log(theme.error(`\n❌ Chat error: ${result.error}`));
      if (result.error.includes('token') || result.error.includes('auth')) {
        console.log(theme.warning("Try logging out and back in."));
      }
      continue;
    }

    // Display AI response
    console.log(theme.accent(`\n🤖 Assistant:`));
    console.log(result.response);
    console.log(theme.muted(`[${result.messageCount || 0} messages in session]`));
  }
}

async function showChatHistory() {
  if (!chatSessionId) {
    console.log(theme.info("No active chat session."));
    return;
  }

  console.log(theme.muted("\n📜 Loading conversation history..."));
  const result = await getChatHistory({ sessionId: chatSessionId });

  if (!result.success) {
    console.log(theme.error(`❌ Failed to load history: ${result.error}`));
    return;
  }

  if (!result.history || result.history.length === 0) {
    console.log(theme.info("No messages in this session yet."));
    return;
  }

  console.log(theme.accent(`\n📜 Conversation History (${result.messageCount} messages)`));
  console.log(theme.muted("─".repeat(50)));

  for (const msg of result.history) {
    const role = msg.role === 'user' ? '👤 You' : '🤖 Assistant';
    const roleStyle = msg.role === 'user' ? theme.subtitle : theme.accent;
    console.log(roleStyle(`\n${role}:`));
    console.log(msg.content);
  }

  console.log(theme.muted("\n" + "─".repeat(50)));
}
