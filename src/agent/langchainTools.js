import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as taskService from "../services/taskService.js";
import { memoryStore } from "../services/memoryService.js";
import { WIDGETS } from "./widgetManager.js";
import { TASK_CONFIG, inferTaskProperties } from "./taskRules.js";

/**
 * ========================================
 * LANGCHAIN TOOLS - LLM Action Functions
 * ========================================
 *
 * This module defines all the tools available to the LLM agent.
 * Tools are functions that the LLM can call to take actions in the system.
 *
 * TOOL CATEGORIES:
 * 1. MEMORY TOOLS - Save and search user facts and conversation notes
 * 2. TASK TOOLS - Create, update, delete, and retrieve tasks
 * 3. TIME TOOLS - Get current date/time information
 *
 * Each tool is a DynamicStructuredTool with:
 * - name: Unique identifier for the tool
 * - description: What the tool does (used by LLM to decide when to use it)
 * - schema: Zod schema defining input parameters and their types
 * - func: The actual function that executes when the tool is called
 *
 * Tools communicate with the LLM using TOML-like format for structured responses:
 * ok=true/false, msg="...", count=N, etc.
 */

/**
 * Factory function to create all available LangChain tools
 *
 * @param {string} userId - The user's MongoDB _id (tools are bound to specific user)
 * @returns {Array<DynamicStructuredTool>} Array of all available tools
 *
 * Tools created:
 * - get_current_time: Returns current date, time, and timestamp
 * - save_user_fact: Store personal facts about the user (profile, preferences, skills)
 * - save_conversation_note: Store important information from conversations
 * - search_memories: Find previously saved facts and conversation notes
 * - add_task: Create a new task with optional deadline and recurrence
 * - get_tasks: Retrieve tasks with various filters
 * - update_task: Modify an existing task
 * - delete_task: Permanently remove a task
 * - get_upcoming_tasks: Get tasks due within N days
 * - get_overdue_tasks: Get tasks that are past their deadline
 */
export function createLangChainTools(userId) {
  return [
    /**
     * ==================
     * TIME TOOL
     * ==================
     * Returns the current date, time, and ISO timestamp
     * Used when LLM needs to know the current time for scheduling or context
     */
    new DynamicStructuredTool({
      name: "get_current_time",
      description: "Returns current date/time",
      schema: z.object({}), // No parameters needed
      func: async () => {
        const now = new Date();
        return `date="${now.toLocaleDateString("en-US")}"
time="${now.toLocaleTimeString("en-US")}"
ts="${now.toISOString()}"`;
      },
    }),

    /**
     * ==================
     * MEMORY TOOL: save_user_fact
     * ==================
     * Save important facts about the user that should be remembered long-term.
     * Examples: name, location, education, work, preferences, skills
     *
     * These facts are PRIMARY MEMORY - the user's profile and preferences.
     * They're stored with vector embeddings for semantic search.
     *
     * Strategy: Keep facts concise (2-5 words) for efficiency
     * Impact: Facts are retrieved automatically in future conversations
     */
    new DynamicStructuredTool({
      name: "save_user_fact",
      description:
        "Save important facts about the user (name, age, location, education, work, preferences, skills). Use this when user shares personal information that should be remembered for future conversations. Write facts concisely (2-5 words).",
      schema: z.object({
        fact: z.string().describe("Concise fact about user (2-5 words, e.g., 'studies at Bar Ilan')"),
        category: z
          .enum(["name", "age", "location", "education", "work", "preference", "skill", "other"])
          .describe("Category of the fact"),
        importance: z.number().min(1).max(10).optional().default(7).describe("Importance level 1-10 (default: 7)"),
      }),
      func: async ({ fact, category, importance = 7 }) => {
        try {
          // Map category to memory type for storage and retrieval
          let type = "user_fact";
          if (category === "preference") {
            type = "preference"; // Preferences are treated specially
          } else if (["name", "age", "location"].includes(category)) {
            type = "profile"; // Profile-related facts
          }

          // Save to database with importance score
          // Higher importance = more likely to be retrieved in future conversations
          await memoryStore.savePrimaryMemory(userId, fact, type, importance, {
            source: "llm_tool",
            category,
          });

          return `ok=true
msg="Saved: ${fact}"
cat="${category}"
imp=${importance}`;
        } catch (error) {
          return `ok=false
err="${error.message}"`;
        }
      },
    }),

    /**
     * ==================
     * MEMORY TOOL: save_conversation_note
     * ==================
     * Save important information learned during the conversation.
     * Examples: user decisions, plans, requests, topics discussed, preferences stated
     *
     * These are CONVERSATION MEMORY - contextual info for the current/future conversations.
     * Different from user facts - these are temporal and may change.
     *
     * Strategy: Notes are 5-20 words, capture key decision points or agreements
     * Impact: Notes help agent understand what was discussed if conversation is resumed
     */
    new DynamicStructuredTool({
      name: "save_conversation_note",
      description:
        "Save important information from the conversation (decisions, plans, requests, topics discussed). Use this for context that might be relevant in future conversations.",
      schema: z.object({
        note: z.string().describe("Brief note about the conversation (5-20 words)"),
        importance: z.number().min(1).max(10).optional().default(5).describe("Importance level 1-10 (default: 5)"),
      }),
      func: async ({ note, importance = 5 }) => {
        try {
          await memoryStore.saveConversationMemory(userId, note, "conversation", importance, {
            source: "llm_tool",
          });

          return `ok=true
msg="Saved note: ${note}"
imp=${importance}`;
        } catch (error) {
          return `ok=false
err="${error.message}"`;
        }
      },
    }),

    /**
     * ==================
     * MEMORY TOOL: search_memories
     * ==================
     * Search through saved memories using semantic search.
     *
     * This tool allows the LLM to recall information that isn't in recent context.
     * The search uses vector embeddings for semantic matching - meaning it finds
     * memories that are SIMILAR IN MEANING, not just exact matches.
     *
     * Categories:
     * - primary: User facts (profile, education, work, preferences)
     * - conversation: Past discussions, decisions, plans
     * - all: Search both primary and conversation memories
     *
     * Returns top 5 matching memories with their type and importance score
     */
    new DynamicStructuredTool({
      name: "search_memories",
      description:
        "Search user's saved memories (facts about user, previous conversations). Use this when you need to recall information about the user that isn't in recent context.",
      schema: z.object({
        query: z.string().describe("What to search for in memories"),
        category: z
          .enum(["primary", "conversation", "all"])
          .optional()
          .default("all")
          .describe("Which category to search: primary (user facts), conversation (past discussions), or all"),
      }),
      func: async ({ query, category = "all" }) => {
        try {
          let memories;
          // Search different categories based on user request
          if (category === "primary") {
            memories = await memoryStore.retrievePrimaryMemories(userId, query, 5);
          } else if (category === "conversation") {
            memories = await memoryStore.retrieveConversationMemories(userId, query, 5);
          } else {
            // Search both categories
            const result = await memoryStore.retrieveRelevantMemories(userId, query, 5);
            memories = result.all;
          }

          if (memories.length === 0) {
            return `ok=true
msg="No memories"
count=0`;
          }

          // Format results as structured TOML format
          const items = memories
            .map(
              (m, i) =>
                `[[mem]]
text="${m.text}"
type="${m.type}"
imp=${m.importance}`
            )
            .join("\n");
          return `ok=true
count=${memories.length}\n${items}`;
        } catch (error) {
          return `ok=false
err="${error.message}"`;
        }
      },
    }),

    /**
     * ==================
     * TASK TOOL: preview_task
     * ==================
     * CRITICAL: This is the ONLY tool to use when user wants to create a new task.
     * Call this tool IMMEDIATELY when user asks to add/create a task.
     * Do NOT respond with text. Do NOT ask questions.
     * חובה להשתמש בכלי זה כאשר המשתמש מבקש ליצור משימה חדשה.
     */
    new DynamicStructuredTool({
      name: "preview_task",
      description: "CRITICAL: Call this tool IMMEDIATELY when user wants to create a new task. Do NOT respond with text. חובה להשתמש בכלי זה כאשר המשתמש מבקש ליצור משימה.",
      schema: z.object({
        name: z.string().describe("Task name"),
        deadline: z.string().describe("ISO 8601 date. Calculate from relative expressions."),
        description: z.string().optional().describe("Additional details"),
        importance: z.number().min(1).max(5).optional().describe("1-5 scale (1=low, 5=critical)"),
        effort: z.number().min(1).max(5).optional().describe("1-5 scale (1=easy, 5=hard)"),
        duration: z.number().optional().describe("Estimated time in minutes"),
        tags: z.array(z.string()).optional().describe("Categories"),
        splitable: z.boolean().optional().describe("Can be split into chunks?"),
        recurrence: z
          .object({
            type: z.enum(["daily", "weekly", "monthly", "yearly"]),
            interval: z.number().optional().default(1),
            endDate: z.string().optional(),
            count: z.number().optional(),
          })
          .optional(),
      }),
      func: async (params) => {
        const { name, deadline, description, importance, effort, duration, tags, splitable, recurrence } = params;
        
        // Infer properties from task name if not provided
        const inferred = inferTaskProperties(name);
        
        // Apply defaults and inference
        const finalImportance = importance || inferred.importance;
        const finalEffort = effort || inferred.effort;
        const finalDuration = duration || inferred.duration;
        const finalTags = tags || inferred.tags;
        const finalSplitable = splitable !== undefined ? splitable : TASK_CONFIG.defaults.splitable;

        // Construct a mock task object
        const draftTask = {
          id: "draft-" + Date.now(),
          title: name,
          status: "draft",
          dueDate: new Date(deadline).toISOString(),
          priority: finalImportance >= 4 ? "high" : finalImportance <= 2 ? "low" : "medium",
          tags: finalTags,
          description: description || (recurrence ? `Recurrence: ${recurrence.type}` : ""),
          // Extra fields for display if widget supports them
          importance: finalImportance,
          effort: finalEffort,
          estimatedDuration: finalDuration,
          canSplit: finalSplitable
        };

        const widgetJson = {
          version: "1.0",
          widget_type: "task_confirmation",
          data: {
            id: "draft-" + Date.now(),
            title: name,
            status: "draft",
            dueDate: new Date(deadline).toISOString(),
            priority: finalImportance >= 4 ? "high" : finalImportance <= 2 ? "low" : "medium",
            tags: finalTags,
            description: description || (recurrence ? `Recurrence: ${recurrence.type}` : ""),
            importance: finalImportance,
            effort: finalEffort,
            estimatedDuration: finalDuration,
            canSplit: finalSplitable,
            confirmLabel: "Create Task",
            cancelLabel: "Edit"
          }
        };

        return `Draft created successfully.
Widget Payload: <WIDGET_JSON>${JSON.stringify(widgetJson)}</WIDGET_JSON>
[SYSTEM INSTRUCTION: Output the above widget payload exactly. Address the user in their language to confirm the task.]`;
      }
    }),

    /**
     * ==================
     * TASK TOOL: add_task
     * ==================
     * Create a new task in the user's task list.
     * ONLY use this AFTER user confirmation.
     * אסור להשתמש בכלי זה ישירות. רק לאחר אישור המשתמש.
     */
    new DynamicStructuredTool({
      name: "add_task",
      description:
        "Create task with name, deadline, optional tag/recurrence. ONLY use this AFTER user confirmation. אסור להשתמש בכלי זה ישירות. רק לאחר אישור המשתמש.",
      schema: z.object({
        name: z.string().describe("Task name"),
        deadline: z.string().describe("ISO 8601 date. Calculate from relative expressions."),
        description: z.string().optional().describe("Additional details"),
        importance: z.number().min(1).max(5).optional().describe("1-5 scale (1=low, 5=critical)"),
        effort: z.number().min(1).max(5).optional().describe("1-5 scale (1=easy, 5=hard)"),
        duration: z.number().optional().describe("Estimated time in minutes"),
        tags: z.array(z.string()).optional().describe("Categories"),
        splitable: z.boolean().optional().describe("Can be split into chunks?"),
        recurrence: z
          .object({
            type: z.enum(["daily", "weekly", "monthly", "yearly"]),
            interval: z.number().optional().default(1),
            endDate: z.string().optional(),
            count: z.number().optional(),
          })
          .optional(),
      }),
      func: async (params) => {
        const { name, deadline, description, importance, effort, duration, tags, splitable, recurrence } = params;
        try {
          // Infer properties from task name if not provided
          const inferred = inferTaskProperties(name);
          
          // Apply defaults and inference
          const finalImportance = importance || inferred.importance;
          const finalEffort = effort || inferred.effort;
          const finalDuration = duration || inferred.duration;
          const finalTags = tags || inferred.tags;
          const finalSplitable = splitable !== undefined ? splitable : TASK_CONFIG.defaults.splitable;

          const taskData = { 
            userId,
            taskname: name, 
            description: description || "",
            importance: finalImportance,
            effort: finalEffort,
            estimatedDuration: finalDuration,
            canSplit: finalSplitable,
            tags: finalTags, 
            dueDate: new Date(deadline) 
          };

          // Add recurrence pattern if specified
          if (recurrence?.type) {
            taskData.recurrence = {
              type: recurrence.type,
              interval: recurrence.interval || 1,
              endDate: recurrence.endDate || null,
              count: recurrence.count || null,
              completedDates: [],
            };
          }

          // Create task in database
          const task = await taskService.createTask(taskData);

          console.log(`[LOG] Task created: ${task._id} ${recurrence ? "(recurring)" : ""}`);

          // Return structured response
          let result = `ok=true\nmsg="Task created"\nid="${task._id}"
name="${task.taskname}"`;
          if (task.tags && task.tags.length > 0) result += `\ntag="${task.tags[0]}"`;
          result += `\ndue="${task.dueDate.toISOString()}"`;

          if (task.recurrence?.type) {
            result += `\nrecur="${task.recurrence.type}"
int=${task.recurrence.interval}`;
          }

          return result;
        } catch (error) {
          return `ok=false\nerr="${error.message}"`;
        }
      },
    }),

    /**
     * ==================
     * TASK TOOL: get_tasks
     * ==================
     * Retrieve tasks matching specified filters.
     *
     * Filters:
     * - tag: Filter by category (e.g., "work", "personal")
     * - completed: Filter by completion status (true/false)
     * - dueBefore: Get tasks due before a specific date
     * - dueAfter: Get tasks due after a specific date
     *
     * All filters are optional - omit to match all tasks
     */
    new DynamicStructuredTool({
      name: "get_tasks",
      description: "Retrieve tasks. Filter by tag/completion/date.",
      schema: z.object({
        tag: z.string().optional(),
        completed: z.boolean().optional(),
        dueBefore: z.string().optional(),
        dueAfter: z.string().optional(),
      }),
      returnDirect: true,
      func: async ({ tag, completed, dueBefore, dueAfter }) => {
        try {
          // Build filter object for database query
          const filters = {};
          if (tag) filters.tags = tag;
          if (completed !== undefined) {
            filters.status = completed ? "done" : { $ne: "done" };
          }
          if (dueBefore) filters.dueDate = { ...filters.dueDate, $lte: new Date(dueBefore) };
          if (dueAfter) filters.dueDate = { ...filters.dueDate, $gte: new Date(dueAfter) };

          // Query database with filters (correct service function name)
          const tasks = await taskService.getTasksForUser(userId, filters);

          if (tasks.length === 0) {
            return "I couldn't find any tasks matching your criteria.";
          }

          // Construct Widget JSON
          const widgetJson = {
            version: "1.0",
            widget_type: "task_list",
            data: {
              tasks: tasks.map((t) => ({
                id: t._id,
                title: t.taskname,
                status: t.status,
                dueDate: t.dueDate,
                priority: t.priority,
                tags: t.tags,
                description: t.description,
              })),
            },
          };

          return `Here are the tasks I found:\n<WIDGET_JSON>\n${JSON.stringify(widgetJson)}\n</WIDGET_JSON>`;
        } catch (error) {
          return `Error retrieving tasks: ${error.message}`;
        }
      },
    }),

    /**
     * ==================
     * TASK TOOL: update_task
     * ==================
     * Modify an existing task.
     *
     * Can update any combination of:
     * - name: Change task description
     * - tag: Change category
     * - deadline: Change due date
     * - completed: Mark as done/undone
     *
     * Only the fields provided are updated
     */
    new DynamicStructuredTool({
      name: "update_task",
      description: "Update task name/tag/deadline/status",
      schema: z.object({
        taskId: z.string().optional(),
        name: z.string().optional().describe("Task name to identify task when taskId is not provided"),
        tag: z.string().optional(),
        deadline: z.string().optional(),
        completed: z.boolean().optional(),
      }),
      func: async ({ taskId, name, tag, deadline, completed }) => {
        try {
          // If taskId not provided, try to resolve by exact task name
          if (!taskId) {
            if (!name) return `ok=false\nerr="taskId or name is required"`;
            const candidates = await taskService.getTasksForUser(userId, { taskname: name });
            if (!candidates || candidates.length === 0) {
              return `ok=false\nerr="Task not found by name: ${name}"`;
            }
            if (candidates.length > 1) {
              const list = candidates.map((c) => `- ${c._id}: ${c.taskname}`).join("\\n");
              return `ok=false\nerr="Multiple tasks found matching name. Please provide taskId. Candidates:\n${list}"`;
            }
            taskId = candidates[0]._id;
          }

          // Build update object with only specified fields
          const updates = {};
          if (name !== undefined) updates.taskname = name;
          if (tag !== undefined) updates.tags = [tag];

          if (deadline !== undefined) {
            const d = new Date(deadline);
            if (isNaN(d.getTime())) {
              return `ok=false\nerr="Invalid deadline format"`;
            }
            updates.dueDate = d;
          }

          if (completed !== undefined) updates.status = completed ? "done" : "todo";

          // Update in database
          const result = await taskService.updateTask({ userId, taskId, updates });

          if (!result.success) {
            return `ok=false\nerr="${result.error}"`;
          }

          const task = result.task;

          return `ok=true\nmsg="Updated"\nid="${task._id}"\nname="${task.taskname}"${
            task.tags && task.tags.length > 0 ? `\ntag="${task.tags[0]}"` : ""
          }\ndue="${task.dueDate ? new Date(task.dueDate).toISOString() : ""}"\ndone=${task.status === "done"}`;
        } catch (error) {
          return `ok=false\nerr="${error.message}"`;
        }
      },
    }),

    /**
     * ==================
     * TASK TOOL: delete_task
     * ==================
     * Permanently remove a task from the user's task list.
     * This operation cannot be undone.
     */
    new DynamicStructuredTool({
      name: "delete_task",
      description: "Delete task permanently",
      schema: z.object({
        taskId: z.string(),
      }),
      func: async ({ taskId }) => {
        try {
          const result = await taskService.deleteTask({ taskId, userId });
          if (!result.success) {
            return `ok=false\nerr="${result.error}"`;
          }
          return `ok=true\nmsg="Deleted"`;
        } catch (error) {
          return `ok=false\nerr="${error.message}"`;
        }
      },
    }),

    /**
     * ==================
     * TASK TOOL: get_upcoming_tasks
     * ==================
     * Get all tasks due within a specified number of days.
     * Useful for showing the user what's coming up soon.
     *
     * @param days - Number of days to look ahead (default: 7)
     * Returns tasks sorted by due date (earliest first)
     */
    new DynamicStructuredTool({
      name: "get_upcoming_tasks",
      description: "Get tasks within N days",
      schema: z.object({
        days: z.number().optional().default(7),
      }),
      returnDirect: true,
      func: async ({ days = 7 }) => {
        try {
          const tasks = await taskService.getUpcomingTasks(userId, days);

          if (tasks.length === 0) {
            return `You don't have any upcoming tasks for the next ${days} days.`;
          }

          // Construct Widget JSON
          const widgetJson = {
            version: "1.0",
            widget_type: "task_list",
            data: {
              tasks: tasks.map((t) => ({
                id: t._id,
                title: t.taskname,
                status: t.status,
                dueDate: t.dueDate,
                priority: t.priority,
                tags: t.tags,
                description: t.description,
              })),
            },
          };

          return `Here are your upcoming tasks for the next ${days} days:\n<WIDGET_JSON>\n${JSON.stringify(widgetJson)}\n</WIDGET_JSON>`;
        } catch (error) {
          return `Error retrieving upcoming tasks: ${error.message}`;
        }
      },
    }),

    /**
     * ==================
     * TASK TOOL: get_overdue_tasks
     * ==================
     * Get all tasks that are past their deadline and not yet completed.
     * Useful for reminding user about urgent items.
     * Returns tasks with days overdue information.
     */
    new DynamicStructuredTool({
      name: "get_overdue_tasks",
      description: "Get overdue incomplete tasks",
      schema: z.object({}), // No parameters
      returnDirect: true,
      func: async () => {
        try {
          const tasks = await taskService.getOverdueTasks(userId);

          if (tasks.length === 0) {
            return "Great news! You don't have any overdue tasks.";
          }

          // Construct Widget JSON
          const widgetJson = {
            version: "1.0",
            widget_type: "task_list",
            data: {
              tasks: tasks.map((t) => ({
                id: t._id,
                title: t.taskname,
                status: t.status,
                dueDate: t.dueDate,
                priority: t.priority,
                tags: t.tags,
                description: t.description,
              })),
            },
          };

          return `You have ${tasks.length} overdue tasks:\n<WIDGET_JSON>\n${JSON.stringify(widgetJson)}\n</WIDGET_JSON>`;
        } catch (error) {
          return `Error retrieving overdue tasks: ${error.message}`;
        }
      },
    }),
  ];
}
