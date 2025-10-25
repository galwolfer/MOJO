import { GeminiAdapter } from "./geminiAdapter.js";
import { memoryStore } from "./mongoMemoryStore.js";
import { toolDefinitions, executeToolCall } from "./toolFunctions.js";
import { buildSystemPromptWithUserContext } from "./prompts.js";
import { User } from "../models/index.js";
import { analyzeAndExtractMemories } from "./memoryExtractor.js";

/**
 * Agent Controller - The central controller for the agent
 */
export class AgentController {
  constructor(apiKey) {
    this.gemini = new GeminiAdapter(apiKey);
    this.maxIterations = 5; // Maximum iterations to prevent infinite loops
  }

  /**
   * Process a user message with semantic memory retrieval
   */
  async processMessage(sessionId, userMessage, userId) {
    try {
      console.log(`[AgentController] Processing message for user: ${userId}, session: ${sessionId}`);

      // Add the user's message to memory
      await memoryStore.addUserMessage(sessionId, userId, userMessage);

      // Retrieve the history
      let history = await memoryStore.getHistory(sessionId);
      console.log(`[AgentController] History length: ${history.length}`);

      // Load user profile
      const user = await User.findById(userId);
      console.log(`[AgentController] User found:`, user ? `${user.username} (${user._id})` : "NOT FOUND");

      const userProfile = user?.profile || {};
      console.log(`[AgentController] User profile:`, {
        name: userProfile.name,
        tone: userProfile.tone,
        persona: userProfile.persona,
      });

      // ===== SEMANTIC MEMORY RETRIEVAL =====
      // Retrieve relevant memories based on the user's message
      console.log(`[AgentController] Retrieving relevant memories for query: "${userMessage.substring(0, 50)}..."`);

      const relevantMemories = await memoryStore.retrieveRelevantMemories(
        userId,
        userMessage,
        5 // Reduce to top 5 (was 10) to save tokens
      );

      // Format memories for prompt - COMPACT FORMAT to save tokens
      let memoryContext = "";

      // Add primary memories (settings, preferences, facts) - compact format
      if (relevantMemories.primary && relevantMemories.primary.length > 0) {
        memoryContext += "\nMemory: ";
        relevantMemories.primary.forEach((mem, idx) => {
          memoryContext += `${mem.text}; `;
        });
      }

      // Add conversation memories - compact format
      if (relevantMemories.conversation && relevantMemories.conversation.length > 0) {
        memoryContext += "\nPast: ";
        relevantMemories.conversation.forEach((mem, idx) => {
          memoryContext += `${mem.text}; `;
        });
      }

      console.log(`[AgentController] Memory context length: ${memoryContext.length} chars`);
      console.log(
        `[AgentController] Retrieved ${relevantMemories.primary.length} primary + ${relevantMemories.conversation.length} conversation memories`
      );

      // ----- Safety: truncate long memory context to avoid huge prompts -----
      const MAX_MEMORY_CHARS = 600; // Reduced from 1200 - keep it very short
      if (memoryContext.length > MAX_MEMORY_CHARS) {
        console.warn(
          `[AgentController] memoryContext is ${memoryContext.length} chars; truncating to ${MAX_MEMORY_CHARS} chars to reduce token usage.`
        );
        memoryContext = memoryContext.substring(0, MAX_MEMORY_CHARS) + "...";
      }

      // Build personalized system prompt with user context AND (possibly truncated) memories
      const systemPrompt = buildSystemPromptWithUserContext(userProfile, userId, memoryContext);
      console.log(`[AgentController] System prompt length: ${systemPrompt.length} chars`);

      // Safety: trim conversation history to last N messages BEFORE adding system prompt
      const MAX_HISTORY_MESSAGES = 10; // Reduced from 20 to 10 to save significant tokens
      if (history.length > MAX_HISTORY_MESSAGES) {
        console.warn(
          `[AgentController] history length is ${history.length}; trimming to last ${MAX_HISTORY_MESSAGES} messages to reduce prompt size.`
        );
        history = history.slice(-MAX_HISTORY_MESSAGES);
      }

      // Add system prompt at the beginning of history
      history = [{ role: "system", content: systemPrompt }, ...history];

      // Loop to handle function calls
      let iteration = 0;
      let finalResponse = null;

      while (iteration < this.maxIterations) {
        iteration++;

        // Send request to Gemini
        const geminiResponse = await this.gemini.generateContent(history, toolDefinitions);

        // Extract the response
        const response = this.gemini.extractResponse(geminiResponse);

        // If the model hit MAX_TOKENS, retry with a request for shorter response
        if (response.type === "max_tokens") {
          console.warn(
            `⚠️ Model hit MAX_TOKENS (${response.usageMetadata?.totalTokenCount} total tokens). Retrying with request for concise response...`
          );

          // Add a user message asking for a shorter response
          await memoryStore.addUserMessage(
            sessionId,
            userId,
            "[System: Please provide a brief, concise response. Keep it short.]"
          );
          history = await memoryStore.getHistory(sessionId);

          // Re-add system prompt and trim history
          if (history.length > MAX_HISTORY_MESSAGES) {
            history = history.slice(-MAX_HISTORY_MESSAGES);
          }
          history = [{ role: "system", content: systemPrompt }, ...history];

          // Continue to retry
          continue;
        }

        // If it's a textual response - we're done
        if (response.type === "text") {
          finalResponse = response.text;
          await memoryStore.addAssistantMessage(sessionId, userId, finalResponse);
          break;
        }

        // If it's a function call - execute it
        if (response.type === "function_call") {
          const { name, args } = response.functionCall;

          console.log(`Executing function: ${name}`, args);

          // Add the call to memory
          await memoryStore.addFunctionCall(sessionId, userId, response.functionCall);

          try {
            // Execute the function with user context
            const context = { userId };
            const functionResult = await executeToolCall(name, args, context);

            // Add the result to memory
            const resultString = JSON.stringify(functionResult);
            await memoryStore.addFunctionResult(sessionId, userId, name, resultString);

            // Update the history
            history = await memoryStore.getHistory(sessionId);
          } catch (error) {
            console.error("Function execution error:", error);

            // Add the error to memory
            const errorMessage = JSON.stringify({
              error: error.message,
            });
            await memoryStore.addFunctionResult(sessionId, userId, name, errorMessage);

            history = await memoryStore.getHistory(sessionId);
          }
        }
      }

      // If we reached the maximum iterations without a response
      if (!finalResponse) {
        finalResponse = "Sorry, I encountered an issue processing the request. Please try again.";
        await memoryStore.addAssistantMessage(sessionId, userId, finalResponse);
      }

      // ===== AUTO EXTRACT MEMORIES =====
      // Extract important information from the conversation
      console.log(`🔍 Starting memory extraction for session ${sessionId}`);
      try {
        await analyzeAndExtractMemories(userId, sessionId, userMessage, finalResponse);
        console.log(`✅ Memory extraction completed for session ${sessionId}`);
      } catch (error) {
        console.error("❌ Error extracting memories:", error);
        // Don't fail the whole request if memory extraction fails
      }

      return {
        success: true,
        response: finalResponse,
        sessionId,
        messageCount: await memoryStore.getMessageCount(sessionId),
      };
    } catch (error) {
      console.error("Agent processing error:", error);
      throw error;
    }
  }

  /**
   * Reset a session
   */
  async resetSession(sessionId, userId) {
    await memoryStore.clearSession(sessionId);
    return { success: true, message: "Session reset successfully" };
  }

  /**
   * Retrieve session history
   */
  async getSessionHistory(sessionId, userId) {
    return await memoryStore.getHistory(sessionId);
  }
}
