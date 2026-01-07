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

    // Add current timestamp for date calculations
    systemPrompt += `\n\nCURRENT_TIME: ${new Date().toISOString()}`;

    // Inject summary if available
    if (summary) {
      systemPrompt += `\n\nPREVIOUS CONVERSATION SUMMARY:\n${summary}`;
    }

    // Add freshness reminder to system prompt to override history bias
    // This forces the model to ignore stale data in history and rely on tools for current state
    systemPrompt += `\n\nCRITICAL: If the user asks to see/list tasks, you MUST call the "get_tasks" tool. Do NOT answer from memory or history. Your internal knowledge is STALE. Always fetch fresh data.`;

    const messages = [new SystemMessage(systemPrompt)];

    // Convert and add history
    if (history && history.length > 0) {
      // Limit history to prevent token overflow
      const recentHistory = history.slice(-15); // Adjust as needed based on TOKEN_BUDGET

      recentHistory.forEach((msg) => {
        if (msg.role === "human" || msg.role === "user") {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === "assistant") {
          // Check if it has tool calls
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
        } else if (msg.role === "tool") {
          messages.push(
            new ToolMessage({
              content: msg.content,
              tool_call_id: msg.tool_call_id,
              name: msg.name,
            })
          );
        }
      });
    }

    messages.push(new HumanMessage(userMessage));

    return messages;
  }
}
