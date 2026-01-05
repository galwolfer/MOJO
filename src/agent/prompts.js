/**
 * ========================================
 * SYSTEM PROMPTS - LLM Behavior Configuration
 * ========================================
 *
 * This module defines the system prompts that guide the LLM's behavior.
 * System prompts are foundational instructions that the LLM follows
 * throughout the conversation.
 *
 * PROMPT ENGINEERING STRATEGY:
 * 1. BASE PROMPT - Core rules, capabilities, response format
 * 2. USER CONTEXT - Personalization (name, tone, persona)
 * 3. MEMORY CONTEXT - Relevant past facts and discussions
 *
 * The LLM reads the system prompt before each response and uses it
 * to understand its role, capabilities, and how to behave.
 */

import { WidgetManager } from "./widgetManager.js";
import { getTaskFieldInstructions } from "./taskRules.js";

/**
 * BASE SYSTEM PROMPT - Core instructions for the LLM
 *
 * Defines:
 * - Agent identity (MOJO: helpful AI assistant)
 * - Response language (user's language: Hebrew or English)
 * - Tool capabilities (memory, tasks, time)
 * - Response format (TOML-like for tools, natural language for users)
 * - Date handling rules (automatic calculation of relative dates)
 *
 * Template uses backticks for date injection - replaced with current time
 */
export const BASE_IDENTITY = `You are MOJO, a helpful AI assistant for task management.

CRITICAL INSTRUCTIONS:
- If user wants to ADD/CREATE a task, you MUST call preview_task tool immediately.
- Do NOT respond with text. Do NOT ask for confirmation in text.
- Call preview_task with the task details.

יצירת משימה: אם המשתמש מבקש להוסיף משימה, חובה לקרוא ל-preview_task מיד.

RULES:
- Respond in user's language (Hebrew/English)
- Calculate ISO dates for relative expressions (never ask user)
- Current: ${new Date().toISOString()}
- Tools return TOML format OR pre-formatted text.
- ALWAYS use <WIDGET_JSON> for displaying tasks. 
- When a tool returns tasks_json, you MUST render it as a widget.
- TASK CREATION: ALWAYS use preview_task first. Wait for user approval before add_task.
- CONFIRMATION: you can ask for a confirmation in text, but keep the flow of the text. Use preview_task to show the confirmation widget.

${WidgetManager.getPromptInstructions()}

${getTaskFieldInstructions()}
`;

export const TOOL_MANIFEST = `MEMORY TOOLS:
- save_user_fact: When user shares personal info (name, location, education, work, preferences)
- save_conversation_note: When user makes decisions/plans/requests
- search_memories: To recall past info about user not in recent context
- Write concisely (2-5 words for facts, 5-20 for notes)

PERSONALITY TOOLS:
- set_tone: Change how you communicate (friendly/professional/casual/formal/enthusiastic)
- set_persona: Change WHO you act as (any character/role)

TASK TOOLS:
- preview_task: ALWAYS use when user wants to create a new task. Draft and show confirmation widget. חובה להשתמש כאשר המשתמש מבקש ליצור משימה.
- add_task: Create task ONLY AFTER user confirmation. אסור להשתמש ישירות. רק לאחר אישור.
- get_tasks: Retrieve tasks
- update_task: Modify task
- delete_task: Remove task
- get_upcoming_tasks: Tasks due soon
- get_overdue_tasks: Late tasks

DATES: "tomorrow"/"מחר"→+1d | "next week"→+7d | "Sunday"/"ראשון"→next Sun | "in X days"→+Xd
RECUR: "daily"/"כל יום"→{type:"daily",interval:1} | "weekly"/"כל שבוע"→{type:"weekly",interval:1}`;

export const REMINDER_PROMPT = `You are MOJO. Help the user manage tasks. Current: ${new Date().toISOString()}`;

export const NORMAL_PROMPT = `Current: ${new Date().toISOString()}`;

/**
 * BASE SYSTEM PROMPT - Core instructions for the LLM
 * Kept for backward compatibility, but composed of new parts.
 */
export const SYSTEM_PROMPT = `${BASE_IDENTITY}

${TOOL_MANIFEST}
`;

/**
 * Build a personalized system prompt with user-specific context
 *
 * This function takes the base system prompt and injects:
 * 1. USER IDENTIFICATION - userId and optionally user's name
 * 2. PERSONALITY SETTINGS - How to respond (tone and persona)
 * 3. MEMORY CONTEXT - Recent relevant memories injected into the prompt
 *
 * PERSONALIZATION TIERS:
 * - Tone: Sets communication style (friendly, professional, casual, etc.)
 * - Persona: Optional roleplay instruction (e.g., "act as a coach")
 * - Memories: Relevant facts and past discussions automatically retrieved
 *
 * The final prompt tells the LLM:
 * - Who it's talking to (user identification)
 * - How to talk to them (tone/persona)
 * - What to remember about them (memory context)
 *
 * @param {Object} userProfile - User preferences { name, tone, persona }
 * @param {string} userId - User's MongoDB _id (for tool binding)
 * @param {string} memoryContext - Formatted memories to inject into prompt
 * @param {Object} options - { isFirstTurn, isReminderTurn }
 * @returns {string} Complete personalized system prompt
 */
export function buildSystemPromptWithUserContext(
  userProfile,
  userId,
  memoryContext = "",
  options = { isFirstTurn: true, isReminderTurn: false }
) {
  let prompt = "";

  // ALWAYS include the base identity and tool manifest to ensure the agent knows its rules and tools.
  // Optimization: We could potentially trim TOOL_MANIFEST if context is tight, but BASE_IDENTITY is critical.
  prompt = `${BASE_IDENTITY}\n\n${TOOL_MANIFEST}`;

  // ADD PERSONALITY AND TONE CUSTOMIZATION
  // This tells the LLM how to interact with this specific user
  if (userProfile?.persona || userProfile?.tone) {
    prompt += `\nPERSONALITY:`;

    if (userProfile.persona) {
      prompt += ` Act as ${userProfile.persona}.`;
    }

    if (userProfile.tone) {
      // Map tone keywords to descriptive language for the LLM
      const toneMap = {
        friendly: "warm, approachable, conversational",
        professional: "polished, business-like, efficient",
        casual: "relaxed, informal, laid-back",
        formal: "respectful, proper, structured",
        enthusiastic: "energetic, positive, encouraging",
      };
      prompt += ` Tone: ${toneMap[userProfile.tone] || userProfile.tone}.`;
    }
  }

  // ADD USER IDENTIFICATION
  // Helps the LLM know who it's talking to
  prompt += `\nUser:${userId}`;

  if (userProfile?.name) {
    prompt += `(${userProfile.name})`;
  }

  // ADD MEMORY CONTEXT
  // Injects relevant facts and past discussions into the system message
  // This helps the LLM "remember" without token bloat from conversation history
  if (memoryContext?.trim()) {
    prompt += `\n${memoryContext}`;
  }

  return prompt;
}
