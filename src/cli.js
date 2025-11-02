import readline from "readline";
import bcrypt from "bcrypt";
import { connectDatabase } from "./config/database.js";
import User from "./models/User.js";
import Task from "./models/Task.js";
import { coacherAlgorithm } from "./services/index.js";

// Simple ANSI styling helpers to keep the CLI lively without extra deps
const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const paint = (text, ...styles) => `${styles.join("")}${text}${ansi.reset}`;

const theme = {
  title: (text) => paint(text, ansi.bold, ansi.cyan),
  subtitle: (text) => paint(text, ansi.dim, ansi.gray),
  success: (text) => paint(text, ansi.bold, ansi.green),
  warning: (text) => paint(text, ansi.bold, ansi.yellow),
  error: (text) => paint(text, ansi.bold, ansi.red),
  info: (text) => paint(text, ansi.blue),
  prompt: (text) => paint(text, ansi.bold, ansi.magenta),
  option: (text) => paint(text, ansi.bold, ansi.yellow),
  accent: (text) => paint(text, ansi.bold, ansi.blue),
  muted: (text) => paint(text, ansi.dim, ansi.gray),
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

const menuOptions = [
  { key: "1", label: "Register" },
  { key: "2", label: "Login" },
  { key: "3", label: "Add Task" },
  { key: "4", label: "List Tasks" },
  { key: "5", label: "Recommend Next Task" },
  { key: "0", label: "Exit" },
];

// Questionnaire mapping each life area to the prompt we show the user
const preferenceQuestions = [
  {
    key: "work",
    prompt: "How central is work or your main project right now? (1=low, 5=critical): ",
  },
  {
    key: "study",
    prompt: "How much focus do studies or learning need? (1=low, 5=critical): ",
  },
  {
    key: "health",
    prompt: "How often do you invest in health or fitness? (1=rarely, 5=daily): ",
  },
  {
    key: "social",
    prompt: "How important are social or family commitments? (1=low, 5=high): ",
  },
  {
    key: "finance",
    prompt: "How urgent are finance/admin tasks? (1=chill, 5=urgent): ",
  },
  {
    key: "household",
    prompt: "How much attention do household chores need? (1=low, 5=high): ",
  },
  {
    key: "creative",
    prompt: "How motivated are you to pursue creative projects? (1=low, 5=high): ",
  },
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

  const email = emailInput.toLowerCase();
  const duplicate = await User.findOne({ $or: [{ username }, { email }] }).lean();

  if (duplicate) {
    const clashes = [];
    if (duplicate.username === username) clashes.push("username");
    if (duplicate.email === email) clashes.push("email");
    console.log(theme.error(`🚫 That ${clashes.join(" & ")} is already taken. Try a different one.`));
    return;
  }

  const priorities = await collectPriorities();
  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    username,
    email,
    passwordHash,
    profile: { priorities },
  });
  console.log(theme.success("🎉 Registered successfully! You can log in now."));
}

async function login() {
  const username = (await ask("username: ")).trim();
  const password = (await ask("password: ", { hidden: true })).trim();
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    console.log(theme.error("⛔ Invalid credentials, please try again."));
    return;
  }
  currentUser = user;
  console.log(theme.success(`🙌 Logged in as ${user.username}`));
}

async function collectPriorities() {
  // Ask the user to rate each life area on a 1-5 scale
  console.log(theme.subtitle("\nLet's personalize your experience (answer 1-5)."));
  const result = {};
  for (const { key, prompt } of preferenceQuestions) {
    let value = 3;
    while (true) {
      const raw = (await ask(prompt)).trim();
      if (!raw) {
        value = 3; // default midpoint if they skip the answer
        break;
      }
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
        value = Math.round(parsed); // clamp to integer for storage
        break;
      }
      console.log(theme.warning("Please enter a number between 1 and 5."));
    }
    result[key] = value; // store by category key (e.g. work, health)
  }
  console.log("");
  return result;
}

async function addTask() {
  if (!ensureLoggedIn()) return;

  const title = (await ask("Task title: ")).trim();
  const description = (await ask("Short description (optional): ")).trim();
  const importance = Number((await ask("Importance 1–5 (default 3): ")).trim() || 3);
  const effort = Number((await ask("Effort 1–5 (default 3): ")).trim() || 3);
  const due = (await ask("Due date (YYYY-MM-DD, optional): ")).trim();
  const dueDate = due ? new Date(due) : undefined;

  await Task.create({
    userId: currentUser._id,
    title,
    description,
    importance,
    effort,
    dueDate,
  });
  console.log(theme.success("✅ Task added! We'll keep its score in sync."));
}

async function listTasks() {
  if (!ensureLoggedIn()) return;

  const tasks = await Task.find({ userId: currentUser._id }).lean();
  if (!tasks.length) {
    console.log(theme.info("📭 No tasks yet — add your first one!"));
    return;
  }

  console.log(theme.accent(`\n${currentUser.username}'s tasks:`));
  tasks.forEach((task, index) => {
    const tags = Array.isArray(task.tags) && task.tags.length ? task.tags.join(", ") : "misc";
    const line = `${index + 1}. ${paint(task.title, ansi.bold)}  ${theme.muted(
      `(importance ${task.importance}, effort ${task.effort}, score ${task.priorityScore ?? 0}, tags: ${tags})`
    )}`;
    console.log(line);
  });
}

async function recommendTask() {
  if (!ensureLoggedIn()) return;

  const { top, ranked = [], reasons = [] } =
    await coacherAlgorithm.computeFromDb(currentUser._id, currentUser.profile || {});

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
  if (top.window) {
    console.log(theme.muted(`Suggested slot: ${top.window.start} -> ${top.window.end}`));
  }
}

function ensureLoggedIn() {
  if (currentUser) return true;
  console.log(theme.warning("🔐 Please log in first."));
  return false;
}
