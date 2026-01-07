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

import {
  POLICY_ANCHOR,
  TOOL_MANIFEST,
  REMINDER_PROMPT,
  NORMAL_PROMPT,
  getBaseIdentity,
  buildSystemPromptWithUserContext as buildFromConfig,
} from "./agentConfig.js";

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
 * User: 5f7a8b9c0d1e2f3g4h5i6j (user)
 * Memory: studies at Bar Ilan; likes coding;
 * Past: discussed project timeline yesterday;
 * ```
 */

// Helper to get fresh identity text
export const getSystemBaseIdentity = () => getBaseIdentity();
export { TOOL_MANIFEST, REMINDER_PROMPT, NORMAL_PROMPT };

/**
 * Re-exported builder that uses the centralized generator so prompts are editable in one place
 */
export function buildSystemPromptWithUserContext(
  userProfile,
  userId,
  memoryContext = "",
  options = { isFirstTurn: true, isReminderTurn: false }
) {
  return buildFromConfig(userProfile, userId, memoryContext, options);
}
