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

    const messages = [new SystemMessage(systemPrompt)];

    // Add history (trimmed if necessary)
    // Use TOKEN_BUDGET.MAX_HISTORY_TOKENS to guide slicing dynamically
    // Approx 4 chars per token. As a heuristic we cap message count to keep system prompts small.
    const heuristicMsgs = Math.max(1, Math.floor(TOKEN_BUDGET.MAX_HISTORY_TOKENS / 150));
    const MAX_HISTORY_MSGS = Math.min(20, heuristicMsgs); // Increased history window for tool context
    const recentHistory = history.slice(-MAX_HISTORY_MSGS);

    for (const msg of recentHistory) {
      if (msg.role === "user") {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === "assistant") {
        // Handle tool calls in assistant messages
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          messages.push(
            new AIMessage({
              content: msg.content || "",
              tool_calls: msg.toolCalls,
            })
          );
        } else {
          messages.push(new AIMessage(msg.content));
        }
      } else if (msg.role === "tool" || msg.role === "function") {
        // Handle tool responses
        messages.push(
          new ToolMessage({
            content: msg.content,
            tool_call_id: msg.tool_call_id || msg.name || "unknown",
          })
        );
      }
    }

    messages.push(new HumanMessage(userMessage));

    return messages;
  }
}
