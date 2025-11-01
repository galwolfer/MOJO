import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as taskService from "../services/taskService.js";

/**
 * LangChain-compatible tools for MOJO agent
 * Using DynamicStructuredTool with Zod schemas
 */

export function createLangChainTools(userId) {
  return [
    // Get current time
    new DynamicStructuredTool({
      name: "get_current_time",
      description: "Returns current date/time",
      schema: z.object({}),
      func: async () => {
        const now = new Date();
        return JSON.stringify({
          date: now.toLocaleDateString("en-US"),
          time: now.toLocaleTimeString("en-US"),
          timestamp: now.toISOString(),
        });
      },
    }),

    // Add task
    new DynamicStructuredTool({
      name: "add_task",
      description:
        "Create task with name, deadline, optional tag/recurrence. Calculate ISO date from relative expressions (never ask user).",
      schema: z.object({
        name: z.string().describe("Task name"),
        tag: z.string().optional().describe("Category (optional)"),
        deadline: z.string().describe("ISO 8601 date. Calculate from relative expressions."),
        recurrence: z
          .object({
            type: z.enum(["daily", "weekly", "monthly", "yearly"]),
            interval: z.number().optional().default(1),
            endDate: z.string().optional(),
            count: z.number().optional(),
          })
          .optional(),
      }),
      func: async ({ name, tag, deadline, recurrence }) => {
        try {
          const taskData = { name, tag, deadline };

          if (recurrence?.type) {
            taskData.recurrence = {
              type: recurrence.type,
              interval: recurrence.interval || 1,
              endDate: recurrence.endDate || null,
              count: recurrence.count || null,
              completedDates: [],
            };
          }

          const task = await taskService.createTask(userId, taskData);

          console.log(`[LOG] Task created: ${task._id} ${recurrence ? "(recurring)" : ""}`);

          const response = {
            success: true,
            message: `Task "${name}" created`,
            task: {
              id: task._id.toString(),
              name: task.name,
              tag: task.tag,
              deadline: task.deadline,
            },
          };

          if (task.recurrence?.type) {
            response.task.recurrence = { type: task.recurrence.type, interval: task.recurrence.interval };
            response.message += ` (${task.recurrence.type})`;
          }

          return JSON.stringify(response);
        } catch (error) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    }),

    // Get tasks
    new DynamicStructuredTool({
      name: "get_tasks",
      description: "Retrieve tasks. Filter by tag/completion/date.",
      schema: z.object({
        tag: z.string().optional(),
        completed: z.boolean().optional(),
        dueBefore: z.string().optional(),
        dueAfter: z.string().optional(),
      }),
      func: async ({ tag, completed, dueBefore, dueAfter }) => {
        try {
          const filters = {};
          if (tag) filters.tag = tag;
          if (completed !== undefined) filters.completed = completed;
          if (dueBefore) filters.dueBefore = dueBefore;
          if (dueAfter) filters.dueAfter = dueAfter;

          const tasks = await taskService.getTasks(userId, filters);

          return JSON.stringify({
            success: true,
            count: tasks.length,
            tasks: tasks.map((t) => ({
              id: t._id.toString(),
              name: t.name,
              tag: t.tag,
              deadline: t.deadline,
              completed: t.completed,
            })),
          });
        } catch (error) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    }),

    // Update task
    new DynamicStructuredTool({
      name: "update_task",
      description: "Update task name/tag/deadline/status",
      schema: z.object({
        taskId: z.string(),
        name: z.string().optional(),
        tag: z.string().optional(),
        deadline: z.string().optional(),
        completed: z.boolean().optional(),
      }),
      func: async ({ taskId, name, tag, deadline, completed }) => {
        try {
          const updates = {};
          if (name !== undefined) updates.name = name;
          if (tag !== undefined) updates.tag = tag;
          if (deadline !== undefined) updates.deadline = deadline;
          if (completed !== undefined) updates.completed = completed;

          const task = await taskService.updateTask(taskId, userId, updates);

          if (!task) {
            return JSON.stringify({ success: false, error: "Task not found" });
          }

          return JSON.stringify({
            success: true,
            message: "Updated",
            task: {
              id: task._id.toString(),
              name: task.name,
              tag: task.tag,
              deadline: task.deadline,
              completed: task.completed,
            },
          });
        } catch (error) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    }),

    // Delete task
    new DynamicStructuredTool({
      name: "delete_task",
      description: "Delete task permanently",
      schema: z.object({
        taskId: z.string(),
      }),
      func: async ({ taskId }) => {
        try {
          const success = await taskService.deleteTask(taskId, userId);
          if (!success) {
            return JSON.stringify({ success: false, error: "Not found" });
          }
          return JSON.stringify({ success: true, message: "Deleted" });
        } catch (error) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    }),

    // Get upcoming tasks
    new DynamicStructuredTool({
      name: "get_upcoming_tasks",
      description: "Get tasks within N days",
      schema: z.object({
        days: z.number().optional().default(7),
      }),
      func: async ({ days = 7 }) => {
        try {
          const tasks = await taskService.getUpcomingTasks(userId, days);
          return JSON.stringify({
            success: true,
            count: tasks.length,
            tasks: tasks.map((t) => ({
              id: t._id.toString(),
              name: t.name,
              deadline: t.deadline,
            })),
          });
        } catch (error) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    }),

    // Get overdue tasks
    new DynamicStructuredTool({
      name: "get_overdue_tasks",
      description: "Get overdue incomplete tasks",
      schema: z.object({}),
      func: async () => {
        try {
          const tasks = await taskService.getOverdueTasks(userId);
          return JSON.stringify({
            success: true,
            count: tasks.length,
            tasks: tasks.map((t) => ({
              id: t._id.toString(),
              name: t.name,
              deadline: t.deadline,
              daysOverdue: Math.floor((new Date() - new Date(t.deadline)) / 86400000),
            })),
          });
        } catch (error) {
          return JSON.stringify({ success: false, error: error.message });
        }
      },
    }),
  ];
}
