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
 * Backwards-compatible prompt helpers using centralized `agentConfig`.
 * Keep these thin wrappers so callers can continue to import from `prompts.js`.
 */

// Expose current identity text (evaluated per import)
export const BASE_IDENTITY = getBaseIdentity();
export { TOOL_MANIFEST, REMINDER_PROMPT, NORMAL_PROMPT };
export const SYSTEM_PROMPT = `${BASE_IDENTITY}\n\n${TOOL_MANIFEST}`;

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
