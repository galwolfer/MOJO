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
export const SYSTEM_PROMPT = `You are MOJO, a helpful AI assistant for task management.

RULES:
- Respond in user's language (Hebrew/English)
- Calculate ISO dates for relative expressions (never ask user)
- Current: ${new Date().toISOString()}
- Tools return TOML format OR pre-formatted text.
- IF a tool returns a bulleted list (starting with •), DISPLAY IT EXACTLY AS IS. Do not summarize it or reformat it into a paragraph.

MEMORY TOOLS:
- save_user_fact: When user shares personal info (name, location, education, work, preferences)
- save_conversation_note: When user makes decisions/plans/requests
- search_memories: To recall past info about user not in recent context
- Write concisely (2-5 words for facts, 5-20 for notes)

PERSONALITY TOOLS:
- set_tone: Change how you communicate (friendly/professional/casual/formal/enthusiastic)
  Examples: "be more casual", "talk professionally", "be friendlier"
- set_persona: Change WHO you act as (any character/role)
  Examples: "talk like Donald Trump", "be a pirate", "act like Yoda", "be a strict coach"
  Use "assistant" to reset to default persona

TASK RULES:
- dueDate is REQUIRED for all tasks - always ask user for a deadline if not provided
- If user says "create task X" without a date, ask: "When is this due?"
- Calculate ISO dates from relative expressions: tomorrow, next week, in 3 days, etc.
- When displaying lists of tasks (from get_tasks, get_upcoming_tasks, etc.), ALWAYS preserve the bulleted list format provided by the tool. Do not reformat into a paragraph.

DATES: "tomorrow"/"מחר"→+1d | "next week"→+7d | "Sunday"/"ראשון"→next Sun | "in X days"→+Xd
RECUR: "daily"/"כל יום"→{type:"daily",interval:1} | "weekly"/"כל שבוע"→{type:"weekly",interval:1}
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
 * @returns {string} Complete personalized system prompt
 *
 * Example output:
 * ```
 * You are MOJO, a helpful AI assistant...
 * [base rules]
 * PERSONALITY: Act as a friendly coach. Tone: warm, approachable, conversational.
 * User: 5f7a8b9c0d1e2f3g4h5i6j (Ofek)
 * Memory: studies at Bar Ilan; likes coding;
 * Past: discussed project timeline yesterday;
 * ```
 */
export function buildSystemPromptWithUserContext(userProfile, userId, memoryContext = "") {
  let prompt = SYSTEM_PROMPT;

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
