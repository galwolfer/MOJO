import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Available tools for the agent
 */

// Initialize DB
const dbPath = join(__dirname, "../../data/db.json");
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { users: [], tasks: [], notes: [] });

/**
 * Define tools in Gemini Format
 */
export const toolDefinitions = [
  {
    name: "get_current_time",
    description: "Returns the current date and time",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_task",
    description: "Adds a new task for a user",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User identifier",
        },
        title: {
          type: "string",
          description: "Task title",
        },
        description: {
          type: "string",
          description: "Task description (optional)",
        },
      },
      required: ["userId", "title"],
    },
  },
  {
    name: "get_tasks",
    description: "Returns the list of tasks for a user",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User identifier",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "create_note",
    description: "Creates a new note",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User identifier",
        },
        content: {
          type: "string",
          description: "Note content",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags (optional)",
        },
      },
      required: ["userId", "content"],
    },
  },
];

/**
 * Tool implementations
 */
export const toolImplementations = {
  get_current_time: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString("en-US"),
      time: now.toLocaleTimeString("en-US"),
      timestamp: now.toISOString(),
    };
  },

  add_task: async ({ userId, title, description = "" }) => {
    await db.read();

    const task = {
      id: Date.now().toString(),
      userId,
      title,
      description,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    db.data.tasks.push(task);
    await db.write();

    return {
      success: true,
      task,
    };
  },

  get_tasks: async ({ userId }) => {
    await db.read();

    const userTasks = db.data.tasks.filter((task) => task.userId === userId);

    return {
      count: userTasks.length,
      tasks: userTasks,
    };
  },

  create_note: async ({ userId, content, tags = [] }) => {
    await db.read();

    const note = {
      id: Date.now().toString(),
      userId,
      content,
      tags,
      createdAt: new Date().toISOString(),
    };

    db.data.notes.push(note);
    await db.write();

    return {
      success: true,
      note,
    };
  },
};

/**
 * Tool execution manager
 */
export async function executeToolCall(functionName, args) {
  const implementation = toolImplementations[functionName];

  if (!implementation) {
    throw new Error(`Unknown function: ${functionName}`);
  }

  try {
    const result = await implementation(args);
    return result;
  } catch (error) {
    console.error(`Error executing ${functionName}:`, error);
    throw error;
  }
}
