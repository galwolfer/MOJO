import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * כלים זמינים לאגנט
 */

// אתחול DB
const dbPath = join(__dirname, "../../data/db.json");
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { users: [], tasks: [], notes: [] });

/**
 * הגדרת הכלים ב-Gemini Format
 */
export const toolDefinitions = [
  {
    name: "get_current_time",
    description: "מחזיר את השעה והתאריך הנוכחיים",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_task",
    description: "מוסיף משימה חדשה למשתמש",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "מזהה המשתמש",
        },
        title: {
          type: "string",
          description: "כותרת המשימה",
        },
        description: {
          type: "string",
          description: "תיאור המשימה (אופציונלי)",
        },
      },
      required: ["userId", "title"],
    },
  },
  {
    name: "get_tasks",
    description: "מחזיר את רשימת המשימות של משתמש",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "מזהה המשתמש",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "create_note",
    description: "יוצר הערה חדשה",
    parameters: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "מזהה המשתמש",
        },
        content: {
          type: "string",
          description: "תוכן ההערה",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "תגיות (אופציונלי)",
        },
      },
      required: ["userId", "content"],
    },
  },
];

/**
 * מימוש הכלים
 */
export const toolImplementations = {
  get_current_time: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString("he-IL"),
      time: now.toLocaleTimeString("he-IL"),
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
 * מנהל ביצוע הכלים
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
