import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as taskService from "../services/taskService.js";

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
    description:
      "Creates a new task for the user with a name, optional tag, deadline, and optional recurrence. Use this when the user wants to add or create a task/reminder/todo. IMPORTANT: You MUST calculate the exact deadline date from relative expressions (like 'Sunday', 'next week', 'tomorrow'). Never ask the user for a date.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Task name/title (e.g., 'Do linear algebra homework')",
        },
        tag: {
          type: "string",
          description: "Optional category/tag for the task (e.g., 'school', 'personal', 'work')",
        },
        deadline: {
          type: "string",
          description:
            "Deadline in ISO 8601 format (e.g., '2025-11-01T12:00:00Z'). YOU MUST calculate this from relative dates like 'Sunday', 'next week', 'tomorrow', etc. NEVER ask the user for a date.",
        },
        recurrence: {
          type: "object",
          description: "Optional recurrence pattern for repeating tasks. Include this when user wants task to repeat.",
          properties: {
            type: {
              type: "string",
              enum: ["daily", "weekly", "monthly", "yearly"],
              description: "How often the task repeats",
            },
            interval: {
              type: "number",
              description: "Repeat every N periods (e.g., interval:2 with type:weekly = every 2 weeks). Default: 1",
            },
            endDate: {
              type: "string",
              description: "Optional end date in ISO 8601 format. Task stops recurring after this date.",
            },
            count: {
              type: "number",
              description: "Optional max number of occurrences. Task stops after completing this many times.",
            },
          },
          required: ["type"],
        },
      },
      required: ["name", "deadline"],
    },
  },
  {
    name: "get_tasks",
    description: "Retrieves the user's tasks. Can filter by tag, completion status, or date range.",
    parameters: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "Filter by tag (optional)",
        },
        completed: {
          type: "boolean",
          description: "Filter by completion status (optional)",
        },
        dueBefore: {
          type: "string",
          description: "Show tasks due before this date (ISO 8601 format)",
        },
        dueAfter: {
          type: "string",
          description: "Show tasks due after this date (ISO 8601 format)",
        },
      },
    },
  },
  {
    name: "update_task",
    description: "Updates an existing task. Can modify name, tag, deadline, or completion status.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the task to update",
        },
        name: {
          type: "string",
          description: "New task name (optional)",
        },
        tag: {
          type: "string",
          description: "New tag (optional)",
        },
        deadline: {
          type: "string",
          description: "New deadline in ISO 8601 format (optional)",
        },
        completed: {
          type: "boolean",
          description: "Mark as completed or not (optional)",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "delete_task",
    description: "Deletes a task permanently.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the task to delete",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "get_upcoming_tasks",
    description: "Gets upcoming tasks within a specified number of days.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to look ahead (default: 7)",
        },
      },
    },
  },
  {
    name: "get_overdue_tasks",
    description: "Gets all overdue (past deadline) incomplete tasks.",
    parameters: {
      type: "object",
      properties: {},
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

  // New MongoDB-based task tools
  add_task: async ({ name, tag, deadline, recurrence }, context) => {
    if (!context?.userId) {
      throw new Error("User authentication required");
    }

    try {
      const taskData = {
        name,
        tag,
        deadline,
      };

      // Add recurrence if provided
      if (recurrence && recurrence.type) {
        taskData.recurrence = {
          type: recurrence.type,
          interval: recurrence.interval || 1,
          endDate: recurrence.endDate || null,
          count: recurrence.count || null,
          completedDates: [],
        };
      }

      const task = await taskService.createTask(context.userId, taskData);

      const response = {
        success: true,
        message: `Task "${name}" created successfully`,
        task: {
          id: task._id.toString(),
          name: task.name,
          tag: task.tag,
          deadline: task.deadline,
          completed: task.completed,
        },
      };

      // Add recurrence info if present
      if (task.recurrence && task.recurrence.type) {
        response.task.recurrence = {
          type: task.recurrence.type,
          interval: task.recurrence.interval,
        };

        if (task.recurrence.endDate) {
          response.message += ` (repeats ${task.recurrence.type}, until ${new Date(
            task.recurrence.endDate
          ).toLocaleDateString()})`;
        } else if (task.recurrence.count) {
          response.message += ` (repeats ${task.recurrence.type}, ${task.recurrence.count} times)`;
        } else {
          response.message += ` (repeats ${task.recurrence.type})`;
        }
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  get_tasks: async ({ tag, completed, dueBefore, dueAfter } = {}, context) => {
    if (!context?.userId) {
      throw new Error("User authentication required");
    }

    try {
      const filters = {};
      if (tag) filters.tag = tag;
      if (completed !== undefined) filters.completed = completed;
      if (dueBefore) filters.dueBefore = dueBefore;
      if (dueAfter) filters.dueAfter = dueAfter;

      const tasks = await taskService.getTasks(context.userId, filters);

      return {
        success: true,
        count: tasks.length,
        tasks: tasks.map((t) => ({
          id: t._id.toString(),
          name: t.name,
          tag: t.tag,
          deadline: t.deadline,
          completed: t.completed,
          createdAt: t.createdAt,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  update_task: async ({ taskId, ...updates }, context) => {
    if (!context?.userId) {
      throw new Error("User authentication required");
    }

    try {
      const task = await taskService.updateTask(taskId, context.userId, updates);

      if (!task) {
        return {
          success: false,
          error: "Task not found or unauthorized",
        };
      }

      return {
        success: true,
        message: "Task updated successfully",
        task: {
          id: task._id.toString(),
          name: task.name,
          tag: task.tag,
          deadline: task.deadline,
          completed: task.completed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  delete_task: async ({ taskId }, context) => {
    if (!context?.userId) {
      throw new Error("User authentication required");
    }

    try {
      const success = await taskService.deleteTask(taskId, context.userId);

      if (!success) {
        return {
          success: false,
          error: "Task not found or unauthorized",
        };
      }

      return {
        success: true,
        message: "Task deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  get_upcoming_tasks: async ({ days = 7 } = {}, context) => {
    if (!context?.userId) {
      throw new Error("User authentication required");
    }

    try {
      const tasks = await taskService.getUpcomingTasks(context.userId, days);

      return {
        success: true,
        count: tasks.length,
        days,
        tasks: tasks.map((t) => ({
          id: t._id.toString(),
          name: t.name,
          tag: t.tag,
          deadline: t.deadline,
          completed: t.completed,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  get_overdue_tasks: async (params, context) => {
    if (!context?.userId) {
      throw new Error("User authentication required");
    }

    try {
      const tasks = await taskService.getOverdueTasks(context.userId);

      return {
        success: true,
        count: tasks.length,
        tasks: tasks.map((t) => ({
          id: t._id.toString(),
          name: t.name,
          tag: t.tag,
          deadline: t.deadline,
          daysOverdue: Math.floor((new Date() - new Date(t.deadline)) / (1000 * 60 * 60 * 24)),
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Legacy LowDB tasks (keeping for backward compatibility)
  add_task_legacy: async ({ userId, title, description = "" }) => {
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

  get_tasks_legacy: async ({ userId }) => {
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
 * @param {string} functionName - Name of the tool to execute
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context (contains userId from auth)
 */
export async function executeToolCall(functionName, args, context = {}) {
  const implementation = toolImplementations[functionName];

  if (!implementation) {
    throw new Error(`Unknown function: ${functionName}`);
  }

  try {
    const result = await implementation(args, context);
    return result;
  } catch (error) {
    console.error(`Error executing ${functionName}:`, error);
    throw error;
  }
}
