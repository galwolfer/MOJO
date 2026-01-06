import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { buildSystemPromptWithUserContext } from "./prompts.js";
import { TOKEN_BUDGET } from "./tokenBudget.js";

/**
 * Prompt Manager - Handles message construction and token management
 */
export class PromptManager {
  /**
   * Build the messages array for the LLM
   *
   * @param {Object} params
   * @param {string} params.userMessage - Current user message
   * @param {Array} params.history - Conversation history
   * @param {string} params.summary - Rolling conversation summary
   * @param {Object} params.userProfile - User profile
   * @param {string} params.userId - User ID
   * @param {string} params.memoryContext - Retrieved memory context
   * @param {number} params.messageIndex - Current message index (1-based)
   * @returns {Array} Array of LangChain messages
   */
  static buildMessages({ userMessage, history, summary, userProfile, userId, memoryContext, messageIndex }) {
    const isFirstTurn = messageIndex <= 1; // Handle 0 or 1 as first turn
    const isReminderTurn = messageIndex > 1 && messageIndex % 20 === 0;

    // Build system prompt based on turn type
    let systemPrompt = buildSystemPromptWithUserContext(userProfile, userId, memoryContext, {
      isFirstTurn,
      isReminderTurn,
    });

    // Inject summary if available
    if (summary) {
      systemPrompt += `\n\nPREVIOUS CONVERSATION SUMMARY:\n${summary}`;
    }

    // Add freshness reminder to system prompt to override history bias
    // This forces the model to ignore stale data in history and rely on tools for current state
    systemPrompt += `\n\nCRITICAL: If the user asks to see/list tasks, you MUST call the "get_tasks" tool. Do NOT answer from memory or history. Your internal knowledge is STALE. Always fetch fresh data.`;

    const messages = [new SystemMessage(systemPrompt)];

    messages.push(new HumanMessage(userMessage));

    return messages;
  }
}
